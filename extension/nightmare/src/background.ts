browser.runtime.onMessageExternal.addListener(
  (
    msg: { id: number; details: browser.extensionTypes.InjectDetails },
    sender,
    sendResponse,
  ) => {
    if (sender.id !== "@possession") return;
    browser.tabs
      .executeScript(msg.id, msg.details)
      .then(() => {
        sendResponse({});
      })
      .catch(sendResponse);
    return true;
  },
);
