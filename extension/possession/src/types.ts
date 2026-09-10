export const Permission = {
  Click: 0,
  Current: 1,
  Execute: 2,
  Focused: 3,
  Property: 4,
  Reload: 5,
  Text: 6,
  Url: 7,
  Window: 8,
} as const;
export type PermissionType = (typeof Permission)[keyof typeof Permission];

export function stringfyPermission(permission: PermissionType): string {
  switch (permission) {
    case Permission.Click:
      return "Click";
    case Permission.Current:
      return "Current";
    case Permission.Execute:
      return "Execute";
    case Permission.Focused:
      return "Focused";
    case Permission.Property:
      return "Property";
    case Permission.Reload:
      return "Reload";
    case Permission.Text:
      return "Text";
    case Permission.Url:
      return "Url";
    case Permission.Window:
      return "Window";
    default:
      return "Unknown";
  }
}

export type UrlInfo = {
  url: string;
  valid: boolean;
  permissions: PermissionType[];
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
