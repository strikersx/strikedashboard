# Code Review — Slice 0 (PR #1)

Effort: medium. 5 angles + verification. 11 findings surviving.

```json
[
  {
    "file": "src/lib/phone.ts",
    "line": 13,
    "summary": "Strip regex /[^\\d+]/g preserves '+' anywhere in the string, not only at the start. Multiple embedded or doubled '+' chars survive to be emitted in the returned e164.",
    "failure_scenario": "normalize('++351912345678') → digits stays '++351912345678' → startsWith('+') true → rest='+351912345678' → length 13 OK, no leading '0' → returns e164='++351912345678'. Same for '+351+912345678' → e164='+351+912345678'. Stored downstream as malformed E.164.",
    "severity": "HIGH"
  },
  {
    "file": "src/lib/phone.ts",
    "line": 10,
    "summary": "No runtime guard on input type. Signature claims string but TS doesn't enforce at runtime; non-string input (number from JSON parsing) crashes with TypeError on .replace.",
    "failure_scenario": "Webhook receives JSON like {phone: 912345678} (number). normalize(912345678) throws TypeError: (intermediate value).replace is not a function — crashes the request rather than returning {e164:null}.",
    "severity": "HIGH"
  },
  {
    "file": "src/lib/phone.ts",
    "line": 24,
    "summary": "PT_COUNTRY branch only checks startsWith('351') without bounding the subscriber length to exactly 9. Any 7-15-digit string starting with '351' is accepted as PT.",
    "failure_scenario": "normalize('3515551234') (10 digits, starts with 351) → returns e164='+3515551234'. PT mobiles are exactly 9 subscriber digits = 12 total. This is a malformed PT number that goes downstream and breaks Yogo lookups.",
    "severity": "HIGH"
  },
  {
    "file": "src/lib/phone.ts",
    "line": 24,
    "summary": "Order dependency: PT_COUNTRY branch claims any 9-digit string starting with '351' as PT (with only 6 subscriber digits), preventing fall-through to the 9-digit national branch where it would correctly produce a 12-digit PT number.",
    "failure_scenario": "normalize('351999999') (9 digits, starts with 351) → caught by PT_COUNTRY branch → returns e164='+351999999' (only 6 subscriber digits). Should fall through to the bare-9-digit branch which would produce '+351351999999'. Misclassifies an entire class of inputs.",
    "severity": "MEDIUM"
  },
  {
    "file": "src/lib/phone.ts",
    "line": 15,
    "summary": "'00' → '+' rewrite fires on any 7+ digit input starting with '00', regardless of whether those next digits form a valid country code.",
    "failure_scenario": "normalize('001234567') → digits='001234567' → rewritten to '+1234567' → passes length check (7), no leading '0' → returns e164='+1234567'. A leading '00' is treated as international-call prefix unconditionally, fabricating an international number from possibly local input.",
    "severity": "MEDIUM"
  },
  {
    "file": "src/lib/phone.ts",
    "line": 8,
    "summary": "MIN_DIGITS=7 is below the realistic floor for any international subscriber number. Accepts inputs like '+1234567' as valid E.164.",
    "failure_scenario": "normalize('+1234567') → rest='1234567' (7 digits) → returns e164='+1234567'. ITU-T E.164 minimum useful length is closer to 8-9 with country code; the current floor admits clearly invalid numbers and downstream variants would probe '1234567' against Yogo, wasting calls and risking false matches.",
    "severity": "MEDIUM"
  },
  {
    "file": "src/lib/phone.ts",
    "line": 13,
    "summary": "Regex \\d is ASCII-only by default; full-width digits ('９１２３４５６７８９') and Arabic-Indic digits ('٩١٢٣٤٥٦٧٨٩') are silently stripped to empty without any signal.",
    "failure_scenario": "User on a Japanese/Arabic keyboard pastes a phone in their native digit script. The function silently returns {e164:null} — the user sees the bot say 'Não te encontrámos' with no indication the digits were dropped. Low-frequency for Striker's House but a latent surprise.",
    "severity": "LOW"
  },
  {
    "file": "vitest.config.ts",
    "line": 6,
    "summary": "test.include is restricted to 'tests/**/*.test.ts'; co-located 'src/**/*.test.ts' or '.spec.ts' files will be silently skipped under `npm test`.",
    "failure_scenario": "A future slice adds 'src/lib/wa/parser.test.ts' co-located with the source. Vitest reports no failures because the file isn't matched. CI looks green while behavior is untested.",
    "severity": "LOW"
  },
  {
    "file": "vitest.config.ts",
    "line": 10,
    "summary": "coverage.exclude uses bare relative paths instead of explicit globs. Works today via picomatch contains:true semantics; brittle to vitest version upgrades or file moves.",
    "failure_scenario": "src/lib/yogo-proxy.ts is renamed to src/lib/yogo/proxy.ts during Slice 1 refactor. The exclude silently stops matching, the file appears at 0% coverage, total coverage drops. No config error to alert anyone.",
    "severity": "LOW"
  },
  {
    "file": "vitest.config.ts",
    "line": 9,
    "summary": "coverage.include is scoped to src/lib/**/*.ts only. Future WA bot code in src/app/api/whatsapp/, src/lib/wa/, src/lib/yogo/ might escape the include depending on path.",
    "failure_scenario": "src/lib/wa/* and src/lib/yogo/* ARE under src/lib/** — these are fine. But src/app/api/whatsapp/webhook/route.ts is NOT covered. Untested integration points (route handlers) will not appear in coverage reports — false sense of safety.",
    "severity": "LOW"
  },
  {
    "file": "vitest.config.ts",
    "line": 15,
    "summary": "'@' alias is configured in vitest but the test file uses relative imports ('../../src/lib/phone'). Dead config until a test uses the alias.",
    "failure_scenario": "Not a bug. If a future test does use '@/lib/...', it must also be defined in tsconfig.json paths or typecheck breaks. Worth confirming tsconfig already has '@/*': ['./src/*'] (Angle C confirmed it does — consistent).",
    "severity": "INFO"
  }
]
```

## Must-fix before merge

Findings #1, #2, #3 — these are real bugs that ship if Slice 0 lands as-is.

## Should-fix this PR

Finding #4 (order dependency) — same root cause as #3 (PT branch over-accepts). Single fix resolves both.

Finding #5 (`"00"` over-eager) — easy guard: only rewrite `"00"` → `"+"` if next digits form a known country-code shape OR if length matches a known total.

Finding #6 (`MIN_DIGITS` too low) — bump to 8 or 10. Bounded operational impact.

## Follow-up (not blocking)

Findings #7-11 (full-width digits, vitest config issues) — file as separate follow-ups, not in this PR.
