import { readFile } from "fs/promises";
import { join } from "path";

/**
 * Public privacy notice page for StrikeLab (pt-PT).
 * Renders the markdown content from the vault as plain HTML.
 * Route: /privacy/strikelab
 */
export default async function PrivacyStrikelabPage() {
  const vaultPath = join(process.cwd(), "strikedash_vault/gdpr/Privacy-Notice-StrikeLab.md");
  let markdown: string;
  try {
    const raw = await readFile(vaultPath, "utf-8");
    // Strip frontmatter
    markdown = raw.replace(/^---[\s\S]*?---\n/, "");
  } catch {
    markdown = "Aviso de privacidade não disponível. Contacta ricardo@strikershouse.pt.";
  }

  // Simple markdown-to-HTML: tables, headings, paragraphs, lists, bold, links
  const html = markdown
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-emerald-400 underline">$1</a>')
    .replace(/^\| (.+) \|$/gm, (match) => {
      const cells = match.split("|").filter((c) => c.trim());
      return "<tr>" + cells.map((c) => `<td class="border border-zinc-800 px-3 py-1.5 text-sm">${c.trim()}</td>`).join("") + "</tr>";
    })
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/^> (.+)$/gm, "<blockquote class='border-l-2 border-zinc-700 pl-3 text-zinc-400 text-sm'>$1</blockquote>")
    .replace(/\n{2,}/g, "</p><p>")
    .replace(/\n/g, "<br/>");

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <p className="text-zinc-600 text-xs mb-8">
          Striker's House · Aviso de Privacidade · StrikeLab
        </p>
        <div
          className="prose prose-invert prose-sm max-w-none [&_h1]:text-xl [&_h1]:font-bold [&_h1]:mt-8 [&_h1]:mb-4 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mt-6 [&_h2]:mb-3 [&_h3]:text-base [&_h3]:font-medium [&_h3]:mt-4 [&_h3]:mb-2 [&_table]:w-full [&_td]:text-zinc-300 [&_li]:text-zinc-300 [&_strong]:text-white [&_a]:text-emerald-400"
          dangerouslySetInnerHTML={{ __html: `<p>${html}</p>` }}
        />
      </div>
    </div>
  );
}
