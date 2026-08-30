import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { peopleSource } from "./registry.ts";
import { localSource } from "./profile-source/active.ts";

describe("profile_source adapters", () => {
  it("local search returns the warm index with no keys", async () => {
    const hits = await peopleSource().search({});
    assert.ok(hits.length >= 30);
  });

  it("swap file is the only Coresignal/PDL binding", () => {
    const src = readFileSync(new URL("./profile-source/active.ts", import.meta.url), "utf8");
    assert.match(src, /coresignalSource as remotePeople|pdlSource as remotePeople/);
  });

  it("local collect is id-stable", async () => {
    const [row] = await localSource.collect(["aditya-iyer"]);
    assert.equal(row?.externalId, "aditya-iyer");
  });
});
