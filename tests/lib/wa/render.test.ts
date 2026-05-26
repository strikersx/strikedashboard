import { describe, expect, it } from "vitest";
import {
  renderAgendaList,
  renderClassList,
  renderConfirmBook,
  renderConfirmCancel,
  renderMenu,
  type SignupLite,
  type YogoClassLite,
} from "../../../src/lib/wa/render";

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

function signup(id: number, date: string, time: string, name: string): SignupLite {
  return { id, klass: { id: id * 100, date, start_time: time, class_type: { name } } };
}

function agendaSignup(id: number, date: string, time: string, name: string): SignupLite {
  return { id, klass: { id: id * 100, date, start_time: time, class_type: { name } } };
}

describe("renderAgendaList", () => {
  it("text response when empty", () => {
    expect(renderAgendaList([])).toEqual({
      type: "text",
      body: "Não tens aulas marcadas.",
    });
  });

  it("renders an interactive list for ≤10 signups (all eligible)", () => {
    const now = new Date("2026-05-26T10:00:00");
    const list = [
      agendaSignup(1, "2026-05-26", "19:30", "Striking"),
      agendaSignup(2, "2026-05-27", "10:00", "BJJ"),
    ];
    const out = renderAgendaList(list.map((s) => ({ ...s, cancellable: true })), now);
    expect(out.type).toBe("list");
    if (out.type !== "list") throw new Error("type narrow");
    expect(out.sections).toHaveLength(1);
    expect(out.sections[0].title).toBe("PRÓXIMAS");
    expect(out.sections[0].rows.map((r) => r.id)).toEqual(["1", "2"]);
    expect(out.sections[0].rows[0].title.startsWith("⏰")).toBe(false);
  });

  it("marks rows as locked when cancellable=false", () => {
    const now = new Date("2026-05-26T19:00:00");
    const list = [
      { ...agendaSignup(1, "2026-05-26", "19:30", "Striking"), cancellable: false },
      { ...agendaSignup(2, "2026-05-26", "21:30", "Boxing"), cancellable: true },
    ];
    const out = renderAgendaList(list, now);
    if (out.type !== "list") throw new Error("expected list");
    expect(out.sections[0].rows[0].id).toBe("1_locked");
    expect(out.sections[0].rows[0].title.startsWith("⏰")).toBe(true);
    expect(out.sections[0].rows[0].description).toBe("em breve · não cancelável");
    expect(out.sections[0].rows[1].id).toBe("2");
    expect(out.sections[0].rows[1].title.startsWith("⏰")).toBe(false);
  });

  it("falls back to free-text DD/MM HH:MM past 10 signups", () => {
    const now = new Date("2026-05-26T10:00:00");
    const list = Array.from({ length: 11 }, (_, i) =>
      ({ ...agendaSignup(i + 1, "2026-05-27", "19:30", "Aula"), cancellable: true }),
    );
    const out = renderAgendaList(list, now);
    expect(out.type).toBe("text");
    if (out.type !== "text") throw new Error("type narrow");
    expect(out.body).toMatch(/DD\/MM HH:MM/);
  });

  it("renders single-section list when only 1 signup", () => {
    const now = new Date("2026-05-26T10:00:00");
    const list = [{ ...agendaSignup(1, "2026-05-26", "19:30", "Striking"), cancellable: true }];
    const out = renderAgendaList(list, now);
    if (out.type !== "list") throw new Error("expected list");
    expect(out.sections).toHaveLength(1);
    expect(out.sections[0].title).toBe("PRÓXIMAS");
  });
});

describe("renderConfirmCancel", () => {
  it("renders confirm + abort buttons", () => {
    const out = renderConfirmCancel(signup(1, TODAY, "19:30", "Striking"));
    expect(out.buttons.map((b) => b.id)).toEqual(["confirm_cancel", "abort_cancel"]);
    expect(out.bodyText).toContain("Striking");
    expect(out.bodyText).toContain("19:30");
  });
});

describe("renderMenu", () => {
  it("renders a 3-button menu with the expected ids and titles", () => {
    const out = renderMenu();
    expect(out.type).toBe("button");
    expect(out.bodyText).toBe("Olá! O que precisas?");
    expect(out.buttons).toEqual([
      { id: "btn_reservar", title: "Reservar" },
      { id: "btn_agenda", title: "Minha agenda" },
      { id: "btn_outros", title: "Outros" },
    ]);
  });
});
