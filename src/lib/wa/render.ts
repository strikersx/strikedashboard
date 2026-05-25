// WA interactive payloads. List rows are 24c title / 72c description / max 10
// rows per section. We use two sections (HOJE, AMANHÃ) so practical cap is 20
// classes; anything past that falls back to a text instruction.

export interface YogoClassLite {
  id: number;
  date: string;
  start_time: string;
  class_type?: { name?: string } | null;
  signup_count?: number;
  seats?: number;
}

export interface WaListRow {
  id: string;
  title: string;
  description?: string;
}

export interface WaListSection {
  title: string;
  rows: WaListRow[];
}

export interface WaListPayload {
  type: "list";
  bodyText: string;
  buttonText: string;
  sections: WaListSection[];
}

export interface WaTextPayload {
  type: "text";
  body: string;
}

export interface WaButtonPayload {
  type: "button";
  bodyText: string;
  buttons: Array<{ id: string; title: string }>;
}

const MAX_ROW_TITLE = 24;
const MAX_ROW_DESC = 72;
const MAX_ROWS_PER_SECTION = 10;

export function renderClassList(
  classes: YogoClassLite[],
  todayDate: string,
  tomorrowDate: string,
): WaListPayload | WaTextPayload {
  const today = classes.filter((c) => c.date === todayDate).slice(0, MAX_ROWS_PER_SECTION);
  const tomorrow = classes.filter((c) => c.date === tomorrowDate).slice(0, MAX_ROWS_PER_SECTION);

  const overflowToday = classes.filter((c) => c.date === todayDate).length > MAX_ROWS_PER_SECTION;
  const overflowTomorrow = classes.filter((c) => c.date === tomorrowDate).length > MAX_ROWS_PER_SECTION;

  if (today.length === 0 && tomorrow.length === 0) {
    return { type: "text", body: "Sem aulas disponíveis hoje ou amanhã." };
  }

  if (overflowToday || overflowTomorrow) {
    const sample = (today[0] ?? tomorrow[0])?.start_time ?? "19:30";
    return {
      type: "text",
      body: `Temos muitas aulas. Escreve a hora (ex: ${sample}) para reservar directamente.`,
    };
  }

  const sections: WaListSection[] = [];
  if (today.length > 0) sections.push({ title: "HOJE", rows: today.map(toRow) });
  if (tomorrow.length > 0) sections.push({ title: "AMANHÃ", rows: tomorrow.map(toRow) });

  return {
    type: "list",
    bodyText: "Escolhe a aula para reservar:",
    buttonText: "Ver aulas",
    sections,
  };
}

export function renderConfirmBook(klass: YogoClassLite): WaButtonPayload {
  const name = klass.class_type?.name ?? "Aula";
  const time = `${klass.start_time}`;
  return {
    type: "button",
    bodyText: truncate(`Confirmas? ${name} · ${time}`, 1024),
    buttons: [
      { id: "confirm_book", title: "Sim, reservar" },
      { id: "cancel_book", title: "Cancelar" },
    ],
  };
}

export interface SignupLite {
  id: number;
  klass: YogoClassLite;
}

// Cancel picker. N=1 still shows a confirm prompt (spec: mandatory confirm
// even for a single signup, so a stray tap doesn't burn the slot). N=2-10
// list. N>10 free-text fallback handled by the caller.
export function renderCancelList(signups: SignupLite[]): WaListPayload | WaTextPayload {
  if (signups.length === 0) {
    return { type: "text", body: "Sem aulas marcadas nos próximos dias." };
  }
  if (signups.length > MAX_ROWS_PER_SECTION * 2) {
    return {
      type: "text",
      body: "Tens muitas marcações. Escreve a data e hora (DD/MM HH:MM) da aula a cancelar.",
    };
  }
  const rows = signups.slice(0, MAX_ROWS_PER_SECTION * 2).map((s) => ({
    id: String(s.id),
    title: truncate(`${s.klass.start_time} ${s.klass.class_type?.name ?? "Aula"}`, MAX_ROW_TITLE),
    description: truncate(s.klass.date, MAX_ROW_DESC),
  }));
  const sections: WaListSection[] =
    rows.length <= MAX_ROWS_PER_SECTION
      ? [{ title: "PRÓXIMAS", rows }]
      : [
          { title: "PRÓXIMAS", rows: rows.slice(0, MAX_ROWS_PER_SECTION) },
          { title: "DEPOIS", rows: rows.slice(MAX_ROWS_PER_SECTION) },
        ];
  return {
    type: "list",
    bodyText: "Escolhe a aula para cancelar:",
    buttonText: "Ver marcações",
    sections,
  };
}

export function renderConfirmCancel(signup: SignupLite): WaButtonPayload {
  const name = signup.klass.class_type?.name ?? "Aula";
  return {
    type: "button",
    bodyText: truncate(`Cancelar ${name} · ${signup.klass.date} ${signup.klass.start_time}?`, 1024),
    buttons: [
      { id: "confirm_cancel", title: "Sim, cancelar" },
      { id: "abort_cancel", title: "Não" },
    ],
  };
}

function toRow(klass: YogoClassLite): WaListRow {
  const name = klass.class_type?.name ?? "Aula";
  const title = truncate(`${klass.start_time} ${name}`, MAX_ROW_TITLE);
  const seatsLeft =
    typeof klass.seats === "number" && typeof klass.signup_count === "number"
      ? klass.seats - klass.signup_count
      : null;
  const description = seatsLeft !== null ? truncate(`${seatsLeft} lugares`, MAX_ROW_DESC) : undefined;
  return { id: String(klass.id), title, description };
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1) + "…";
}
