type Payload =
  | {
      type: "ping" | "current"  | "focused";
    }
  | {
      type: "click" | "text";
      id: number;
      query: string;
    }
  | {
      type: "execute";
      code: string;
      frame?: boolean;
    }
  | {
      type: "property";
      query: string;
      prop: string;
    }
  | {
      type: "url";
      id: number;
      url: string;
    }
  | {
      type: "reload";
      regex: string;
    }
  | {
      type: "window";
      url: string;
      private?: boolean;
    };
