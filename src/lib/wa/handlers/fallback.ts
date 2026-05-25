import { sendText } from "@/lib/wa/meta";

const FALLBACK =
  "Diz reserva para marcar uma aula ou cancelar para desmarcar.";

export async function handleFallback(phoneE164: string): Promise<void> {
  await sendText(phoneE164, FALLBACK);
}
