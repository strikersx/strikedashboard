import { describe, expect, it } from "vitest";
import { renderClassList, renderConfirmBook, type YogoClassLite } from "../../../src/lib/wa/render";

function klass(id: number, date: string, time: string, name: string, signups = 0, seats = 10): YogoClassLite {
  return { id, date, start_time: time, class_type: { name }, signup_count: signups, seats };
}

const TODAY = "2026-05-25";
const TOMORROW = "2026-05-26";

describe("renderClassList", () => {
  it("returns text when there are zero classes", () => {
    expect(renderClassList([], TODAY, TOMORROW)).toEqual({
      type: "text",
      body: "Sem aulas disponíveis hoje ou amanhã.",
    });
  });

  it("renders a single HOJE section for ≤10 today only", () => {
    const list = [klass(1, TODAY, "19:30", "Striking"), klass(2, TODAY, "20:30", "MMA")];
    const out = renderClassList(list, TODAY, TOMORROW);
    expect(out.type).toBe("list");
    if (out.type !== "list") throw new Error("type narrow");
    expect(out.sections).toHaveLength(1);
    expect(out.sections[0].title).toBe("HOJE");
    expect(out.sections[0].rows.map((r) => r.id)).toEqual(["1", "2"]);
  });

  it("renders HOJE + AMANHÃ sections when both have classes", () => {
    const list = [klass(1, TODAY, "19:30", "Striking"), klass(2, TOMORROW, "10:00", "BJJ")];
    const out = renderClassList(list, TODAY, TOMORROW);
    if (out.type !== "list") throw new Error("expected list");
    expect(out.sections.map((s) => s.title)).toEqual(["HOJE", "AMANHÃ"]);
  });

  it("falls back to text when a single day has >10 classes (overflow)", () => {
    const eleven = Array.from({ length: 11 }, (_, i) => klass(i + 1, TODAY, "19:30", "Aula"));
    const out = renderClassList(eleven, TODAY, TOMORROW);
    expect(out.type).toBe("text");
    if (out.type !== "text") throw new Error("type narrow");
    expect(out.body).toMatch(/Escreve a hora/);
  });

  it("truncates row titles past 24 chars with ellipsis", () => {
    const out = renderClassList([klass(1, TODAY, "19:30", "Treino muito longo blá blá blá blá")], TODAY, TOMORROW);
    if (out.type !== "list") throw new Error("expected list");
    const row = out.sections[0].rows[0];
    expect(row.title.length).toBeLessThanOrEqual(24);
    expect(row.title.endsWith("…")).toBe(true);
  });

  it("shows seats-left in description when capacity data is present", () => {
    const out = renderClassList([klass(1, TODAY, "19:30", "Striking", 3, 10)], TODAY, TOMORROW);
    if (out.type !== "list") throw new Error("expected list");
    expect(out.sections[0].rows[0].description).toBe("7 lugares");
  });

  it("omits description when capacity is unknown", () => {
    const cl: YogoClassLite = { id: 1, date: TODAY, start_time: "19:30", class_type: { name: "x" } };
    const out = renderClassList([cl], TODAY, TOMORROW);
    if (out.type !== "list") throw new Error("expected list");
    expect(out.sections[0].rows[0].description).toBeUndefined();
  });
});

describe("renderConfirmBook", () => {
  it("renders confirm + cancel buttons with class name and time", () => {
    const out = renderConfirmBook(klass(1, TODAY, "19:30", "Striking"));
    expect(out.type).toBe("button");
    expect(out.bodyText).toContain("Striking");
    expect(out.bodyText).toContain("19:30");
    expect(out.buttons.map((b) => b.id)).toEqual(["confirm_book", "cancel_book"]);
  });

  it("falls back to 'Aula' when class_type is missing", () => {
    const out = renderConfirmBook({ id: 1, date: TODAY, start_time: "19:30" });
    expect(out.bodyText).toContain("Aula");
  });
});
