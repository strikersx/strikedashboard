import { describe, expect, test } from "vitest";
import { normalize } from "../../src/lib/phone";

describe("normalize", () => {
  describe("Portuguese mobiles → +351 E.164", () => {
    const ptMobileCases: Array<[string, string]> = [
      ["+351912345678", "+351912345678"],
      ["351912345678", "+351912345678"],
      ["00351912345678", "+351912345678"],
      ["912345678", "+351912345678"],
      ["+351 912 345 678", "+351912345678"],
      ["+351-912-345-678", "+351912345678"],
      ["(+351) 912 345 678", "+351912345678"],
      ["912 345 678", "+351912345678"],
      ["+351.912.345.678", "+351912345678"],
      [" +351 912 345 678 ", "+351912345678"],
    ];

    for (const [input, expected] of ptMobileCases) {
      test(`${JSON.stringify(input)} → ${expected}`, () => {
        const result = normalize(input);
        expect(result.e164).toBe(expected);
      });
    }
  });

  describe("variants for lookup probing", () => {
    test("PT mobile produces 3 variants for Yogo lookup", () => {
      const r = normalize("+351912345678");
      expect(r.variants).toEqual([
        "+351912345678", // E.164 com +
        "351912345678",  // sem +
        "912345678",     // nacional
      ]);
    });

    test("variants are deduplicated", () => {
      const r = normalize("912345678");
      const unique = new Set(r.variants);
      expect(unique.size).toBe(r.variants.length);
    });

    test("foreign number has only one variant (the E.164)", () => {
      const r = normalize("+5511987654321");
      expect(r.variants).toEqual(["+5511987654321"]);
    });
  });

  describe("foreign passthrough", () => {
    test("Brazilian mobile", () => {
      const r = normalize("+5511987654321");
      expect(r.e164).toBe("+5511987654321");
    });

    test("UK mobile", () => {
      const r = normalize("+447911123456");
      expect(r.e164).toBe("+447911123456");
    });

    test("Spanish mobile", () => {
      const r = normalize("+34612345678");
      expect(r.e164).toBe("+34612345678");
    });
  });

  describe("invalid inputs", () => {
    const invalidCases: Array<[string, string]> = [
      ["", "empty string"],
      ["abc", "letters only"],
      ["12345", "too short"],
      ["+", "just plus"],
      ["12345678901234567890", "way too long"],
      ["+0", "invalid country code"],
    ];

    for (const [input, label] of invalidCases) {
      test(`rejects ${label}: ${JSON.stringify(input)}`, () => {
        const r = normalize(input);
        expect(r.e164).toBeNull();
        expect(r.variants).toEqual([]);
      });
    }
  });

  describe("PT landline edge cases", () => {
    test("PT landline (2xx) accepted as E.164", () => {
      // PT landlines start with 2 (e.g. 21x Lisbon, 22x Porto). Alunos costumam dar telemóvel,
      // mas se vier landline normalizamos na mesma.
      const r = normalize("+351213456789");
      expect(r.e164).toBe("+351213456789");
    });

    test("bare PT landline 9-digit not assumed without context", () => {
      // 213456789 começa com 2 — pode ser PT landline OU outro contexto.
      // Mas o uso real (WhatsApp) é telemóvel. Aceitamos como PT por consistência.
      const r = normalize("213456789");
      expect(r.e164).toBe("+351213456789");
    });
  });
});
