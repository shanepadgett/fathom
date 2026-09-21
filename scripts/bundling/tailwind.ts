import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { fileURLToPath } from "node:url";

/** Build only the utilities used by this artifact; the host owns base styles. */
export async function buildStyles(
  css: string,
  sources: string[],
  base = false,
): Promise<string> {
  // JSR exports are modules only, so the stylesheets are located relative to
  // the SDK's UI entry. Their directory is the base for every import below.
  const from = fileURLToPath(
    new URL("./theme/styles.css", import.meta.resolve("@fathom/sdk/ui")),
  );

  const theme = base
    ? '@import "tailwindcss" source(none);\n@import "./styles.css";'
    : '@import "tailwindcss/utilities" layer(utilities) source(none);\n@reference "./theme.css";\n@reference "./typography.css";';

  const input = [
    theme,
    "@custom-variant dark (&:where([data-theme=dark], [data-theme=dark] *));",
    ...sources.map((path) => `@source ${JSON.stringify(path)};`),
    css,
  ].join("\n");

  const result = await postcss([tailwind()]).process(input, { from });

  return result.css;
}
