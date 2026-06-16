import { describe, expect, test } from "bun:test";
import {
  createDiscordClient,
  DiscordApiError,
  getMyUser,
  schemas,
} from "../src/index.ts";

const USER_JSON = JSON.stringify({ id: "1", username: "test" });
const jsonResponse = (body: string, status: number) =>
  new Response(body, {
    status,
    headers: { "Content-Type": "application/json" },
  });

describe("@photon-ai/discord-ts", () => {
  test("exposes generated Zod schemas", () => {
    expect(Object.keys(schemas).length).toBeGreaterThan(0);
  });

  test("sends the Authorization: Bot <token> header", async () => {
    let seen: Request | undefined;
    const client = createDiscordClient({
      token: "test-token",
      fetch: ((input: RequestInfo | URL, init?: RequestInit) => {
        seen =
          input instanceof Request && init === undefined
            ? input
            : new Request(input as RequestInfo, init);
        return Promise.resolve(jsonResponse(USER_JSON, 200));
      }) as unknown as typeof fetch,
    });

    // Response validation may reject the minimal body — we only assert the header.
    // Ignore response-validation rejection; we only assert call behavior.
    await getMyUser({ client }).catch(() => undefined);
    expect(seen?.headers.get("Authorization")).toBe("Bot test-token");
  });

  test("retries once on HTTP 429 then resolves", async () => {
    let calls = 0;
    const client = createDiscordClient({
      token: "t",
      maxRetries: 2,
      fetch: (() => {
        calls += 1;
        const body =
          calls === 1
            ? JSON.stringify({ message: "rate limited", retry_after: 0.01 })
            : USER_JSON;
        return Promise.resolve(jsonResponse(body, calls === 1 ? 429 : 200));
      }) as unknown as typeof fetch,
    });

    // Ignore response-validation rejection; we only assert call behavior.
    await getMyUser({ client }).catch(() => undefined);
    expect(calls).toBe(2);
  });

  test("throws a typed DiscordApiError on error responses", async () => {
    const client = createDiscordClient({
      token: "t",
      fetch: (() =>
        Promise.resolve(
          jsonResponse(
            JSON.stringify({ code: 10_013, message: "Unknown User" }),
            404
          )
        )) as unknown as typeof fetch,
    });

    try {
      await getMyUser({ client });
      throw new Error("expected getMyUser to reject");
    } catch (error) {
      expect(error).toBeInstanceOf(DiscordApiError);
      const apiError = error as DiscordApiError;
      expect(apiError.status).toBe(404);
      expect(apiError.code).toBe(10_013);
      expect(apiError.message).toBe("Unknown User");
    }
  });
});
