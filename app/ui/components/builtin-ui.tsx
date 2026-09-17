import type { Accessor, JSX } from "solid-js";

import type { FrontendHost } from "../../sdk/frontend.ts";
import type { BuiltinComponentProps, UIComponent } from "../../sdk/ui-components.ts";

import { createSignal } from "solid-js";
import { render } from "solid-js/web";

import { ConnectionRow } from "./connection-row.tsx";
import { DiffPreview } from "./diff-preview.tsx";
import { Markdown } from "./markdown.tsx";
import { MessageCard } from "./message-card.tsx";
import { Button, Field, IconButton } from "./primitives.tsx";
import { SplitPane } from "./split-pane.tsx";
import { TerminalPanel } from "./terminal.tsx";

function component<Props>(
  view: (props: Accessor<Props>, host: FrontendHost) => JSX.Element,
): UIComponent<Props> {
  return (element, host, initial) => {
    const [props, setProps] = createSignal(initial, { equals: false });
    const unmount = render(() => view(props, host), element);
    let active = true;
    return {
      update(next) {
        if (active) setProps(() => next);
      },
      dispose() {
        if (!active) return;
        active = false;
        unmount();
      },
    };
  };
}

export const builtinComponents = {
  "fathom.icon-button": component<BuiltinComponentProps["fathom.icon-button"]>((props) => (
    <IconButton
      name={props().name}
      label={props().label}
      toolbar={props().toolbar}
      disabled={props().disabled}
      pressed={props().pressed}
      expanded={props().expanded}
      onClick={() => props().onClick()}
    />
  )),
  "fathom.connection-row": component<BuiltinComponentProps["fathom.connection-row"]>((props) => (
    <ConnectionRow name={props().name} status={props().status} avatar={props().avatar}>
      {props().actions}
    </ConnectionRow>
  )),
  "fathom.split-pane": component<BuiltinComponentProps["fathom.split-pane"]>((props) => (
    <SplitPane
      first={props().first}
      second={props().second}
      label={props().label}
      width={props().width}
      minFirst={props().minFirst}
      minSecond={props().minSecond}
      firstVisible={props().firstVisible}
      secondVisible={props().secondVisible}
      onResize={(width) => props().onResize?.(width)}
    />
  )),
  "fathom.terminal": component<BuiltinComponentProps["fathom.terminal"]>((props, host) => (
    <TerminalPanel
      transport={host}
      sessionId={props().sessionId}
      theme={props().theme}
      autoStart={props().autoStart ?? false}
      close={() => props().onClose()}
      error={(error) => props().onError(error)}
    />
  )),
  "fathom.diff": component<BuiltinComponentProps["fathom.diff"]>((props) => (
    <DiffPreview patch={props().patch} />
  )),
  "fathom.message-card": component<BuiltinComponentProps["fathom.message-card"]>((props) => (
    <MessageCard
      author={props().author}
      createdAt={props().createdAt}
      agent={props().agent ?? false}
      working={props().working ?? false}
      model={props().model}
    >
      <Markdown text={props().text} />
    </MessageCard>
  )),
  "fathom.button": component<BuiltinComponentProps["fathom.button"]>((props) => (
    <Button
      variant={props().variant}
      size={props().size}
      disabled={props().disabled}
      onClick={() => props().onClick()}
    >
      {props().label}
    </Button>
  )),
  "fathom.text-field": component<BuiltinComponentProps["fathom.text-field"]>((props) => (
    <Field label={props().label} hint={props().hint}>
      <input
        value={props().value}
        placeholder={props().placeholder}
        disabled={props().disabled}
        onInput={(event) => props().onInput(event.currentTarget.value)}
      />
    </Field>
  )),
};
