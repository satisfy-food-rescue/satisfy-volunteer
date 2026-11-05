// Policies and agreements live in Google Drive, which the board keeps as the
// single source of truth, and are shown inside the app rather than copied
// into it. Shared by the web page, which embeds them, and the native app,
// which opens them in the in-app browser.

/** Google's own viewer for a Drive or Docs link, which can sit in an iframe.
 *  Null for anything else (any https page still opens as a link). The file
 *  has to be shared as "Anyone with the link can view". */
export function documentEmbedUrl(url: string): string | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.protocol !== "https:") return null;
  const path = u.pathname;
  if (u.hostname === "drive.google.com") {
    const file = path.match(/^\/file\/d\/([\w-]+)/)?.[1] ?? (path === "/open" ? u.searchParams.get("id") : null);
    if (file && /^[\w-]+$/.test(file)) return `https://drive.google.com/file/d/${file}/preview`;
    const folder = path.match(/^\/drive\/(?:u\/\d+\/)?folders\/([\w-]+)/)?.[1];
    if (folder) return `https://drive.google.com/embeddedfolderview?id=${folder}#list`;
    return null;
  }
  if (u.hostname === "docs.google.com") {
    const doc = path.match(/^\/(document|spreadsheets|presentation)\/d\/([\w-]+)/);
    if (doc) return `https://docs.google.com/${doc[1]}/d/${doc[2]}/preview`;
  }
  return null;
}

/** "Google Drive", "Google Docs" or the site, e.g. "satisfyfoodrescue.org.nz",
 *  for the open-it-elsewhere link. */
export function documentSiteLabel(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    if (host === "drive.google.com") return "Google Drive";
    if (host === "docs.google.com") return "Google Docs";
    return host;
  } catch {
    return "Link";
  }
}
