import { db } from "@/lib/db";
import { sendText } from "@/lib/wa/meta";
import { userBookingsNext24h } from "@/lib/yogo/signups";

const NO_CLASSES =
  "Sem aulas em grupo reservadas nas próximas 24h. Reserva uma com 'reserva' primeiro 🥷";

function formatTime(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${dd} ${hh}:${mm}`;
}

export async function handlePlaylistList(phoneE164: string): Promise<void> {
  const bookings = await userBookingsNext24h(phoneE164);
  if (bookings.length === 0) {
    await sendText(phoneE164, NO_CLASSES);
    return;
  }

  const playlists = await db.waClassPlaylist.findMany({
    where: { yogoClassId: { in: bookings.map((b) => b.yogoClassId) } },
  });
  const byClass = new Map(playlists.map((p) => [p.yogoClassId, p.spotifyPlaylistId]));

  const lines = ["As tuas próximas aulas:", ""];
  let any = false;
  for (let i = 0; i < bookings.length; i++) {
    const b = bookings[i];
    const plId = byClass.get(b.yogoClassId);
    if (!plId) continue;
    lines.push(`${i + 1}. ${formatTime(b.startsAtIso)} — ${b.className}`);
    lines.push(`   https://open.spotify.com/playlist/${plId}`);
    any = true;
  }

  if (!any) {
    await sendText(phoneE164, NO_CLASSES);
    return;
  }

  await sendText(phoneE164, lines.join("\n"));
}
