import { describe, expect, it } from "vitest";
import { parseIntent } from "../../../src/lib/wa/parser";

describe("parseIntent — keywords", () => {
  it.each([
    "reserva",
    "reservar",
    "Reserva",
    "RESERVAR",
    "reserva!",
    "  reserva.  ",
    "marcar",
    "agendar",
  ])("recognises %s as reservar", (input) => {
    expect(parseIntent({ type: "text", text: { body: input } })).toEqual({ kind: "reservar" });
  });

  it.each(["cancelar", "Cancela", "DESMARCAR", "cancelar."])("recognises %s as cancelar", (input) => {
    expect(parseIntent({ type: "text", text: { body: input } })).toEqual({ kind: "cancelar" });
  });

  it("falls through to text when no keyword matches", () => {
    expect(parseIntent({ type: "text", text: { body: "olá tudo bem" } })).toEqual({
      kind: "text",
      body: "olá tudo bem",
    });
  });

  it("does not treat 'reserva' embedded in a sentence as keyword", () => {
    expect(parseIntent({ type: "text", text: { body: "quero fazer uma reserva" } })).toEqual({
      kind: "text",
      body: "quero fazer uma reserva",
    });
  });
});

describe("parseIntent — interactive replies", () => {
  it("extracts list reply id", () => {
    expect(
      parseIntent({
        type: "interactive",
        interactive: { type: "list_reply", list_reply: { id: "2475704" } },
      }),
    ).toEqual({ kind: "list_pick", id: "2475704" });
  });

  it("extracts button reply id", () => {
    expect(
      parseIntent({
        type: "interactive",
        interactive: { type: "button_reply", button_reply: { id: "confirm_book" } },
      }),
    ).toEqual({ kind: "button", id: "confirm_book" });
  });

  it("list reply wins when both present (defensive)", () => {
    expect(
      parseIntent({
        type: "interactive",
        interactive: {
          list_reply: { id: "L1" },
          button_reply: { id: "B1" },
        },
      }),
    ).toEqual({ kind: "list_pick", id: "L1" });
  });
});
