# Controls

Import from `@fathom/sdk/ui`. Every control takes props and children: no service
lookups, no location reads, no fallback copy. Variants and sizes come from the
design reference in `design/`.

| Control | Use |
| --- | --- |
| `Accordion` | details-based groups; single-open unless `multiple` |
| `Button` | `primary`/`secondary`/`quiet`, `compact`/`small`/`normal`, `iconOnly` |
| `Card` | rounded surface; `content` padding by default, `rows` for SettingRow lists |
| `Checkbox` | native checkbox |
| `Chip` | non-interactive compact label with optional detail |
| `Dialog` | native modal with focus containment and restoration |
| `EmptyState` | muted empty message |
| `Field` | label, description, and error wiring around one control |
| `Icon` | Phosphor glyph with typed names and four sizes |
| `IconButton` | quiet small icon-only `Button`; `label` is required |
| `InlineNotice` | status line or `error` alert |
| `Input` `Select` `Textarea` | form controls; set width at the call site |
| `Menu` | anchored popover menu with sections and roving focus |
| `Meter` | labelled value bar |
| `NavItem` | settings and provider navigation row |
| `ResizableSidebar` | edge handle with pointer, arrow, Home/End, and reset |
| `SettingRow` | label, description, and control row inside a `Card` |
| `SettingsSection` | the frame every settings section renders inside, with optional title and description |
| `ShortcutHint` | keycaps plus the action they run |
| `StatusDot` | tone dot; labelled for state or decorative |
| `Switch` | on/off control; `label` is required |
| `Tabs` | tab strip with roving focus and `aria-pressed` |

```tsx
import { Button, Card, SettingRow, SettingsSection } from "@fathom/sdk/ui";

<SettingsSection title="Example">
  <Card padding="rows">
    <SettingRow label="Theme" description="Choose how your workspace looks.">
      <Button variant="secondary">Change</Button>
    </SettingRow>
  </Card>
</SettingsSection>;
```

## Typography

Role utilities from the SDK's typography sheet. Plugin stylesheets may
`@apply` them; markup may use them as classes.

| Utility | Use |
| --- | --- |
| `type-title` | page and provider headers |
| `type-section-title` | settings section headings |
| `type-eyebrow` | section eyebrows |
| `type-label` | setting row labels |
| `type-description` | setting row descriptions and status copy |
| `type-dense` | dense body copy, nav items, inputs |
| `type-micro` | hints and dividers |
| `type-code` | inline code |
| `type-wordmark` | the product wordmark |

## Icons

```tsx
import { Icon, type IconName } from "@fathom/sdk/ui";

<Icon name="gear" size="toolbar" />;
```

`IconName` is a closed union; extend it when a screen needs a glyph. Sizes are
`small`, `normal`, `large`, and `toolbar`.

## Styling

Use semantic utilities such as `bg-canvas`, `text-ink`, `text-muted`,
`border-line`, and `text-action`, as complete class strings. Each plugin's
utilities compile from its own source files against the SDK theme; plugin CSS
never repeats the reset, fonts, or theme. Keep custom selectors inside a plugin
root class. `Appearance` applies theme and reduced-motion preferences even
without a shell.

## Slots

`Slot` renders a registry: `mode="list"` (default), `mode="keyed"` with
`selected`, or `mode="single"` reading `slots.selected[registry.id]` from
composition with a `defaultId`. Missing or hidden selections render the
fallback, never another entry. `createSlotEntries` exposes the visible list
for navigation. Do not add a global slot for ordinary customization; use props
and children.
