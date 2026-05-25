import { afterEach, describe, expect, it } from "vitest";
import { isWaEnabled } from "../../../src/lib/wa/config";

const ORIGINAL = process.env.WA_ENABLED;

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.WA_ENABLED;
  else process.env.WA_ENABLED = ORIGINAL;
});

describe("isWaEnabled", () => {
  it("defaults to true when env is unset", () => {
    delete process.env.WA_ENABLED;
    expect(isWaEnabled()).toBe(true);
  });

  it("returns true for 'true'", () => {
    process.env.WA_ENABLED = "true";
    expect(isWaEnabled()).toBe(true);
  });

  it("returns false only for the literal 'false'", () => {
    process.env.WA_ENABLED = "false";
    expect(isWaEnabled()).toBe(false);
  });

  it("treats any other value as enabled (kill switch is opt-in)", () => {
    process.env.WA_ENABLED = "0";
    expect(isWaEnabled()).toBe(true);
    process.env.WA_ENABLED = "off";
    expect(isWaEnabled()).toBe(true);
    process.env.WA_ENABLED = "";
    expect(isWaEnabled()).toBe(true);
  });

  it("is case-sensitive: 'False' counts as enabled", () => {
    process.env.WA_ENABLED = "False";
    expect(isWaEnabled()).toBe(true);
  });
});
