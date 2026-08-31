import { For, onMount } from "solid-js";
import { createStore, produce } from "solid-js/store";
import { UrlInfo } from "types";

const App = () => {
  let input!: HTMLInputElement;
  const [urls, setUrls] = createStore<UrlInfo[]>([]);
  function addData(item: UrlInfo) {
    setUrls(
      produce((arr) => {
        arr.push(item);
      }),
    );
    browser.storage.sync.set({ urls });
  }
  function validate(el: HTMLInputElement): UrlInfo {
    const url = el.value;
    try {
      const prefix = /^https?:\/\//.test(url);
      new URL((prefix ? "" : "http://") + url);
      return { url, valid: true, prefix };
    } catch {
      return { url, valid: false, prefix: false };
    }
  }
  onMount(() => {
    browser.storage.sync.get("urls").then(({ urls }) => {
      setUrls(urls || []);
    });
  });
  return (
    <div class="m-auto max-w-96">
      <h1 class="text-center">Posession</h1>
      <div class="mb-2 flex">
        <input
          ref={input}
          class="w-full"
          onKeyPress={(e) => {
            if (!input.value || e.key !== "Enter") return;
            addData(validate(input));
            input.value = "";
          }}
        />
        <button
          onClick={() => {
            if (!input.value) return;
            addData(validate(input));
            input.value = "";
          }}
        >
          ＋
        </button>
      </div>
      <div class="border-gray flex h-96 max-h-96 flex-col overflow-auto border bg-black shadow-lg shadow-black">
        <For each={urls}>
          {(item, i) => (
            <div class="flex">
              <input
                value={item.url}
                class="w-full"
                onChange={(e) => {
                  setUrls(
                    produce((arr) => {
                      arr[i()] = validate(e.target);
                    }),
                  );
                  browser.storage.sync.set({ urls });
                }}
              />
              <button
                onClick={() => {
                  setUrls(
                    produce((arr) => {
                      arr.splice(i(), 1);
                    }),
                  );
                  browser.storage.sync.set({ urls });
                }}
              >
                ✕
              </button>
            </div>
          )}
        </For>
      </div>
    </div>
  );
};

export default App;
