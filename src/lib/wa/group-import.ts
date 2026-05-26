import { normalize } from "@/lib/phone";

export interface ParsedGroupRow {
  phoneE164: string;
  savedName: string | null;
  publicName: string | null;
  groupName: string | null;
  isMyContact: boolean;
  isBusiness: boolean;
  isBlocked: boolean;
  labels: string | null;
  countryCode: string | null;
}

export interface ParseResult {
  rows: ParsedGroupRow[];
  skipped: { line: number; reason: string; raw: string }[];
}

// Expected columns from WhatsApp contacts exporter (Chrome ext / similar):
//   Country Code, Country Name, Phone Number, Formatted Phone, Is My Contact,
//   Saved Name, Public Name, Group Name, Is Blocked, Labels, Last Msg Text,
//   Last Msg Date, Last Msg Type, Last Msg Status, Is Business
// We accept tab- or comma-separated; "Phone Number" comes out of Excel as
// scientific notation (3.51917E+11) so we always prefer "Formatted Phone".
export function parseGroupCsv(input: string): ParseResult {
  const rows: ParsedGroupRow[] = [];
  const skipped: { line: number; reason: string; raw: string }[] = [];

  const text = input.replace(/\r\n/g, "\n").trim();
  if (!text) return { rows, skipped };

  const lines = text.split("\n");
  const delim = detectDelimiter(lines[0]);

  let dataStart = 0;
  const headerFields = splitLine(lines[0], delim).map((f) => f.toLowerCase());
  const isHeader = headerFields.includes("country code") || headerFields.includes("formatted phone");
  if (isHeader) dataStart = 1;

  const col = isHeader ? indexer(headerFields) : defaultIndexer();

  for (let i = dataStart; i < lines.length; i++) {
    const raw = lines[i];
    if (!raw.trim()) continue;
    const fields = splitLine(raw, delim);

    const formatted = col(fields, "formatted phone") ?? col(fields, "phone number");
    const phone = (formatted ?? "").trim();
    if (!phone) {
      skipped.push({ line: i + 1, reason: "missing phone", raw });
      continue;
    }

    const norm = normalize(phone);
    if (!norm.e164) {
      skipped.push({ line: i + 1, reason: `invalid phone "${phone}"`, raw });
      continue;
    }

    rows.push({
      phoneE164: norm.e164,
      savedName: (col(fields, "saved name") ?? "").trim() || null,
      publicName: (col(fields, "public name") ?? "").trim() || null,
      groupName: (col(fields, "group name") ?? "").trim() || null,
      isMyContact: parseBool(col(fields, "is my contact")),
      isBusiness: parseBool(col(fields, "is business")),
      isBlocked: parseBool(col(fields, "is blocked")),
      labels: (col(fields, "labels") ?? "").trim() || null,
      countryCode: (col(fields, "country code") ?? "").trim() || null,
    });
  }

  return { rows, skipped };
}

function detectDelimiter(line: string): string {
  const tabs = (line.match(/\t/g) ?? []).length;
  const commas = (line.match(/,/g) ?? []).length;
  if (tabs >= commas) return "\t";
  return ",";
}

function splitLine(line: string, delim: string): string[] {
  if (delim === "\t") return line.split("\t");
  return parseCsvLine(line);
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuotes = !inQuotes;
      continue;
    }
    if (ch === "," && !inQuotes) { out.push(cur); cur = ""; continue; }
    cur += ch;
  }
  out.push(cur);
  return out;
}

function indexer(header: string[]) {
  const map = new Map<string, number>();
  header.forEach((h, i) => map.set(h.trim().toLowerCase(), i));
  return (fields: string[], name: string): string | undefined => {
    const idx = map.get(name.toLowerCase());
    if (idx == null) return undefined;
    return fields[idx];
  };
}

// Fallback when no header — assume canonical column order.
const DEFAULT_ORDER = [
  "country code",
  "country name",
  "phone number",
  "formatted phone",
  "is my contact",
  "saved name",
  "public name",
  "group name",
  "is blocked",
  "labels",
  "last msg text",
  "last msg date",
  "last msg type",
  "last msg status",
  "is business",
];

function defaultIndexer() {
  return (fields: string[], name: string): string | undefined => {
    const idx = DEFAULT_ORDER.indexOf(name.toLowerCase());
    if (idx === -1) return undefined;
    return fields[idx];
  };
}

function parseBool(v: string | undefined): boolean {
  if (!v) return false;
  return /^(true|1|yes|y)$/i.test(v.trim());
}
