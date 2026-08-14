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
        browser.tabs
          .executeScript({
            code: `document.querySelector("${data.query}")?.click()`,
          })
          .catch(sendErr);
        break;
      case "current":
        browser.tabs
          .query({ active: true, currentWindow: true })
          .then(([tab]) => {
            sendMsg(
              tab
                ? { type: "url", payload: tab.url }
                : { type: "error", payload: "tab not found" },
            );
          })
          .catch(sendErr);
        break;
      case "execute":
        browser.tabs
          .executeScript({
            code: data.code,
            allFrames: data.frame ?? false,
          })
          .then(() => {
            sendMsg({
              type: "execute",
              payload: "done",
            });
          })
          .catch(sendErr);
        break;
      case "focused":
        browser.tabs
          .executeScript({
            code: `browser.runtime.sendMessage({type:"focused",payload:document.activeElement.href})`,
          })
          .catch(sendErr);
        break;
      case "property":
        browser.tabs
          .executeScript({
            code:
              `{const e=document.querySelector("${data.query}");` +
              `browser.runtime.sendMessage({type:"text",payload:e?e.${data.prop}:""})}`,
          })
          .catch(sendErr);
        break;
      case "reload":
        browser.tabs
          .query({ title: data.regex })
          .then(([tab]) => {
            if (tab) {
              browser.tabs
                .reload(tab.id!)
                .then(() => {
                  sendMsg({
                    type: "reload",
                    payload: tab.id,
                  });
                })
                .catch(sendErr);
            } else sendMsg({ type: "error", payload: "tab not found" });
          })
          .catch(sendErr);
        break;
      case "text":
        browser.tabs
          .executeScript({
            code:
              `{const e=document.querySelector("${data.query}");` +
              `browser.runtime.sendMessage({type:"text",payload:e?e.innerText:""})}`,
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
