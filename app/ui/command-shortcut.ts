export interface CommandShortcut {
  key: string;
  ctrl: boolean;
  meta: boolean;
  alt: boolean;
  shift: boolean;
}

export function commandShortcut(value: string): CommandShortcut {
  const parts = value
    .toLowerCase()
    .split("+")
    .map((part) => part.trim());
  const key = parts.pop() ?? "";
  if (!/^[a-z0-9,./;=-]$/.test(key)) {
    throw new Error("Command shortcuts require a letter, digit or punctuation key");
  }
  const mac = /mac/i.test(navigator.platform);
  const binding: CommandShortcut = {
    key,
    ctrl: false,
    meta: false,
    alt: false,
    shift: false,
  };
  for (const part of parts) {
    const modifier =
      part === "mod" || part === "cmdorctrl"
        ? mac
          ? "meta"
          : "ctrl"
        : part === "cmd"
          ? "meta"
          : part;
    if (!["ctrl", "meta", "alt", "shift"].includes(modifier)) {
      throw new Error(`Unknown shortcut modifier: ${part}`);
    }
    const name = modifier as "ctrl" | "meta" | "alt" | "shift";
    if (binding[name]) throw new Error(`Duplicate shortcut modifier: ${part}`);
    binding[name] = true;
  }
  if (!binding.ctrl && !binding.meta) {
    throw new Error("Command shortcuts require Mod, Ctrl or Meta");
  }
  return binding;
}

export function shortcutMatches(binding: CommandShortcut, event: KeyboardEvent) {
  // Physical letter/digit codes keep Alt and Shift from changing the key on macOS.
  const code = /^[a-z]$/.test(binding.key)
    ? `Key${binding.key.toUpperCase()}`
    : /^[0-9]$/.test(binding.key)
      ? `Digit${binding.key}`
      : undefined;
  return (
    (code ? event.code === code : event.key.toLowerCase() === binding.key) &&
    event.ctrlKey === binding.ctrl &&
    event.metaKey === binding.meta &&
    event.altKey === binding.alt &&
    event.shiftKey === binding.shift
  );
}

export function shortcutIdentity(binding: CommandShortcut) {
  return JSON.stringify(binding);
}

export function reservedShortcut(binding: CommandShortcut) {
  return (
    !binding.alt &&
    !binding.shift &&
    ["a", "c", "f", "i", "j", "k", "n", "o", "q", "s", "v", "x", "z", ","].includes(binding.key)
  );
}
