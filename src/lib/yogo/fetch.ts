export interface YogoResponse<T = unknown> {
  ok: boolean;
  status: number;
  data: T;
  rawText: string;
}

export interface YogoFetchInit {
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  body?: string | null;
}

export async function yogoFetch<T = unknown>(
  apiPath: string,
  init: YogoFetchInit = {},
): Promise<YogoResponse<T>> {
  const base = process.env.YOGO_BASE || "https://api.yogo.dk";
  const token = process.env.YOGO_TOKEN;
  const origin = process.env.YOGO_ORIGIN || "https://strikershouse.yogobooking.pt";

  const res = await fetch(`${base}/${apiPath}`, {
    method: init.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "x-yogo-request-context": "admin",
      "Content-Type": "application/json",
      Accept: "application/json, text/plain, */*",
      Origin: origin,
      Referer: `${origin}/`,
    },
    body: init.body ?? undefined,
  });

  const rawText = await res.text();
  let data: unknown;
  if (!rawText) {
    data = null;
  } else {
    try {
      data = JSON.parse(rawText);
    } catch {
      data = rawText;
    }
  }

  return { ok: res.ok, status: res.status, data: data as T, rawText };
}
