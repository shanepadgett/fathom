import type { EventEnvelope } from "@fathom/sdk";

const REPLAY_EVENT_LIMIT = 512;
const PEER_QUEUE_EVENT_LIMIT = 1024;
const HEARTBEAT_INTERVAL_MS = 15_000;

export function createEventBus(snapshot: () => unknown) {
  const epoch = crypto.randomUUID();
  let cursor = 0;
  const replay: EventEnvelope[] = [];
  const peers = new Set<ReadableStreamDefaultController<Uint8Array>>();
  const encoder = new TextEncoder();

  const encode = (event: EventEnvelope) =>
    encoder.encode(`id: ${event.cursor}\ndata: ${JSON.stringify(event)}\n\n`);

  const push = (
    peer: ReadableStreamDefaultController<Uint8Array>,
    value: Uint8Array,
  ) => {
    try {
      if ((peer.desiredSize ?? 0) <= 0) {
        peer.close();
        peers.delete(peer);
      } else {
        peer.enqueue(value);
      }
    } catch {
      peers.delete(peer);
    }
  };

  const publish = (type: string, payload: unknown) => {
    const envelope = { epoch, cursor: ++cursor, type, payload };
    replay.push(envelope);

    if (replay.length > REPLAY_EVENT_LIMIT) {
      replay.shift();
    }

    for (const peer of peers) {
      push(peer, encode(envelope));
    }
  };

  const heartbeat = setInterval(() => {
    for (const peer of peers) {
      push(peer, encoder.encode(": heartbeat\n\n"));
    }
  }, HEARTBEAT_INTERVAL_MS);

  return {
    publish,

    connect(req: Request) {
      const url = new URL(req.url);
      let peer: ReadableStreamDefaultController<Uint8Array>;
      const remove = () => peers.delete(peer);

      const stream = new ReadableStream<Uint8Array>(
        {
          start(controller) {
            peer = controller;

            const after = Number(url.searchParams.get("cursor"));
            const sameEpoch = url.searchParams.get("epoch") === epoch;

            const retained =
              sameEpoch &&
              Number.isSafeInteger(after) &&
              after >= 0 &&
              after <= cursor &&
              after >= (replay[0]?.cursor ?? cursor) - 1;

            if (retained) {
              for (const item of replay) {
                if (item.cursor > after) {
                  controller.enqueue(encode(item));
                }
              }
            } else {
              controller.enqueue(
                encode({
                  epoch,
                  cursor,
                  type: "reset",
                  payload: snapshot(),
                }),
              );
            }

            peers.add(controller);
            req.signal.addEventListener("abort", remove, { once: true });
          },

          cancel() {
            remove();
            req.signal.removeEventListener("abort", remove);
          },
        },
        { highWaterMark: PEER_QUEUE_EVENT_LIMIT },
      );

      return new Response(stream, {
        headers: {
          "content-type": "text/event-stream",
          "cache-control": "no-cache",
          "x-accel-buffering": "no",
        },
      });
    },

    close() {
      clearInterval(heartbeat);

      for (const peer of peers) {
        try {
          peer.close();
        } catch {
          // A disconnected peer may already be closed.
        }
      }

      peers.clear();
    },
  };
}
