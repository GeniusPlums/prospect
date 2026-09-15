import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractJson } from "./complete.ts";

describe("extractJson", () => {
  it("reads a fenced object", () => {
    const parsed = extractJson('```json\n{"title":"Eng"}\n```') as { title: string };
    assert.equal(parsed.title, "Eng");
  });

  it("reads a bare object", () => {
    const parsed = extractJson('noise {"must":["Go"]} trailing') as { must: string[] };
    assert.deepEqual(parsed.must, ["Go"]);
  });
});
