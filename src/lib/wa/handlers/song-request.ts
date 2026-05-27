import { db } from "@/lib/db";
import { sendText } from "@/lib/wa/meta";
import { loadSession, transition, ttlFromNow } from "@/lib/wa/session";

const OFFER_TEXT =
  "Queres pedir uma música para esta aula? Manda o link do Spotify ou diz 'não' para ignorar.";

export async function offerSongRequest(phoneE164: string, yogoClassId: number): Promise<void> {
  const playlist = await db.waClassPlaylist.findUnique({ where: { yogoClassId } });
  if (!playlist || playlist.locked) return;

  const existing = await db.waSongRequest.findFirst({
    where: { contactId: phoneE164, yogoClassId, status: "active" },
  });
  if (existing) return;

  const session = await loadSession(phoneE164);
  const t = await transition(session, {
    state: "AWAIT_SONG_INPUT",
    pendingSongClassId: yogoClassId,
    expiresAt: ttlFromNow(),
  });
  if (!t.ok) return;

  await sendText(phoneE164, OFFER_TEXT);
}
