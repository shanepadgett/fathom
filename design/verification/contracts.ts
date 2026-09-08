import { codeContracts } from "./code-contracts.ts";
import { withContractHost } from "./contract-host.ts";
import { escapingContracts } from "./escaping-contracts.ts";
import { filesContracts } from "./files-contracts.ts";
import { metersContracts } from "./meters-contracts.ts";
import { screensContracts } from "./screens-contracts.ts";

/** Run against real custom elements, not serialized templates or a DOM shim. */
export async function verifyContracts() {
  for (const check of [
    escapingContracts,
    metersContracts,
    filesContracts,
    codeContracts,
    screensContracts,
  ])
    await withContractHost(check);
  return "Passed escaping, meter, tree, code whitespace, registration, state update, and preview isolation contracts.";
}
