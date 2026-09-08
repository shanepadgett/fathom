import { meter } from "../primitives/meter.ts";
import { assert, type ContractHost } from "./contract-host.ts";

export async function metersContracts({ host, mount }: ContractHost) {
  for (const [value, maximum, current, fill] of [
    [48, 200, 48, "24%"],
    [250, 200, 200, "100%"],
    [NaN, 0, 0, "0%"],
    [-5, 200, 0, "0%"],
  ] as const) {
    await mount(meter(value, maximum, "Context"));
    const track = host.querySelector('[role="meter"]')!;
    assert(track.getAttribute("aria-valuenow") === String(current), "meter range normalization");
    assert(
      (track.firstElementChild as HTMLElement).style.width === fill,
      "meter fill disagrees with value",
    );
  }
}
