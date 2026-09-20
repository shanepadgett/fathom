export interface TokenSection {
  title: string;
  category: string;
  kind: string;
  description?: string;
  tokens?: string[];
  prefix?: string;
}

export const categories = [
  "Colors",
  "Typography",
  "Layout & effects",
  "Animation",
];

export function tokenSections(names: string[]): TokenSection[] {
  return [
    {
      title: "Semantic geometry",
      category: "Layout & effects",
      kind: "geometry",
      tokens: [...names].filter(
        (name) =>
          /^--spacing-[a-z]/.test(name) ||
          name.startsWith("--container-") ||
          name.startsWith("--grid-") ||
          name.startsWith("--blur-"),
      ),
      description:
        "Shared product dimensions and effects. Viewer-only values are excluded.",
    },
    {
      title: "Durations",
      category: "Animation",
      kind: "motion",
      prefix: "--motion-duration-",
      description:
        "Fast: feedback and exits. Normal: modals and accordions. Slow: drawer entrances. Reduced motion sets these to zero. Use duration-(--motion-duration-normal) in Tailwind.",
    },
    {
      title: "Easing",
      category: "Animation",
      kind: "motion",
      prefix: "--ease-",
      description:
        "Enter slows into place. Exit speeds away. Standard changes in place. Tailwind: ease-enter, ease-exit, ease-standard.",
    },
    {
      title: "Movement and scale",
      category: "Animation",
      kind: "motion",
      tokens: [...names].filter(
        (name) =>
          name.startsWith("--motion-distance-") ||
          name.startsWith("--motion-scale-"),
      ),
      description:
        "Small movement and subtle scale for modal entrances. Full-width drawer travel belongs to the component, not a distance token.",
    },
    {
      title: "Color scales",
      category: "Colors",
      kind: "palette",
      description:
        "Deep teal with neutral grays. Each column runs from 50 to 950.",
      tokens: [...names].filter((name) => /^--color-.+-\d+$/.test(name)),
    },
    {
      title: "Color roles",
      category: "Colors",
      kind: "roles",
      description:
        "The values used by components. These follow the light / dark switch.",
      tokens: [...names].filter((name) =>
        name.startsWith("--color-") && !/-\d+$/.test(name)
      ),
    },
    {
      title: "Font families",
      category: "Typography",
      kind: "family",
      prefix: "--font-",
      description: "Space Grotesk for UI and prose. Fragment Mono for code.",
    },
    {
      title: "Font sizes",
      category: "Typography",
      kind: "size",
      prefix: "--text-",
      description: "16px is the default. Only these samples change size.",
    },
    {
      title: "Font weights",
      category: "Typography",
      kind: "weight",
      prefix: "--font-weight-",
      description:
        "UI weights in Space Grotesk. Code uses Fragment Mono at 400.",
    },
    {
      title: "Line heights",
      category: "Typography",
      kind: "leading",
      prefix: "--leading-",
    },
    {
      title: "Letter spacing",
      category: "Typography",
      kind: "tracking",
      prefix: "--tracking-",
    },
    {
      title: "Spacing",
      category: "Layout & effects",
      kind: "spacing",
      tokens: [...names].filter((name) => /^--spacing(?:-\d+)?$/.test(name)),
      description: "A 4px base unit. Bars show the actual distance.",
    },
    {
      title: "Radius",
      category: "Layout & effects",
      kind: "radius",
      prefix: "--radius-",
    },
    {
      title: "Shadows",
      category: "Layout & effects",
      kind: "shadow",
      prefix: "--shadow-",
    },
  ];
}
