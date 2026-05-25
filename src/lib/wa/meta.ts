// Thin Meta Cloud API client. v1 only needs sendText for the echo handler;
// list/button/template helpers land in Slices 3+.

const GRAPH_VERSION = "v21.0";

export interface SendResult {
  ok: boolean;
  status: number;
  body: string;
}

export async function sendText(toPhoneE164: string, body: string): Promise<SendResult> {
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
      type: "text",
      text: { body },
    }),
  });

  const responseBody = await res.text();
  return { ok: res.ok, status: res.status, body: responseBody };
}
