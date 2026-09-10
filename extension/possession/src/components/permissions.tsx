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
      <span class="border-gray w-fit rounded border-1 bg-black p-1">
        <select
          ref={(el) => (select = el)}
          class="text-gray cursor-pointer border-none bg-black"
        >
          <For each={items}>
            {(item) => <option>{stringfyPermission(item)}</option>}
          </For>
        </select>
        <span class="border-gray mx-1 border-1 border-r-0" />
        <button
          class="border-none bg-transparent"
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
            class="mb-1 ml-1"
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
            {stringfyPermission(item)}│✕
          </button>
        )}
      </For>
    </div>
  );
};

export default Permissions;
