import { UrlInfo } from "types";

let urls: UrlInfo[] = [];

browser.storage.sync.get("urls").then((obj) => {
  urls = obj.urls || [];
});

browser.storage.sync.onChanged.addListener((changes) => {
  if (changes.urls) urls = changes.urls.newValue || [];
});

export async function getTab(
  query?: browser.tabs._QueryQueryInfo,
): Promise<browser.tabs.Tab> {
  const [tab] = await browser.tabs.query(
    query ?? { active: true, currentWindow: true },
  );
  if (!tab) throw new Error("tab not found");
  if (!tab.url) throw new Error("tab has no url");
  const t_url = new URL(tab.url!);
  for (const { url, valid, prefix } of urls) {
    if (!valid) continue;
    const u_url = new URL((prefix ? "" : "http://") + url);
    if (t_url.hostname === u_url.hostname) {
      if (u_url.pathname === "/") return tab;
      if (u_url.pathname === t_url.pathname) return tab;
    }
  }
  throw new Error(`${tab.url} not allowed`);
}
