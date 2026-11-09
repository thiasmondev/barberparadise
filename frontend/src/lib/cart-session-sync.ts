export interface CartSessionPayload {
  sessionId: string;
  email?: string;
  cartItems?: { productId: string; variantId: string | null; quantity: number }[];
}

export interface CartSessionRequest {
  payload: CartSessionPayload;
  token: string | null;
}

export interface CartSessionResponse {
  ok: true;
  sessionId: string;
  hasSnapshot: boolean;
  itemCount?: number;
  syncedAt?: string;
  validationIssues?: string[];
}

export type CartSyncResult =
  | { status: "success"; request: CartSessionRequest; response: CartSessionResponse }
  | { status: "error" }
  | { status: "skipped" };

interface QueueOptions {
  url: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
  maxRetries?: number;
  retryDelayMs?: number;
}

/** Serial writes, at most three retries after the initial attempt.
 * getRequest is re-evaluated before EVERY attempt, never replaying a stale body.
 * Returning null invalidates queued/retrying work without sending it.
 */
export function createCartSessionSyncQueue(options: QueueOptions) {
  const fetchRequest = options.fetch ?? fetch;
  const timeoutMs = options.timeoutMs ?? 15_000;
  const maxRetries = options.maxRetries ?? 3;
  const retryDelayMs = options.retryDelayMs ?? 500;
  let tail: Promise<unknown> = Promise.resolve();
  let activeController: AbortController | null = null;
  let cancellationGeneration = 0;
  let cancelDelay: (() => void) | null = null;

  function cancelActive() {
    cancellationGeneration++;
    activeController?.abort();
    cancelDelay?.();
  }

  function enqueue(getRequest: () => CartSessionRequest | null): Promise<CartSyncResult> {
    const generation = cancellationGeneration;
    const task = tail.then(async (): Promise<CartSyncResult> => {
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        if (generation !== cancellationGeneration) return { status: "skipped" };
        const request = getRequest();
        if (!request) return { status: "skipped" };
        const controller = new AbortController();
        activeController = controller;
        let timer: ReturnType<typeof setTimeout> | undefined;
        let retryable = false;
        try {
          const result = await Promise.race([
            (async () => {
              const response = await fetchRequest(options.url, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  ...(request.token ? { Authorization: `Bearer ${request.token}` } : {}),
                },
                body: JSON.stringify(request.payload),
                signal: controller.signal,
              });
              if (!response.ok) return { kind: "http" as const, status: response.status };
              // Malformed successful responses are protocol errors, not network retries.
              try {
                return { kind: "body" as const, data: await response.json() as CartSessionResponse };
              } catch (error) {
                if (!(error instanceof SyntaxError)) throw error;
                return { kind: "invalid" as const };
              }
            })(),
            new Promise<never>((_, reject) => {
              timer = setTimeout(() => {
                controller.abort();
                reject(new Error("Cart sync timeout"));
              }, timeoutMs);
            }),
          ]);
          if (generation !== cancellationGeneration || !getRequest()) return { status: "skipped" };
          if (result.kind === "http") {
            retryable = result.status === 429 || (result.status >= 500 && result.status < 600);
          } else if (result.kind === "body") {
            const data = result.data;
            if (data?.ok === true && typeof data.sessionId === "string" && data.sessionId.trim() && typeof data.hasSnapshot === "boolean") {
              return { status: "success", request, response: data };
            }
            return { status: "error" };
          } else {
            return { status: "error" };
          }
        } catch {
          retryable = true; // Rejected fetch or timeout; HTTP errors use the branch above.
        } finally {
          if (timer) clearTimeout(timer);
          if (activeController === controller) activeController = null;
        }
        if (generation !== cancellationGeneration || !getRequest()) return { status: "skipped" };
        if (!retryable || attempt === maxRetries) return { status: "error" };
        await new Promise<void>((resolve) => {
          const delay = setTimeout(() => { cancelDelay = null; resolve(); }, retryDelayMs * 2 ** attempt);
          cancelDelay = () => { clearTimeout(delay); cancelDelay = null; resolve(); };
        });
      }
      return { status: "error" };
    });
    tail = task.catch(() => {});
    return task.catch(() => ({ status: "error" } as const));
  }

  return { enqueue, cancelActive };
}
