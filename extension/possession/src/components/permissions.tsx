import { For, onMount } from "solid-js";
import { createStore, produce } from "solid-js/store";
import type { PermissionType } from "types";
import { Permission, stringfyPermission } from "types";

const Permissions = (props: {
  perms: PermissionType[];
  action: (permissions: PermissionType[]) => void;
}) => {
  let select: HTMLSelectElement;
  const [selected, setSelected] = createStore<PermissionType[]>([]);
  const [items, setItems] = createStore<PermissionType[]>([]);
  onMount(() => {
    setSelected(props.perms);
    setItems(
      Object.values(Permission).filter((item) => !props.perms.includes(item)),
    );
  });
  return (
    <div class="m-2">
      <span class="border-gray rounded-l-md border p-1">
        <select
          ref={(el) => (select = el)}
          class="text-gray cursor-pointer rounded-l-md border-none bg-black"
        >
          <For each={items}>
            {(item) => <option>{stringfyPermission(item)}</option>}
          </For>
        </select>
      </span>
      <span class="border-gray rounded-r-md border bg-green-500 p-1">
        <button
          class="border-none bg-transparent p-0 font-bold text-white"
          onClick={() => {
            if (items.length === 0) return;
            const idx = select.selectedIndex;
            setSelected(
              produce((arr) => {
                arr.push(items[idx]);
                arr.sort();
              }),
            );
            setItems(produce((arr) => arr.splice(idx, 1)));
            props.action(selected);
          }}
        >
          ＋
        </button>
      </span>
      <For each={selected}>
        {(item) => (
          <button
            class="mb-3 ml-1 border-none p-0"
            onClick={() => {
              setSelected(
                produce((arr) => {
                  arr.splice(arr.indexOf(item), 1);
                }),
              );
              setItems(
                produce((arr) => {
                  arr.push(item);
                  arr.sort();
                }),
              );
              props.action(selected);
            }}
          >
            <span class="rounded-l-md border bg-black p-1">
              {stringfyPermission(item)}
            </span>
            <span class="border-gray rounded-r-md border bg-red-500 p-1 font-bold text-white">
              ✕
            </span>
          </button>
        )}
      </For>
    </div>
  );
};

export default Permissions;
