export type UrlInfo = {
  url: string;
  valid: boolean;
  prefix: boolean;
};

export type Payload =
  | {
      type: "ping" | "current" | "focused";
    }
  | {
      type: "click" | "text";
      tab?: browser.tabs._QueryQueryInfo;
      query: string;
    }
  | {
      type: "execute";
      details: browser.extensionTypes.InjectDetails;
    }
  | {
      type: "property";
      query: string;
      prop: string;
    }
  | {
      type: "url";
      tabId: number;
      url: browser.tabs._UpdateUpdateProperties;
    }
  | {
      type: "reload";
      tab: browser.tabs._QueryQueryInfo;
    }
  | {
      type: "window";
      win: browser.windows._CreateCreateData;
    };
