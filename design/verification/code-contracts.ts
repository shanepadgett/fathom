import { html } from "lit";

import "../composites/code-preview.ts";
import { codeLines } from "../fixtures/code.ts";
import { assert, type ContractHost } from "./contract-host.ts";

export async function codeContracts({ host, mount }: ContractHost) {
  await mount(html`<code-preview .lines=${codeLines}></code-preview>`);
  const lines = host.querySelectorAll<HTMLElement>('[aria-label="Sample TypeScript code"] > span');
  assert(lines.length === codeLines.length, "code line count changed");
  assert(
    host.querySelector('pre[aria-hidden="true"]')?.textContent ===
      codeLines.map((_, index) => index + 1).join("\n"),
    "line number whitespace changed",
  );
  const top = lines[0].parentElement!.getBoundingClientRect().top;
  for (const [index, line] of [...lines].entries()) {
    const expected = codeLines[index].tokens
      .map((token) => (typeof token === "string" ? token : token.text))
      .join("");
    assert(
      Math.abs(
        line.getBoundingClientRect().top -
          top -
          index * parseFloat(getComputedStyle(line).lineHeight),
      ) < 1,
      `extra whitespace before code line ${index + 1}`,
    );
    assert(line.textContent === expected, `code whitespace changed on line ${index + 1}`);
    assert(
      Math.abs(
        line.getBoundingClientRect().height - parseFloat(getComputedStyle(line).lineHeight),
      ) < 1,
      "code acquired extra blank lines",
    );
  }
}
