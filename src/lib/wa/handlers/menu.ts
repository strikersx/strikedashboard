import { sendButton, sendText } from "@/lib/wa/meta";
import { renderMenu } from "@/lib/wa/render";

const OUTROS_MSG = "Entre em contacto com o número de atendimento.";

// Top-of-funnel menu. Anything the aluno types in IDLE state triggers this
// (dispatch.ts routes here). The 3 buttons map 1:1 to existing flows via
// their `id` values: btn_reservar → handleReservar, btn_agenda →
// handleCancelar, btn_outros → handleOutros.
export async function sendMenu(phoneE164: string): Promise<void> {
  await sendButton(phoneE164, renderMenu());
}

// "Outros" button → static message. No state change. Aluno just writes
// freely afterwards and Marcelo reads via Meta Business Suite.
export async function handleOutros(phoneE164: string): Promise<void> {
  await sendText(phoneE164, OUTROS_MSG);
}
