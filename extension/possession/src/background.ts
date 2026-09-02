import { Payload } from "types";
import { getTab } from "urls";

let ws: WebSocket;

function init() {
  ws = new WebSocket("ws://localhost:8080");
  ws.onclose = () => {
    setTimeout(init, 1000);
  };
  ws.onmessage = (ev) => {
    let data: Payload;
    try {
      data = JSON.parse(ev.data);
    } catch (err) {
      sendErr(err as Error);
      return;
    }
    switch (data.type) {
      case "ping":
        ws.send("pong");
        break;
      case "click":
        getTab()
          .then((tab) =>
            browser.scripting.executeScript({
              target: { tabId: tab.id },
              args: [data.query],
              func: (query: string) => {
                const el = document.querySelector(query);
                if (el) return el.click();
                throw new Error("element not found");
              },
            }),
          )
          .then(() => {
            sendMsg({
              type: "click",
              payload: "ok",
            });
          })
          .catch(sendErr);
        break;
      case "current":
        getTab()
          .then((tab) => sendMsg({ type: "url", payload: tab.url }))
          .catch(sendErr);
        break;
      case "execute":
        getTab()
          .then((tab) =>
            browser.runtime.sendMessage("@nightmare", {
              id: tab.id,
              code: data.code,
            }),
          )
          .then((resp: { error?: Error }) => {
            if (resp.error) throw resp.error;
            sendMsg({
              type: "execute",
              payload: "ok",
            });
          })
          .catch(sendErr);
        break;
      case "focused":
        getTab()
          .then((tab) =>
            browser.scripting.executeScript({
              target: { tabId: tab.id },
              func: () => document.activeElement.href,
            }),
          )
          .then(([resp]) => {
            sendMsg({
              type: "focused",
              payload: resp.result,
            });
          })
          .catch(sendErr);
        break;
      case "property":
        getTab()
          .then((tab) =>
            browser.scripting.executeScript({
              target: { tabId: tab.id },
              args: [data.query, data.prop],
              func: (query: string, prop: string) => {
                const el = document.querySelector(query);
                if (el) return el[prop];
                throw new Error("element not found");
              },
            }),
          )
          .then(([resp]) => {
            sendMsg({
              type: "property",
              payload: resp.result,
            });
          })
          .catch(sendErr);
        break;
      case "reload":
        getTab({ title: data.regex })
          .then((tab) => {
            browser.tabs.reload(tab.id!).then(() => {
              sendMsg({
                type: "reload",
                payload: tab.id,
              });
            });
          })
          .catch(sendErr);
        break;
      case "text":
        getTab()
          .then((tab) =>
            browser.scripting.executeScript({
              target: { tabId: tab.id },
              args: [data.query],
              func: (query: string) => {
                const el = document.querySelector(query);
                if (el) return el.innerText;
                throw new Error("element not found");
              },
            }),
          )
          .then(([resp]) => {
            sendMsg({
              type: "text",
              payload: resp.result,
            });
          })
          .catch(sendErr);
        break;
      case "url":
        browser.tabs
          .update(data.id, { url: data.url })
          .then(() => {
            sendMsg({
              type: "url",
              payload: "updated",
            });
          })
          .catch(sendErr);
        break;
      case "window":
        browser.windows
          .create({
            url: data.url,
            focused: true,
            incognito: data.private ?? false,
          })
          .then((win) => {
            const tab = win.tabs![0];
            if (tab)
              browser.tabs.onUpdated.addListener(handleUpdate, {
                tabId: tab.id,
                windowId: win.id,
                properties: ["status"],
              });
          })
          .catch(sendErr);
        break;
      default:
        sendMsg({
          type: "error",
          payload: "unknown type",
        });
        break;
    }
  };
}

init();

function sendMsg(payload: object) {
  ws.send(JSON.stringify(payload));
}

function sendErr(err: Error) {
  sendMsg({
    type: "error",
    payload: err.message,
  });
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

browser.runtime.onMessage.addListener((msg: object) => {
  sendMsg(msg);
});

function keepAlive() {
  browser.alarms.create({ when: Date.now() + 29_500 });
}
browser.alarms.onAlarm.addListener(keepAlive);
browser.runtime.onStartup.addListener(keepAlive);
browser.runtime.onInstalled.addListener(keepAlive);
