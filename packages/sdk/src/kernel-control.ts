import { T, type Static } from "./schema.ts";
import { defineService, type ServiceToken } from "./service.ts";
import type { Dispose } from "./scope.ts";
import type {
  TObject,
  TString,
  TOptional,
  TUnion,
  TLiteral,
  TUnknown,
  TBoolean,
  TInteger,
  TArray,
  TRecord,
} from "@sinclair/typebox";

export const ChangeSchema: TObject<{
  id: TString;
  host: TOptional<TUnion<[TLiteral<"backend">, TLiteral<"ui">]>>;
  action: TUnion<
    [
      TLiteral<"enable">,
      TLiteral<"disable">,
      TLiteral<"reload">,
      TLiteral<"config">,
    ]
  >;
  config: TOptional<TUnknown>;
}> = T.Object(
  {
    id: T.String({ minLength: 1 }),
    host: T.Optional(T.Union([T.Literal("backend"), T.Literal("ui")])),
    action: T.Union([
      T.Literal("enable"),
      T.Literal("disable"),
      T.Literal("reload"),
      T.Literal("config"),
    ]),
    config: T.Optional(T.Unknown()),
  },
  { additionalProperties: false },
);

export const PluginStatusSchema: TObject<{
  id: TString;
  host: TUnion<[TLiteral<"backend">, TLiteral<"ui">]>;
  desired: TObject<{ enabled: TBoolean; source: TString; config: TUnknown }>;
  actual: TObject<{
    state: TUnion<
      TLiteral<
        "stopped" | "blocked" | "starting" | "ready" | "stopping" | "failed"
      >[]
    >;
    gen: TInteger;
    waitingOn: TOptional<TArray<TString>>;
    lastError: TOptional<TString>;
    restartRequired: TOptional<TBoolean>;
  }>;
}> = T.Object({
  id: T.String(),
  host: T.Union([T.Literal("backend"), T.Literal("ui")]),
  desired: T.Object({
    enabled: T.Boolean(),
    source: T.String(),
    config: T.Unknown(),
  }),
  actual: T.Object({
    state: T.Union(
      (
        [
          "stopped",
          "blocked",
          "starting",
          "ready",
          "stopping",
          "failed",
        ] as const
      ).map((s) => T.Literal(s)),
    ),
    gen: T.Integer(),
    waitingOn: T.Optional(T.Array(T.String())),
    lastError: T.Optional(T.String()),
    restartRequired: T.Optional(T.Boolean()),
  }),
});

export const GraphSchema: TObject<{
  nodes: TArray<
    TObject<{
      id: TString;
      host: TUnion<[TLiteral<"backend">, TLiteral<"ui">]>;
      provides: TArray<TString>;
      requires: TArray<TString>;
      contributes: TRecord<TString, TArray<TString>>;
    }>
  >;
  edges: TArray<TObject<{ from: TString; to: TString; token: TString }>>;
}> = T.Object({
  nodes: T.Array(
    T.Object({
      id: T.String(),
      host: T.Union([T.Literal("backend"), T.Literal("ui")]),
      provides: T.Array(T.String()),
      requires: T.Array(T.String()),
      contributes: T.Record(T.String(), T.Array(T.String())),
    }),
  ),
  edges: T.Array(
    T.Object({ from: T.String(), to: T.String(), token: T.String() }),
  ),
});

export const OperationStatusSchema: TObject<{
  id: TString;
  plugin: TString;
  host: TUnion<[TLiteral<"backend">, TLiteral<"ui">]>;
  action: TString;
  state: TUnion<
    [
      TLiteral<"queued">,
      TLiteral<"running">,
      TLiteral<"succeeded">,
      TLiteral<"failed">,
    ]
  >;
  error: TOptional<TString>;
}> = T.Object({
  id: T.String(),
  plugin: T.String(),
  host: T.Union([T.Literal("backend"), T.Literal("ui")]),
  action: T.String(),
  state: T.Union([
    T.Literal("queued"),
    T.Literal("running"),
    T.Literal("succeeded"),
    T.Literal("failed"),
  ]),
  error: T.Optional(T.String()),
});

export type Change = Static<typeof ChangeSchema>;
export type PluginStatus = Static<typeof PluginStatusSchema>;
export type Graph = Static<typeof GraphSchema>;
export type GraphNode = Graph["nodes"][number];
export type OperationStatus = Static<typeof OperationStatusSchema>;

export interface KernelControlApi {
  plugins(): Promise<PluginStatus[]>;
  graph(): Promise<Graph>;
  operations(): Promise<OperationStatus[]>;
  /** Queue a change and return its operation ID, not its completion result. */
  submit(change: Change): Promise<string>;
  watch(fn: (status: PluginStatus[]) => void): Dispose;
}

export const KernelControl: ServiceToken<KernelControlApi> =
  defineService("fathom.kernel");
