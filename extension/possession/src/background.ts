import type { Payload } from "types";
import { Permission } from "types";
import { getTab } from "urls";

let ws: WebSocket;

function init() {
  ws = new WebSocket("ws://localhost:8080");
  ws.onclose = () => {
    setTimeout(init, 1000);
  };
  ws.onmessage = (ev: MessageEvent<string>) => {
    let data: Payload;
    try {
      data = JSON.parse(ev.data) as Payload;
    } catch (err) {
      sendErr(err as Error);
      return;
    }
    switch (data.type) {
      case "ping":
        ws.send("pong");
        break;
      case "click":
        getTab(Permission.Click, data.tab)
          .then((tab) =>
            browser.scripting.executeScript({
              target: { tabId: tab.id! },
              args: [data.query],
              func: (query: string) => {
                const el = document.querySelector<HTMLButtonElement>(query);
                if (el) {
                  el.click();
                  return;
                }
                throw new Error("element not found");
              },
            }),
          )
          .then(sendMsg)
          .catch(sendErr);
        break;
      case "current":
        getTab(Permission.Current)
          .then((tab) => {
            sendMsg(tab.url);
          })
          .catch(sendErr);
        break;
      case "execute":
        getTab(Permission.Execute)
          .then((tab) =>
            browser.runtime.sendMessage("@nightmare", {
              id: tab.id,
              details: data.details,
            }),
          )
          .then((resp: { error?: Error }) => {
            if (resp.error) throw resp.error;
            sendMsg();
          })
          .catch(sendErr);
        break;
      case "focused":
        getTab(Permission.Focused)
          .then((tab) =>
            browser.scripting.executeScript({
              target: { tabId: tab.id! },
              func: () => (document.activeElement as HTMLAnchorElement).href,
            }),
          )
          .then(([resp]) => {
            sendMsg(resp.result);
          })
          .catch(sendErr);
        break;
      case "property":
        getTab(Permission.Property)
          .then((tab) =>
            browser.scripting.executeScript({
              target: { tabId: tab.id! },
              args: [data.query, data.prop],
              func: (query: string, prop: string) => {
                const el = document.querySelector<HTMLElement>(query);
                if (!el) throw new Error("element not found");
                const value = el.getAttribute(prop);
                if (value) return value;
                throw new Error("property not found");
              },
            }),
          )
          .then(([resp]) => {
            sendMsg(resp.result);
          })
          .catch(sendErr);
        break;
      case "reload":
        getTab(Permission.Reload, data.tab)
          .then((tab) =>
            browser.tabs.reload(tab.id!).then(() => {
              sendMsg(tab.id);
            }),
          )
          .catch(sendErr);
        break;
      case "text":
        getTab(Permission.Text, data.tab)
          .then((tab) =>
            browser.scripting.executeScript({
              target: { tabId: tab.id! },
              args: [data.query],
              func: (query: string) => {
                const el = document.querySelector<HTMLElement>(query);
                if (el) return el.innerText;
                throw new Error("element not found");
              },
            }),
          )
          .then(([resp]) => {
            sendMsg(resp.result);
          })
          .catch(sendErr);
        break;
      case "url":
        browser.tabs.update(data.tabId, data.url).then(sendMsg).catch(sendErr);
        break;
      case "window":
        browser.windows
          .create(data.win)
          .then((win) => {
            browser.tabs.onUpdated.addListener(handleUpdate, {
              tabId: win.tabs![0].id,
              windowId: win.id,
              properties: ["status"],
            });
          })
          .catch(sendErr);
        break;
      default:
        sendMsg("unknown type", false);
        break;
    }
  };
}

init();

function sendMsg(payload: unknown = "", ok: boolean = true) {
  ws.send(JSON.stringify({ ok, payload }));
}

function sendErr(err: Error) {
  sendMsg(err.message, false);
}

function handleUpdate(
  tabId: number,
  info: browser.tabs._OnUpdatedChangeInfo,
  tab: browser.tabs.Tab,
) {
  if (info.status === "complete") {
    sendMsg({
      id: tab.windowId,
      tabId: tabId,
    });
    browser.tabs.onUpdated.removeListener(handleUpdate);
  }
}

browser.runtime.onSuspend.addListener(() => {
  ws.close();
});

function keepAlive() {
  browser.alarms.create({ when: Date.now() + 29_500 }).catch(console.error);
}
browser.alarms.onAlarm.addListener(keepAlive);
browser.runtime.onStartup.addListener(keepAlive);
browser.runtime.onInstalled.addListener(keepAlive);
