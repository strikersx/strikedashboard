// Thin Meta Cloud API client. v1 needs sendText (echo + bot replies),
// sendList (class picker), and sendButton (confirm prompts). Template send
// lands with Slice 5 (cron trial follow-up).

import type { WaListPayload, WaButtonPayload } from "./render";

const GRAPH_VERSION = "v21.0";

export interface SendResult {
  ok: boolean;
  status: number;
  body: string;
}

interface MetaSendInput {
  type: string;
  text?: { body: string };
  interactive?: unknown;
  template?: unknown;
}

export async function sendText(toPhoneE164: string, body: string): Promise<SendResult> {
  return send(toPhoneE164, { type: "text", text: { body } });
}

export async function sendList(toPhoneE164: string, payload: WaListPayload): Promise<SendResult> {
  return send(toPhoneE164, {
    type: "interactive",
    interactive: {
      type: "list",
      body: { text: payload.bodyText },
      action: {
        button: payload.buttonText.slice(0, 20),
        sections: payload.sections.map((s) => ({
          title: s.title.slice(0, 24),
          rows: s.rows.map((r) => ({
            id: r.id,
            title: r.title,
            ...(r.description ? { description: r.description } : {}),
          })),
        })),
      },
    },
  });
}

export interface TemplateParameter {
  type: "text";
  text: string;
}

// sendTemplate posts a pre-approved Meta template. The cron uses this for
// trial follow-ups. If the template is not yet approved (G3 pending), Meta
// returns 400 with error code 132xxx -- callers should treat that as a
// TEMPLATE_PENDING audit event, not a hard failure.
export async function sendTemplate(
  toPhoneE164: string,
  templateName: string,
  languageCode: string,
  bodyParameters: TemplateParameter[],
): Promise<SendResult> {
  return send(toPhoneE164, {
    type: "template",
    template: {
      name: templateName,
      language: { code: languageCode },
      components: bodyParameters.length > 0 ? [{ type: "body", parameters: bodyParameters }] : [],
    },
  });
}

export async function sendButton(toPhoneE164: string, payload: WaButtonPayload): Promise<SendResult> {
  return send(toPhoneE164, {
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: payload.bodyText },
      action: {
        buttons: payload.buttons.map((b) => ({
          type: "reply",
          reply: { id: b.id, title: b.title.slice(0, 20) },
        })),
      },
    },
  });
}

async function send(toPhoneE164: string, message: MetaSendInput): Promise<SendResult> {
  const phoneId = process.env.WA_PHONE_NUMBER_ID;
  const token = process.env.WA_ACCESS_TOKEN;
  if (!phoneId || !token) throw new Error("WA_PHONE_NUMBER_ID / WA_ACCESS_TOKEN not configured");

  const recipient = toPhoneE164.startsWith("+") ? toPhoneE164.slice(1) : toPhoneE164;

  const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${phoneId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: recipient,
      ...message,
    }),
  });

  const responseBody = await res.text();
  return { ok: res.ok, status: res.status, body: responseBody };
}
