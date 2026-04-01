# Stagehand v3 Rules for Automation Code

When writing automation code that uses Stagehand (`ctx.stagehand`), follow these rules.

## Critical: No .page property

Stagehand v3 does NOT have a `.page` property. These will crash at runtime:
```js
// WRONG — will throw "Cannot read properties of undefined"
await ctx.stagehand.page.goto("https://example.com");
await ctx.stagehand.page.waitForLoadState("networkidle");
```

## Initialization

Stagehand is pre-initialized on the `AutomationContext` — do NOT create a new instance.
Use `ctx.stagehand` directly.

## Primary method: agent() for multi-step browser flows

Use `agent()` for any flow involving navigation + interaction. This is the **default choice**.
Individual `act()` calls are fragile — they fail on dynamically-loaded pages when elements
aren't immediately visible. `agent()` handles timing, retries, and sequencing internally.

```js
const agent = ctx.stagehand.agent({ mode: "dom" });
await agent.execute({
  instruction: "Go to https://example.com, click the login button, type user@example.com into the email field, type the password, and click submit.",
  maxSteps: 20,
});
```

- Use `mode: "dom"` (default, works with any LLM)
- Set `maxSteps` high enough for the flow (20 is a good default)
- Put the full multi-step instruction in one string
- Use string concatenation for dynamic values: `"Type " + firstName + " into the name field"`

## extract() — Structured data extraction

Use after `agent()` completes to pull structured data from the resulting page.

```js
const result = await ctx.stagehand.extract(
  "Extract the order confirmation details",
  z.object({
    confirmationId: z.string().describe("The order confirmation number"),
    total: z.string().describe("The order total amount"),
  })
);
```

- Always use Zod schemas with `.describe()` on every field
- Use `z.string().url()` for URL extraction
- Use `z.string().optional()` for fields that may not be present

## act() — Only for single atomic actions

Only use `act()` for a single action on an already-loaded page. Never chain multiple
`act()` calls for a multi-step flow — use `agent()` instead.

```js
// OK — single action after agent() has finished
await ctx.stagehand.act("Click the Download PDF button");
```

## Sensitive data

Use variables to keep secrets out of LLM context:
```js
await ctx.stagehand.act("Type %password% into the password field", {
  variables: { password: secretValue },
});
```

## Code language

Write **plain JavaScript only** — no TypeScript syntax, no imports, no return statements.
