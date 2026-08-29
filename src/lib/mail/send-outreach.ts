import { createServerFn } from "@tanstack/react-start";
import {
  ConnectorType,
  GmailTools,
  OutlookTools,
  type CallToolResult,
  type ConnectorTypeName,
  type ToolArgs,
} from "@/lib/app-data";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type SendOutreachOk = { ok: true; via: "gmail" | "outlook" };
export type SendOutreachFail = {
  ok: false;
  error: string;
  loginRequired?: boolean;
  loginUrl?: string;
};
export type SendOutreachResult = SendOutreachOk | SendOutreachFail;

function asFailure(result: CallToolResult): SendOutreachFail {
  return {
    ok: false,
    error: result.errorMessage ?? "Could not send.",
    loginRequired: result.loginRequired,
    loginUrl: result.loginUrl,
  };
}

function rawError(result: CallToolResult): string {
  return (result.errorMessage ?? "").toLowerCase();
}

function isUnknownTool(result: CallToolResult): boolean {
  const m = rawError(result);
  return (
    m.includes("unknown tool") ||
    m.includes("unknown_tool") ||
    m.includes("tool not found") ||
    m.includes("no such tool") ||
    m.includes("invalid tool") ||
    m.includes("does not exist") ||
    m.includes("not in catalog") ||
    m.includes("tool_not_found")
  );
}

function isConnectorUnavailable(result: CallToolResult): boolean {
  const m = rawError(result);
  return (
    result.loginRequired === true ||
    m.includes("not_connected") ||
    m.includes("failed_precondition") ||
    m.includes("scope_denied") ||
    m.includes("access_denied") ||
    m.includes("missing_connector_token")
  );
}

function isArgError(result: CallToolResult): boolean {
  const m = rawError(result);
  return (
    m.includes("required") ||
    m.includes("invalid argument") ||
    m.includes("invalid_argument") ||
    m.includes("missing") ||
    m.includes("validation") ||
    m.includes("unexpected") ||
    m.includes("field")
  );
}

const TOOLS: Array<{
  name: string;
  connectorType: ConnectorTypeName;
  via: "gmail" | "outlook";
}> = [
  { name: GmailTools.sendEmail, connectorType: ConnectorType.Gmail, via: "gmail" },
  { name: GmailTools.send, connectorType: ConnectorType.Gmail, via: "gmail" },
  {
    name: OutlookTools.sendEmail,
    connectorType: ConnectorType.Outlook,
    via: "outlook",
  },
  {
    name: OutlookTools.sendMail,
    connectorType: ConnectorType.Outlook,
    via: "outlook",
  },
  { name: OutlookTools.send, connectorType: ConnectorType.Outlook, via: "outlook" },
];

function argShapes(to: string, subject: string, body: string): ToolArgs[] {
  return [
    { to, subject, body },
    { recipient_email: to, subject, body },
    { to, subject, body_text: body },
  ];
}

export const sendOutreachEmail = createServerFn({ method: "POST" })
  .validator((input: { to: string; subject: string; body: string }) => {
    const to = input.to.trim();
    const subject = input.subject.trim().slice(0, 200);
    const body = input.body.trim().slice(0, 8000);
    if (!EMAIL_RE.test(to)) throw new Error("A valid recipient is required");
    if (!subject) throw new Error("Subject is required");
    if (!body) throw new Error("Body is required");
    return { to, subject, body };
  })
  .handler(async ({ data }): Promise<SendOutreachResult> => {
    const { callTool } = await import("@/lib/app-data/client.server");
    const shapes = argShapes(data.to, data.subject, data.body);
    let last: CallToolResult | null = null;
    let login: CallToolResult | null = null;

    for (const tool of TOOLS) {
      for (const args of shapes) {
        const result = await callTool(tool.name, args, {
          connectorType: tool.connectorType,
        });
        if (result.ok) return { ok: true, via: tool.via };
        last = result;
        if (result.loginRequired) login = result;
        if (isUnknownTool(result) || isConnectorUnavailable(result)) break;
        if (!isArgError(result)) break;
      }
    }

    if (login) return asFailure(login);
    if (last) return asFailure(last);
    return { ok: false, error: "Could not send." };
  });
