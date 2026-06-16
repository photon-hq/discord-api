import {
  type Auth,
  type Client,
  createClient,
  createConfig,
} from "./generated/client";

// Re-export the generated surface: every operation function, every type, and
// the generated Zod schemas (for manually validating raw payloads such as
// gateway/webhook events).
export type { Client } from "./generated/client";
export * from "./generated/sdk.gen";
export * from "./generated/types.gen";
export * as schemas from "./generated/zod.gen";

const DEFAULT_BASE_URL = "https://discord.com/api/v10";
const DEFAULT_MAX_RETRIES = 3;

/**
 * Shape of Discord's JSON error body. Regular errors carry `code`/`message`
 * (plus optional field `errors`); 429 rate-limit bodies carry `retry_after`.
 * @see https://discord.com/developers/docs/topics/opcodes-and-status-codes
 */
interface DiscordErrorBody {
  code?: number;
  errors?: unknown;
  global?: boolean;
  message?: string;
  retry_after?: number;
}

/** Thrown for any non-2xx Discord response (including exhausted 429 retries). */
export class DiscordApiError extends Error {
  /** HTTP status code of the response. */
  readonly status: number;
  /** Discord's internal error code, when present. */
  readonly code?: number;
  /** Field-level validation details, when present. */
  readonly errors?: unknown;
  /** Seconds to wait before retrying, present on rate-limit (429) responses. */
  readonly retryAfter?: number;
  /** Whether a 429 is a global rate limit. */
  readonly global?: boolean;

  constructor(status: number, body: DiscordErrorBody | string) {
    const parsed: DiscordErrorBody =
      typeof body === "string" ? { message: body } : body;
    super(parsed.message ?? `Discord API request failed with status ${status}`);
    this.name = "DiscordApiError";
    this.status = status;
    this.code = parsed.code;
    this.errors = parsed.errors;
    this.retryAfter = parsed.retry_after;
    this.global = parsed.global;
  }
}

export interface CreateDiscordClientOptions {
  /** Override the API base URL (defaults to `https://discord.com/api/v10`). */
  baseUrl?: string;
  /** Custom fetch implementation (defaults to the global `fetch`). */
  fetch?: typeof fetch;
  /** Max automatic retries on HTTP 429 rate limits (defaults to 3). */
  maxRetries?: number;
  /** Bot token, sent as `Authorization: Bot <token>`. */
  token: string;
}

function retryAfterSeconds(response: Response, body: DiscordErrorBody): number {
  if (typeof body.retry_after === "number") {
    return body.retry_after;
  }
  const header = response.headers.get("Retry-After");
  const parsed = header ? Number.parseFloat(header) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : 1;
}

const sleep = (seconds: number) =>
  new Promise<void>((resolve) =>
    setTimeout(resolve, Math.max(0, seconds) * 1000)
  );

/**
 * Wrap a fetch implementation so HTTP 429 responses are transparently retried,
 * honoring Discord's `retry_after` (body) / `Retry-After` (header).
 */
function withRateLimitRetry(
  baseFetch: typeof fetch,
  maxRetries: number
): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const request =
      input instanceof Request && init === undefined
        ? input
        : new Request(input as RequestInfo, init);

    for (let attempt = 0; ; attempt++) {
      const response = await baseFetch(request.clone());
      if (response.status !== 429 || attempt >= maxRetries) {
        return response;
      }
      let body: DiscordErrorBody = {};
      try {
        body = (await response.clone().json()) as DiscordErrorBody;
      } catch {
        // non-JSON 429 body — fall back to the Retry-After header
      }
      await sleep(retryAfterSeconds(response, body));
    }
  }) as typeof fetch;
}

/**
 * Create a configured Discord API client. Pass the returned client to any
 * generated operation function via its `client` option, e.g.
 * `getMyUser({ client })`. The client sends `Authorization: Bot <token>`,
 * transparently retries on 429, and surfaces other errors as `DiscordApiError`.
 */
export function createDiscordClient(
  options: CreateDiscordClientOptions
): Client {
  const {
    token,
    baseUrl = DEFAULT_BASE_URL,
    fetch: customFetch = globalThis.fetch,
    maxRetries = DEFAULT_MAX_RETRIES,
  } = options;

  const client = createClient(
    createConfig({
      baseUrl,
      throwOnError: true,
      // Operations advertise both the Bot apiKey scheme and an OAuth2 bearer
      // scheme; the client applies every matching scheme in order, so only
      // supply a token for the apiKey (Bot) scheme and skip the rest.
      auth: (auth: Auth) =>
        auth.type === "apiKey" ? `Bot ${token}` : undefined,
      fetch: withRateLimitRetry(customFetch, maxRetries),
    })
  );

  // Transform the raw thrown error body into a typed `DiscordApiError`.
  client.interceptors.error.use((error, response) => {
    const status = response?.status ?? 0;
    return new DiscordApiError(status, error as DiscordErrorBody | string);
  });

  return client;
}
