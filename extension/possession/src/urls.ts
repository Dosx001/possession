import type { UrlInfo } from "types";

let urls: UrlInfo[] = [];

browser.storage.sync
  .get("urls")
  .then((obj: { urls?: UrlInfo[] }) => {
    urls = obj.urls || [];
  })
  .catch(console.error);

browser.storage.sync.onChanged.addListener(
  (changes: { urls?: browser.storage.StorageChange }) => {
    if (changes.urls)
      urls = (changes.urls.newValue as UrlInfo[] | undefined) || [];
  },
);

export async function getTab(
  query?: browser.tabs._QueryQueryInfo,
): Promise<browser.tabs.Tab> {
  const [tab] = await browser.tabs.query(
    query || { active: true, currentWindow: true },
  );
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (!tab) throw new Error("tab not found");
  if (!tab.url) throw new Error("tab has no url");
  const t_url = new URL(tab.url);
  for (const { url, valid } of urls) {
    if (!valid) continue;
    const u_url = new URL(url);
    if (u_url.protocol !== t_url.protocol) continue;
    if (u_url.protocol !== "file:") {
      if (u_url.hostname !== t_url.hostname) continue;
      if (u_url.pathname === "/") return tab;
    }
    if (t_url.pathname.startsWith(u_url.pathname)) return tab;
  }
  throw new Error(`${tab.url} not allowed`);
}
