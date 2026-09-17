/** pi-ai models and ~/.pi/agent/auth.json. Lists signed-in models and streams replies. */
import type {
  Api,
  Context as ModelContext,
  Credential,
  CredentialStore,
  Model as PiModel,
  SimpleStreamOptions,
} from "@earendil-works/pi-ai";

import type { PluginContext } from "../sdk.ts";
import type { ModelChoice } from "../types.ts";

import { createModels } from "@earendil-works/pi-ai";
import { anthropicProvider } from "@earendil-works/pi-ai/providers/anthropic";
import { googleProvider } from "@earendil-works/pi-ai/providers/google";
import { openaiProvider } from "@earendil-works/pi-ai/providers/openai";
import { openaiCodexProvider } from "@earendil-works/pi-ai/providers/openai-codex";
import { xaiProvider } from "@earendil-works/pi-ai/providers/xai";
import { dirname } from "@std/path";
import { Service } from "cordis";

export interface ModelConfig {
  authPath: string;
}

declare module "../sdk.ts" {
  interface Services {
    model: Model;
  }
}

export default class Model extends Service {
  static provide = "model" as const;

  readonly models: ReturnType<typeof createModels>;

  constructor(ctx: PluginContext<never>, config: ModelConfig) {
    super(ctx, "model");
    this.models = createModels({
      credentials: new AuthFile(config.authPath),
    });
    for (const factory of [
      openaiCodexProvider,
      anthropicProvider,
      openaiProvider,
      googleProvider,
      xaiProvider,
    ])
      this.models.setProvider(factory());
    ctx.effect(() => () => this.models.clearProviders());
  }

  async available(): Promise<ModelChoice[]> {
    const models = await this.models.getAvailable();
    return models.map((model) => ({
      provider: model.provider,
      id: model.id,
      name: model.name ?? model.id,
    }));
  }

  async resolve(provider?: string, id?: string): Promise<PiModel<Api>> {
    const models = await this.models.getAvailable(provider || undefined);
    const model =
      models.find((model) => model.id === id) ??
      models.find((model) => model.id === "gpt-6-astra") ??
      models[0];
    if (!model) {
      throw new Error("No signed-in model is available. Check ~/.pi/agent/auth.json.");
    }
    return model;
  }

  stream(model: PiModel<Api>, context: ModelContext, options?: SimpleStreamOptions) {
    return this.models.streamSimple(model, context, {
      ...options,
      transport: "sse",
    });
  }
}

class AuthFile implements CredentialStore {
  constructor(readonly path: string) {}

  async read(id: string) {
    return (await this.#load())[id];
  }

  async list() {
    return Object.entries(await this.#load()).map(([providerId, credential]) => ({
      providerId,
      type: credential.type,
    }));
  }

  async modify(
    id: string,
    fn: (current: Credential | undefined) => Promise<Credential | undefined>,
  ) {
    const data = await this.#load();
    const next = await fn(data[id]);
    if (next === undefined) return data[id];
    data[id] = next;
    await this.#save(data);
    return next;
  }

  async delete(id: string) {
    const data = await this.#load();
    delete data[id];
    await this.#save(data);
  }

  async #save(data: Record<string, Credential>) {
    await Deno.mkdir(dirname(this.path), { recursive: true, mode: 0o700 });
    await Deno.writeTextFile(this.path, JSON.stringify(data, null, 2) + "\n");
  }

  async #load() {
    try {
      const data = JSON.parse(await Deno.readTextFile(this.path));
      if (!data || typeof data !== "object" || Array.isArray(data)) {
        throw new Error("Invalid credential store");
      }
      return data as Record<string, Credential>;
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) return {};
      throw error;
    }
  }
}
