# Stagehand AI Rules

When writing automation code that uses Stagehand (`ctx.stagehand`), follow these rules.

## Initialization

Stagehand is pre-initialized on the `AutomationContext` — do NOT create a new instance.
Use `ctx.stagehand` directly.

## Core Methods

### act() — Atomic browser actions
```ts
await ctx.stagehand.act("Click the Sign In button");
await ctx.stagehand.act("Type 'hello' into the search field");
```
- Keep instructions **atomic** — one action per call
- DO: "Click the Submit button"
- DON'T: "Fill out the form and submit it"

### observe() + act() — Recommended pattern
```ts
const actions = await ctx.stagehand.observe("Find the login button");
await ctx.stagehand.act(actions[0]); // deterministic replay
```
- Use observe() first to discover available actions
- Cache results to prevent DOM changes between planning and execution
- 2-3x faster than separate act() calls

### extract() — Structured data extraction
```ts
const data = await ctx.stagehand.extract(
  "Extract the order confirmation details",
  z.object({
    confirmationId: z.string().describe("The order confirmation number"),
    total: z.string().describe("The order total amount"),
  })
);
```
- Always use Zod schemas with `.describe()` for accuracy
- Use `z.string().url()` for URL extraction

### agent() — Complex multi-step flows
```ts
const agent = ctx.stagehand.agent({
  mode: "dom",            // or "cua" for Computer Use Agent
  model: "anthropic/claude-sonnet-4-20250514",
});
await agent.execute({
  instruction: "Log in, navigate to settings, and change the email to new@example.com",
  maxSteps: 20,
});
```
- Use for complex multi-step workflows
- Navigate to the target page BEFORE calling agent.execute()

### page — Playwright Page
```ts
await ctx.stagehand.page.goto("https://example.com");
await ctx.stagehand.page.reload();
await ctx.stagehand.page.goBack();
```
- Use for direct navigation, reload, back/forward
- Available as `ctx.stagehand.page`

## Sensitive Data

Use variables to avoid sending secrets to the LLM:
```ts
await ctx.stagehand.act("Type %password% into the password field", {
  variables: { password: "my-secret-password" },
});
```

## Multi-Page Workflows

Target specific pages:
```ts
await ctx.stagehand.act("Click the button", { page: page2 });
await ctx.stagehand.extract("Get the title", { page: page2 });
```
