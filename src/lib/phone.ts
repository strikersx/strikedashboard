export interface NormalizedPhone {
  e164: string | null;
  variants: string[];
}

const PT_COUNTRY = "351";
const PT_FULL_LENGTH = 12;
const PT_NATIONAL_LENGTH = 9;
const MIN_INTL_DIGITS = 8;
const MAX_E164_DIGITS = 15;

export function normalize(input: string): NormalizedPhone {
  if (typeof input !== "string" || !input) return invalid();

  const stripped = input.trim().replace(/[^\d+]/g, "");
  if (!stripped) return invalid();

  let raw = stripped;
  let international = false;

  if (raw.startsWith("+")) {
    international = true;
    raw = raw.slice(1);
  } else if (raw.startsWith("00")) {
    international = true;
    raw = raw.slice(2);
  }

  if (!/^\d+$/.test(raw)) return invalid();
  if (raw.length > MAX_E164_DIGITS) return invalid();

  if (international) {
    if (raw.startsWith(PT_COUNTRY)) {
      if (raw.length !== PT_FULL_LENGTH) return invalid();
    } else if (raw.length < MIN_INTL_DIGITS) {
      return invalid();
    }
    const e164 = "+" + raw;
    return { e164, variants: variantsFor(e164) };
  }

  if (raw.startsWith(PT_COUNTRY) && raw.length === PT_FULL_LENGTH) {
    const e164 = "+" + raw;
    return { e164, variants: variantsFor(e164) };
  }

  if (raw.length === PT_NATIONAL_LENGTH) {
    const e164 = `+${PT_COUNTRY}${raw}`;
    return { e164, variants: variantsFor(e164) };
  }

  return invalid();
}

function invalid(): NormalizedPhone {
  return { e164: null, variants: [] };
}

function variantsFor(e164: string): string[] {
  const withoutPlus = e164.slice(1);
  if (!withoutPlus.startsWith(PT_COUNTRY)) return [e164];
  return Array.from(new Set([e164, withoutPlus, withoutPlus.slice(PT_COUNTRY.length)]));
}
