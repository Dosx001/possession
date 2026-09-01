browser.runtime.onMessageExternal.addListener(
  (msg: { id: number; code: string }, sender, sendResponse) => {
    if (sender.id !== "@possession") return;
    browser.tabs
      .executeScript(msg.id, {
        code: msg.code,
      })
      .then(() => sendResponse({}))
      .catch(sendResponse);
    return true;
  },
);
