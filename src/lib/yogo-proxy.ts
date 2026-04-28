export async function proxyToYogo(
  apiPath: string,
  method: string = "GET",
  body?: string | null
): Promise<Response> {
  const base = process.env.YOGO_BASE || "https://api.yogo.dk";
  const token = process.env.YOGO_TOKEN;
  const origin = process.env.YOGO_ORIGIN || "https://strikershouse.yogobooking.pt";

  const url = `${base}/${apiPath}`;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "x-yogo-request-context": "admin",
    "Content-Type": "application/json",
    Accept: "application/json, text/plain, */*",
    Origin: origin,
    Referer: `${origin}/`,
  };

  const res = await fetch(url, {
    method,
    headers,
    body: body || undefined,
  });

  const data = await res.text();

  return new Response(data, {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}
