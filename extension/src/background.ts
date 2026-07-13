let ws: WebSocket;

function init() {
  ws = new WebSocket("ws://localhost:8080");
  ws.onclose = () => {
    setTimeout(init, 1000);
  };
  ws.onmessage = (ev) => {
    const data: Payload = JSON.parse(ev.data);
    switch (data.type) {
      case "ping":
        ws.send("pong");
        break;
      case "click":
        browser.tabs.executeScript({
          code: `document.querySelector("${data.query}")?.click()`,
        });
        break;
      case "current":
        browser.tabs
          .query({ active: true, currentWindow: true })
          .then(([tab]) => {
            ws.send(
              JSON.stringify(
                tab
                  ? { type: "url", payload: tab.url }
                  : { type: "error", payload: "no tab" },
              ),
            );
          });
        break;
      case "execute":
        browser.tabs
          .executeScript({
            code: data.code,
            allFrames: data.frame ?? false,
          })
          .then(() => {
            ws.send(
              JSON.stringify({
                type: "execute",
                payload: "done",
              }),
            );
          })
          .catch((err: Error) => {
            ws.send(
              JSON.stringify({
                type: "error",
                payload: err.message,
              }),
            );
          });
        break;
      case "focused":
        browser.tabs.executeScript({
          code: `browser.runtime.sendMessage({type:"focused",payload:document.activeElement.href})`,
        });
        break;
      case "property":
        browser.tabs.executeScript({
          code:
            `{const e=document.querySelector("${data.query}");` +
            `browser.runtime.sendMessage({type:"text",payload:e?e.${data.prop}:""})}`,
        });
        break;
      case "text":
        browser.tabs.executeScript({
          code:
            `{const e=document.querySelector("${data.query}");` +
            `browser.runtime.sendMessage({type:"text",payload:e?e.innerText:""})}`,
        });
        break;
      case "url":
        browser.tabs.update(data.id, { url: data.url }).then(() => {
          ws.send(
            JSON.stringify({
              type: "url",
              payload: "updated",
            }),
          );
        });
        break;
      case "window":
        browser.windows
          .create({
            url: data.url,
            focused: true,
            incognito: data.private ?? false,
          })
          .then((window) => {
            const tab = (window.tabs ?? [])[0];
            if (tab)
              browser.tabs.onUpdated.addListener(handleUpdate, {
                tabId: tab.id,
                windowId: window.id,
                properties: ["status"],
              });
          });
        break;
      default:
        ws.send(
          JSON.stringify({
            type: "error",
            payload: "unknown type",
          }),
        );
        break;
    }
  };
}

init();

function handleUpdate(
  tabId: number,
  info: browser.tabs._OnUpdatedChangeInfo,
  tab: browser.tabs.Tab,
) {
  if (info.status === "complete") {
    ws.send(
      JSON.stringify({
        id: tab.windowId,
        tabId: tabId,
      }),
    );
    browser.tabs.onUpdated.removeListener(handleUpdate);
  }
}

browser.runtime.onSuspend.addListener(() => {
  ws.close();
});

browser.runtime.onMessage.addListener((message) => {
  ws.send(JSON.stringify(message));
});
