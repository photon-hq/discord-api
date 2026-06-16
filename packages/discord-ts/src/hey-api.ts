import type { CreateClientConfig } from "./generated/client.gen";

// Build-time defaults for the generated Hey API client. The bot-token auth
// header and rate-limit retry are applied at runtime by `createDiscordClient`
// in `index.ts`.
export const createClientConfig: CreateClientConfig = (config) => ({
  ...config,
  baseUrl: "https://discord.com/api/v10",
});
