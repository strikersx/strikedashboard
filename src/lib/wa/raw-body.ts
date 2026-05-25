// Meta's HMAC signature is computed over the raw request bytes. Reading via
// req.json() consumes the stream and rebuilds an object with normalised keys,
// so the recomputed HMAC would no longer match. Always read the body via
// req.text() exactly once and pass the same string to both the verifier and
// the JSON parser.
export async function readRawBody(req: Request): Promise<string> {
  return req.text();
}
