import { openai } from "@ai-sdk/openai";
import { Composio } from "@composio/core";
import { VercelProvider } from "@composio/vercel";
import {
  streamText,
  convertToModelMessages,
  generateId,
  stepCountIs,
  type UIMessage,
} from "ai";
import { buildAutomationTools } from "../../../lib/automations/tools";
import { sql } from "@/lib/db";
import { requireUserId } from "@/lib/auth/require-user";

const composio = new Composio({ provider: new VercelProvider() });

const SYSTEM_PROMPT = `You are a helpful assistant. Use the available tools to help the user.

You can also create automations that run on a schedule. When a user describes one:

1. Clarify the goal, schedule, and services involved
2. Use COMPOSIO_SEARCH_TOOLS to find tool slugs for API integrations (OneDrive, Gmail, etc.)
3. Write the automation code following the rules below
4. Show the complete code to the user in a code block and explain what it does
5. Only call save_automation AFTER the user explicitly confirms

When modifying an existing automation:
1. Call get_automation to read the current code
2. Make the requested changes
3. Show the diff to the user
4. Only call update_automation_code after the user confirms

## Automation code rules

The code runs as a plain JavaScript function body (NOT TypeScript — no type annotations, no interfaces, no generics). It has access to:
- ctx — the AutomationContext object
- z — Zod (for defining extract schemas)

### Available on ctx:
- ctx.composio.execute(toolSlug, args) — call any Composio API tool
- ctx.stagehand — Stagehand v3 browser automation instance
- ctx.log(message) — structured logging (use liberally for debugging)
- ctx.store.get(key) / ctx.store.set(key, value) — persist state between runs

### Browser automation with Stagehand v3

CRITICAL RULES — violating these will cause runtime failures:

1. NO .page PROPERTY. Stagehand v3 removed stagehand.page entirely.
   WRONG: ctx.stagehand.page.goto("https://example.com")
   WRONG: ctx.stagehand.page.waitForLoadState("networkidle")
   RIGHT: Use act() or agent() for all browser interactions

2. USE agent() MODE FOR MULTI-STEP BROWSER FLOWS. Do NOT chain multiple act() calls.
   Individual act() calls are fragile — they fail when pages load dynamically or elements
   aren't immediately visible. agent() handles timing, retries, and multi-step flows as
   a single cohesive operation.

   WRONG (fragile):
     await ctx.stagehand.act("navigate to https://example.com");
     await ctx.stagehand.act("Click the login button");
     await ctx.stagehand.act("Type username into the email field");
     await ctx.stagehand.act("Click submit");

   RIGHT (robust):
     const agent = ctx.stagehand.agent({ mode: "dom" });
     await agent.execute({
       instruction: "Go to https://example.com, click the login button, type user@example.com into the email field, and click submit.",
       maxSteps: 20,
     });

3. USE extract() AFTER agent() TO GET STRUCTURED DATA from the resulting page.
   Always use Zod schemas with .describe() on every field for accuracy.

     const result = await ctx.stagehand.extract(
       "Extract the order confirmation number and total",
       z.object({
         confirmationNumber: z.string().describe("The order confirmation ID"),
         total: z.string().describe("The total amount charged"),
       })
     );

4. act() is ONLY appropriate for simple, single atomic actions on an already-loaded page
   (e.g., clicking one button after agent() has finished). Never use it for navigation
   or multi-step sequences.

5. Use variables for sensitive data — never put passwords or secrets directly in instructions:
     await ctx.stagehand.act("type %password% into the password field", {
       variables: { password: "secret" }
     });

### General code rules:
- Write PLAIN JAVASCRIPT only. No TypeScript syntax (no type annotations, no "as" casts, no interfaces).
- Do not use import/require statements — ctx and z are provided as globals.
- Do not use return statements — the code runs as a function body, returning is unnecessary.
- Use ctx.log() liberally to log progress — these appear in the automation run logs for debugging.
- Use string concatenation ("hello " + name) instead of template literals in agent instructions to avoid escaping issues.`;

export async function POST(req: Request) {
  const userId = await requireUserId();
  const body = await req.json();
  const messages: UIMessage[] = body.messages;
  const conversationId: string | undefined = body.conversationId ?? undefined;

  const session = await composio.create(userId);
  const composioTools = await session.tools();
  const automationTools = buildAutomationTools(userId);

  const result = streamText({
    model: openai("gpt-5.4"),
    system: SYSTEM_PROMPT,
    messages: await convertToModelMessages(messages),
    tools: { ...composioTools, ...automationTools },
    stopWhen: stepCountIs(10),
    async onFinish({ response }) {
      if (!conversationId) return;

      // Find new messages (ones we haven't saved yet)
      // Save the last user message and the assistant response
      const lastUserMsg = messages[messages.length - 1];
      if (lastUserMsg?.role === "user") {
        await sql`
          INSERT INTO messages (conversation_id, role, parts)
          VALUES (${conversationId}, 'user', ${JSON.stringify(lastUserMsg.parts)})
        `;
      }

      // Save assistant text response
      const assistantTextParts = response.messages
        .filter((m) => m.role === "assistant")
        .flatMap((m) => {
          if (typeof m.content === "string") {
            return m.content ? [{ type: "text", text: m.content }] : [];
          }
          return m.content
            .filter((c): c is { type: "text"; text: string } => c.type === "text")
            .map((c) => ({ type: "text", text: c.text }));
        });

      if (assistantTextParts.length > 0) {
        await sql`
          INSERT INTO messages (conversation_id, role, parts)
          VALUES (${conversationId}, 'assistant', ${JSON.stringify(assistantTextParts)})
        `;
      }

      // Auto-title: if this is the first user message, generate a title
      const msgCount =
        await sql`SELECT count(*) as cnt FROM messages WHERE conversation_id = ${conversationId}`;
      if (Number(msgCount[0].cnt) <= 2) {
        const userText = lastUserMsg?.parts
          ?.filter((p: { type: string }) => p.type === "text")
          .map((p: { type: string; text?: string }) => p.text)
          .join(" ");
        if (userText) {
          const title =
            userText.length > 50 ? userText.slice(0, 50) + "..." : userText;
          await sql`UPDATE conversations SET title = ${title}, updated_at = now() WHERE id = ${conversationId}`;
        }
      } else {
        await sql`UPDATE conversations SET updated_at = now() WHERE id = ${conversationId}`;
      }
    },
  });

  return result.toUIMessageStreamResponse({
    originalMessages: messages,
    generateMessageId: () => generateId(),
  });
}
