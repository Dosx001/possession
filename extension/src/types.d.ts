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
      type: "url";
      id: number;
      url: string;
    }
  | {
      type: "window";
      url: string;
      private?: boolean;
    };
