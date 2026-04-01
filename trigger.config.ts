import { defineConfig } from "@trigger.dev/sdk/v3";

export default defineConfig({
  project: process.env.TRIGGER_PROJECT_REF ?? "kcal-chat-automations",
  runtime: "node",
  maxDuration: 300,
  retries: {
    enabledInDev: false,
    default: { maxAttempts: 3, minTimeoutInMs: 1000, factor: 2 },
  },
});
