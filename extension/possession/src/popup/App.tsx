import Permissions from "components/Permissions";
import { createSignal, onMount, Show } from "solid-js";

const App = () => {
  const [port, setPort] = createSignal(8080);
  const [ready, setReady] = createSignal(true);
  onMount(() => {
    browser.storage.sync
      .get("port")
      .then((obj: { port?: number }) => {
        if (obj.port) setPort(obj.port);
      })
      .catch(console.error);
  });
  return (
    <div
      style={{ "max-width": window.innerWidth < 64 ? "256px" : "1280px" }}
      class="m-auto"
    >
      <h1 class="text-center">Posession</h1>
      <label>Port: </label>
      <Show
        when={ready()}
        fallback={
          <svg class="-mb-1.5 size-6 animate-spin stroke-4" viewBox="0 0 24 24">
            <path class="stroke-blue-600" d="m12 2a10 10 0 0 1 0 20" />
            <path class="stroke-gray-600" d="m12 2a10 10 0 0 0 0 20" />
          </svg>
        }
      >
        <input
          type="number"
          min="1"
          max="65535"
          value={port()}
          class="mr-2"
          onInput={(e) => {
            const val = e.currentTarget.valueAsNumber;
            if (val < 1 || val > 65535) return;
            if (val != Math.floor(val)) return;
            setPort(e.currentTarget.valueAsNumber);
          }}
        />
        <button
          type="button"
          onClick={() => {
            setReady(false);
            browser.storage.sync.set({ port: port() }).catch(console.error);
            browser.runtime
              .sendMessage(port())
              .catch(console.error)
              .finally(() => setReady(true));
          }}
        >
          Connect
        </button>
      </Show>
      <Permissions />
    </div>
  );
};

export default App;
