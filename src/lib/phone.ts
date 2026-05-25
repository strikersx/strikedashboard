export interface NormalizedPhone {
  e164: string | null;
  variants: string[];
}

const PT_COUNTRY = "351";
const MIN_DIGITS = 7;
const MAX_DIGITS = 15;

export function normalize(input: string): NormalizedPhone {
  if (!input) return { e164: null, variants: [] };

  let digits = input.replace(/[^\d+]/g, "");

  if (digits.startsWith("00")) digits = "+" + digits.slice(2);

  if (digits.startsWith("+")) {
    const rest = digits.slice(1);
    if (!isValidLength(rest) || rest.startsWith("0")) return invalid();
    const e164 = "+" + rest;
    return { e164, variants: variantsFor(e164) };
  }

  if (digits.startsWith(PT_COUNTRY) && isValidLength(digits)) {
    const e164 = "+" + digits;
    return { e164, variants: variantsFor(e164) };
  }

  if (/^\d{9}$/.test(digits)) {
    const e164 = `+${PT_COUNTRY}${digits}`;
    return { e164, variants: variantsFor(e164) };
  }

  return invalid();
}

function isValidLength(digitsOnly: string): boolean {
  return digitsOnly.length >= MIN_DIGITS && digitsOnly.length <= MAX_DIGITS;
}

function invalid(): NormalizedPhone {
  return { e164: null, variants: [] };
}

function variantsFor(e164: string): string[] {
  const withoutPlus = e164.slice(1);
  if (!withoutPlus.startsWith(PT_COUNTRY)) return [e164];
  return Array.from(new Set([e164, withoutPlus, withoutPlus.slice(PT_COUNTRY.length)]));
}
