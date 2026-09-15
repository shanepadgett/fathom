import { SearchDialog } from "./search-dialog.tsx";
import { SearchList } from "./search-list.tsx";

export interface PaletteCommand {
  title: string;
  shortcut?: string;
  run(): unknown;
}

export function CommandPalette(
  props: { commands: PaletteCommand[]; close(): void },
) {
  return (
    <SearchDialog label="Commands" close={props.close}>
      <SearchList
        items={props.commands}
        label="Find a command"
        placeholder="Find a command…"
        empty="No matching commands."
        searchText={(command) => command.title}
        select={async (command) => {
          await command.run();
          props.close();
        }}
      >
        {(command) => (
          <span class="flex w-full items-center justify-between gap-4">
            <span>{command.title}</span>
            <kbd class="shrink-0 text-muted">{command.shortcut}</kbd>
          </span>
        )}
      </SearchList>
    </SearchDialog>
  );
}
