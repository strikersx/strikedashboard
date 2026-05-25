import { yogoFetch } from "@/lib/yogo/fetch";

export async function proxyToYogo(
  apiPath: string,
  method: string = "GET",
  body?: string | null
): Promise<Response> {
  const { status, rawText } = await yogoFetch(apiPath, {
    method: method as "GET" | "POST" | "PUT" | "DELETE" | "PATCH",
    body,
  });

  return new Response(rawText, {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
