import Permissions from "components/permissions";
import { For, onMount } from "solid-js";
import { createStore, produce } from "solid-js/store";
import type { UrlInfo } from "types";

const App = () => {
  let input: HTMLInputElement;
  const [urls, setUrls] = createStore<UrlInfo[]>([]);
  function addData(item: UrlInfo) {
    setUrls(
      produce((arr) => {
        arr.unshift(item);
      }),
    );
    browser.storage.sync.set({ urls }).catch(console.error);
  }
  function validate(el: HTMLInputElement): boolean {
    try {
      const url = new URL(el.value);
      switch (url.protocol) {
        case "file:":
        case "http:":
        case "https:":
          break;
        default:
          return false;
      }
    } catch {
      return false;
    }
    return true;
  }
  function createUrlInfo(el: HTMLInputElement): UrlInfo {
    return {
      url: el.value,
      valid: validate(el),
      permissions: [],
    };
  }
  onMount(() => {
    browser.storage.sync
      .get("urls")
      .then(({ urls }: { urls?: UrlInfo[] }) => {
        setUrls(urls || []);
      })
      .catch(console.error);
  });
  return (
    <div class="m-auto w-96 max-w-96">
      <h1 class="text-center">Posession</h1>
      <div class="mb-2 flex">
        <input
          ref={(el) => (input = el)}
          class="w-full"
          onKeyPress={(e) => {
            if (!input.value || e.key !== "Enter") return;
            addData(createUrlInfo(input));
            input.value = "";
          }}
        />
        <button
          class="bg-green-500 font-bold text-white"
          onClick={() => {
            if (!input.value) return;
            addData(createUrlInfo(input));
            input.value = "";
          }}
        >
          ＋
        </button>
      </div>
      <div class="border-gray flex h-96 max-h-96 flex-col overflow-auto border bg-black shadow-lg shadow-black">
        <For each={urls}>
          {(item, i) => (
            <>
              <div class="flex">
                <input
                  value={item.url}
                  class="w-full"
                  style={{ color: item.valid ? "" : "red" }}
                  onChange={(e) => {
                    setUrls(
                      produce((arr) => {
                        arr[i()] = createUrlInfo(e.target);
                      }),
                    );
                    browser.storage.sync.set({ urls }).catch(console.error);
                  }}
                />
                <button
                  class="bg-red-500 text-white"
                  onClick={() => {
                    setUrls(
                      produce((arr) => {
                        arr.splice(i(), 1);
                      }),
                    );
                    browser.storage.sync.set({ urls }).catch(console.error);
                  }}
                >
                  ✕
                </button>
              </div>
              <Permissions
                perms={item.permissions}
                action={(perms) => {
                  setUrls(
                    produce((arr) => {
                      arr[i()].permissions = perms;
                    }),
                  );
                  browser.storage.sync.set({ urls }).catch(console.error);
                }}
              />
            </>
          )}
        </For>
      </div>
    </div>
  );
};

export default App;
