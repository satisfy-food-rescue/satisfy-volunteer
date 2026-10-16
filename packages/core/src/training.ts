// The online module completion gate, shared by the web page and the native
// screen so both lock the confirm box the same way: the volunteer has to read
// to the end of the content and open every video or link before they can tick
// it off. It is a nudge, not proof: the server cannot see a video being
// watched, so it records the volunteer's confirmation as before.

export type ModuleLink = { id: string; label: string; url: string };

export type GateStep = { key: "read" | "watch"; label: string; done: boolean };

export type Gate = { ready: boolean; steps: GateStep[] };

export function completionGate(p: { hasContent: boolean; readToEnd: boolean; links: readonly ModuleLink[]; opened: ReadonlySet<string> }): Gate {
  const steps: GateStep[] = [];
  if (p.hasContent) steps.push({ key: "read", label: "Read to the end", done: p.readToEnd });
  if (p.links.length > 0) {
    const opened = p.links.filter((l) => p.opened.has(l.id)).length;
    const total = p.links.length;
    const noun = p.links.every((l) => isVideo(l.url)) ? (total === 1 ? "the video" : "the videos") : total === 1 ? "the link" : "every link";
    steps.push({ key: "watch", label: total === 1 ? `Open ${noun}` : `Open ${noun} (${opened} of ${total})`, done: opened === total });
  }
  return { ready: steps.every((s) => s.done), steps };
}

const VIDEO_HOSTS = ["youtube.com", "youtu.be", "vimeo.com"];

function host(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\.|^m\./, "");
  } catch {
    return null;
  }
}

export function isVideo(url: string): boolean {
  const h = host(url);
  return h !== null && VIDEO_HOSTS.some((v) => h === v || h.endsWith(`.${v}`));
}

/** "YouTube video", "Vimeo video" or the site, e.g. "mpi.govt.nz". */
export function linkKindLabel(url: string): string {
  const h = host(url);
  if (!h) return "Link";
  if (h === "youtu.be" || h.endsWith("youtube.com")) return "YouTube video";
  if (h.endsWith("vimeo.com")) return "Vimeo video";
  return h;
}

/** Module content is paragraphs separated by a blank line, as typed in admin. */
export function moduleParagraphs(content: string | null): string[] {
  return (content ?? "")
    .split(/\r?\n\s*\r?\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}
