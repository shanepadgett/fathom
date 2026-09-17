function bind<const Definition extends Deno.ForeignFunction>(
  pointer: Deno.PointerObject,
  definition: Definition,
) {
  // The pinned C header defines the signature of each resolver operation;
  // dlsym itself cannot carry that signature across the native boundary.
  return new Deno.UnsafeFnPointer(
    pointer as Deno.PointerObject<Omit<Definition, "nonblocking">>,
    definition,
  );
}

/** Process-owned FFI adapter. CEF owns view lifetimes and UI-thread dispatch. */
export function loadNativeBrowser() {
  const extension =
    Deno.build.os === "darwin" ? "dylib" : Deno.build.os === "linux" ? "so" : undefined;
  if (!extension) return undefined;
  const path = new URL(`../native/fathom_child_ffi.${extension}`, import.meta.url);
  try {
    Deno.statSync(path);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) return undefined;
    throw error;
  }
  const library = Deno.dlopen(path, {
    fathom_child_v1_resolve: { parameters: ["u32"], result: "pointer" },
  });
  const pointers = Array.from({ length: 7 }, (_, operation) =>
    library.symbols.fathom_child_v1_resolve(operation),
  );
  // A staged shim can accompany a stock backend during development. Its
  // presence is not evidence that the running executable supports children.
  if (pointers.some((pointer) => pointer === null)) {
    library.close();
    return undefined;
  }
  const create = bind(pointers[0]!, {
    parameters: ["u32"],
    result: "u64",
  });
  const state = bind(pointers[1]!, {
    parameters: ["u64"],
    result: "i32",
  });
  const bounds = bind(pointers[2]!, {
    parameters: ["u64", "i32", "i32", "i32", "i32", "i32"],
    result: "i32",
  });
  const navigate = bind(pointers[3]!, {
    parameters: ["u64", "buffer", "u32"],
    result: "i32",
  });
  const dispose = bind(pointers[4]!, {
    parameters: ["u64"],
    result: "i32",
  });
  const encoder = new TextEncoder();
  const send = bind(pointers[5]!, {
    parameters: ["u64", "buffer", "u32"],
    result: "i32",
  });
  const poll = bind(pointers[6]!, {
    parameters: ["u64", "buffer", "u32", "buffer"],
    result: "i32",
  });
  return {
    // Keep the resolver loaded for the process lifetime. Closing a browser
    // disposes its CEF resources, not the function-pointer provider.
    library,
    create: (parent: number) => create.call(parent),
    state: (child: bigint) => state.call(child),
    bounds: (
      child: bigint,
      x: number,
      y: number,
      width: number,
      height: number,
      visible: boolean,
    ) => bounds.call(child, x, y, width, height, Number(visible)),
    navigate: (child: bigint, url: string) => {
      const bytes = encoder.encode(url);
      return navigate.call(child, bytes, bytes.byteLength);
    },
    dispose: (child: bigint) => dispose.call(child),
    send: (child: bigint, message: string) => {
      const bytes = encoder.encode(message);
      return send.call(child, bytes, bytes.byteLength);
    },
    poll: (child: bigint, output: Uint8Array, length: Uint32Array) =>
      poll.call(child, output, output.byteLength, length),
  };
}
