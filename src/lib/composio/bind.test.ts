import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { bindArgs, pickToolForIntent, scoreToolForIntent, toolFromRaw, type ToolSchema } from "./bind.ts";

function tool(partial: Partial<ToolSchema> & { slug: string }): ToolSchema {
  return {
    name: partial.name ?? partial.slug,
    description: partial.description ?? "",
    properties: partial.properties ?? {},
    required: partial.required ?? [],
    slug: partial.slug,
  };
}

describe("tool schema bind", () => {
  it("fills schema keys from aliases and drops extra dump fields", () => {
    const schema = tool({
      slug: "APOLLO_SEARCH_PEOPLE",
      properties: { q: { type: "string" }, location: { type: "string" }, page: { type: "integer", default: 1 } },
      required: ["q"],
    });
    const bound = bindArgs(schema, {
      query: "ML engineer",
      location: "Bengaluru",
      payload: { junk: true },
      to: "nobody@invalid.local",
    });
    assert.equal(bound.ok, true);
    if (!bound.ok) return;
    assert.deepEqual(bound.args, { q: "ML engineer", location: "Bengaluru", page: 1 });
    assert.equal("payload" in bound.args, false);
    assert.equal("to" in bound.args, false);
  });

  it("fails instead of guessing when a required field cannot be mapped", () => {
    const schema = tool({
      slug: "GREENHOUSE_CREATE_CANDIDATE",
      properties: { email: { type: "string" }, first_name: { type: "string" } },
      required: ["email", "first_name"],
    });
    const bound = bindArgs(schema, { first_name: "Ada" });
    assert.equal(bound.ok, false);
    if (bound.ok) return;
    assert.match(bound.error, /missing required email/);
  });

  it("picks a people-search tool with a query field, not send-email", () => {
    const tools = [
      toolFromRaw({
        slug: "GMAIL_SEND_EMAIL",
        name: "Send Email",
        inputParameters: { properties: { to: { type: "string" }, subject: { type: "string" } }, required: ["to"] },
      }),
      toolFromRaw({
        slug: "APOLLO_SEARCH_PEOPLE",
        name: "Search People",
        inputParameters: { properties: { q: { type: "string" } }, required: ["q"] },
      }),
    ].filter((row): row is ToolSchema => Boolean(row));
    const picked = pickToolForIntent(tools, "people_search", { query: "founders" });
    assert.equal(picked.ok, true);
    if (!picked.ok) return;
    assert.equal(picked.tool.slug, "APOLLO_SEARCH_PEOPLE");
    assert.deepEqual(picked.args, { q: "founders" });
  });

  it("does not claim a lane works when no tool can be bound", () => {
    const tools = [
      tool({
        slug: "CUSTOM_EXPORT",
        name: "Export",
        properties: { dataset_id: { type: "string" } },
        required: ["dataset_id"],
      }),
    ];
    assert.equal(scoreToolForIntent(tools[0]!, "people_search"), 0);
    const picked = pickToolForIntent(tools, "people_search", { query: "engineer" });
    assert.equal(picked.ok, false);
    if (picked.ok) return;
    assert.match(picked.error, /No people search tool/);
  });

  it("maps send-email and llm chat onto real parameter names", () => {
    const mail = pickToolForIntent(
      [
        tool({
          slug: "GMAIL_SEND_EMAIL",
          properties: { recipient_email: { type: "string" }, subject: { type: "string" }, body: { type: "string" } },
          required: ["recipient_email", "subject", "body"],
        }),
      ],
      "send_email",
      { to: "ada@company.com", subject: "Hi", body: "Hello" },
    );
    assert.equal(mail.ok, true);
    if (mail.ok) assert.equal(mail.args.recipient_email, "ada@company.com");

    const chat = pickToolForIntent(
      [
        tool({
          slug: "OPENAI_CREATE_CHAT_COMPLETION",
          properties: { messages: { type: "array" }, model: { type: "string" } },
          required: ["messages"],
        }),
      ],
      "llm_chat",
      { messages: [{ role: "user", content: "hi" }], model: "gpt-4o-mini" },
    );
    assert.equal(chat.ok, true);
    if (chat.ok) assert.equal(Array.isArray(chat.args.messages), true);
  });
});
