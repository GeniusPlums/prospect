import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractChatText, findEmail, parsePeople } from "./parse.ts";

describe("composio parse", () => {
  it("finds a nested email and ignores example.com", () => {
    assert.equal(findEmail({ person: { emails: [{ value: "ada@example.com" }] } }), null);
    assert.equal(findEmail({ data: { email: "ada@razorpay.com" } }), "ada@razorpay.com");
  });

  it("parses people from mixed payloads", () => {
    const people = parsePeople({
      matches: [{ id: "p1", name: "Ada Iyer", headline: "Backend", city: "Bengaluru" }],
    });
    assert.equal(people[0]?.externalId, "p1");
    assert.equal(people[0]?.displayName, "Ada Iyer");
  });

  it("extracts chat text from OpenAI-shaped envelopes", () => {
    assert.equal(
      extractChatText({ choices: [{ message: { content: '{"title":"Eng"}' } }] }),
      '{"title":"Eng"}',
    );
  });
});
