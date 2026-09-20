import type { Scope, Handlers } from "@fathom/sdk";
import type { LlmApi, StreamEvent } from "@fathom/llm/contract";
import type { LlmService } from "./llm-service.ts";

const MAX_ACTIVE_CHECKS = 3;
const CHECK_HISTORY_LIMIT = 30;
const MAX_RESPONSE_TEXT_LENGTH = 1_000_000;

interface ModelCheck {
  controller: AbortController;
  text: string;
  state: "running" | "done" | "error" | "cancelled";
}

/** Bounded requests for the provider workbench, not an agent execution loop. */
export function createModelChecks(
  llm: LlmService,
  scope: Scope,
  emit: (event: StreamEvent) => void,
): Handlers<typeof LlmApi.operations> {
  const runs = new Map<string, ModelCheck>();

  return {
    models: ({ provider }, req) => llm.models(provider, req.signal),

    start: (input) => {
      if (runs.has(input.id)) {
        throw new Error("Request id already used");
      }

      if (
        [...runs.values()].filter((r) => r.state === "running").length >=
        MAX_ACTIVE_CHECKS
      ) {
        throw new Error("Finish or cancel an active model check first");
      }

      if (runs.size >= CHECK_HISTORY_LIMIT) {
        for (const [id, r] of runs) {
          if (r.state !== "running") {
            runs.delete(id);
            break;
          }
        }
      }

      const run: ModelCheck = {
        controller: new AbortController(),
        text: "",
        state: "running",
      };

      runs.set(input.id, run);

      scope.task(async (signal) => {
        try {
          for await (const text of llm.stream(
            input,
            AbortSignal.any([signal, run.controller.signal]),
          )) {
            run.text += text;

            if (run.text.length > MAX_RESPONSE_TEXT_LENGTH) {
              throw new Error("Response exceeds the model-check limit");
            }

            emit({
              id: input.id,
              type: "text",
              text,
            });
          }

          run.state = "done";
          emit({ id: input.id, type: "done" });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Model request failed";

          run.state =
            signal.aborted || run.controller.signal.aborted
              ? "cancelled"
              : "error";

          emit({
            id: input.id,
            type: run.state,
            text: run.state === "error" ? message : undefined,
          });
        }
      });

      return {};
    },

    cancel: ({ id }) => {
      runs.get(id)?.controller.abort();

      return {};
    },

    state: ({ id }) => {
      const run = runs.get(id);

      return { text: run?.text ?? "", state: run?.state ?? "unavailable" };
    },
  };
}
