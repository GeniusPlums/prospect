import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { startConnectFlow, type ConnectHost } from "./connect.ts";

function host(overrides: Partial<ConnectHost> & Pick<ConnectHost, "link">): ConnectHost {
  return {
    async getToolkit() {
      return { composioManagedAuthSchemes: [], authConfigDetails: [{ mode: "API_KEY" }] };
    },
    async listAuthConfigs() {
      return [];
    },
    async createManagedAuthConfig() {
      return "acfg_apollo_key";
    },
    async existingConnection() {
      return undefined;
    },
    async savePending() {},
    async saveActive() {},
    async listActiveAccount() {
      return undefined;
    },
    ...overrides,
  };
}

describe("startConnectFlow", () => {
  it("returns the hosted link redirect when oauth schemes are empty but api_key is connectable", async () => {
    let created = false;
    const result = await startConnectFlow(
      "org_tester",
      "apollo",
      "https://prospect.example/connections?connected=1",
      host({
        async getToolkit() {
          return { composioManagedAuthSchemes: [], authConfigDetails: [{ mode: "API_KEY" }] };
        },
        async createManagedAuthConfig() {
          created = true;
          return "acfg_apollo_key";
        },
        async link() {
          return { id: "ca_123", redirectUrl: "https://connect.example/link/apollo" };
        },
      }),
    );
    assert.equal(created, true);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.alreadyConnected, false);
    if (result.alreadyConnected) return;
    assert.equal(result.redirectUrl, "https://connect.example/link/apollo");
    assert.equal(result.connectedAccountId, "ca_123");
    assert.doesNotMatch(JSON.stringify(result), /No hosted OAuth/);
  });

  it("does not invent success when link fails", async () => {
    const result = await startConnectFlow("org_tester", "gmail", "https://prospect.example/connections", host({
      async getToolkit() {
        return { composioManagedAuthSchemes: ["OAUTH2"] };
      },
      async listAuthConfigs() {
        return [{ id: "acfg_gmail" }];
      },
      async link() {
        throw new Error("redirect_uri is not allowed");
      },
    }));
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.match(result.error, /redirect_uri is not allowed/);
    assert.doesNotMatch(result.error, /No hosted OAuth/);
  });

  it("returns already connected without calling link", async () => {
    let linked = false;
    const result = await startConnectFlow("org_tester", "gmail", "https://prospect.example/connections", host({
      async existingConnection() {
        return { connected_account_id: "ca_live", status: "active" };
      },
      async link() {
        linked = true;
        return { id: "nope", redirectUrl: "https://example.invalid" };
      },
    }));
    assert.equal(linked, false);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.alreadyConnected, true);
    if (!result.alreadyConnected) return;
    assert.equal(result.connectedAccountId, "ca_live");
  });
});
