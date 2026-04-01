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
3. If browser automation is needed, use Stagehand:
   - ctx.stagehand.act("atomic instruction") for single actions (click, type, etc.)
   - ctx.stagehand.observe() + ctx.stagehand.act(action) for reliability
   - ctx.stagehand.extract("instruction", z.object({...})) for structured data extraction
   - ctx.stagehand.page.goto(url) for navigation
   - ctx.stagehand.agent({mode:"dom"}) for complex multi-step browser flows
4. Write the automation as a TypeScript async function body that has access to:
   - ctx.composio.execute(toolSlug, args) — call any Composio API tool
   - ctx.stagehand — Stagehand browser automation instance
   - ctx.log(message) — structured logging
   - ctx.store.get(key) / ctx.store.set(key, value) — persist state between runs
   - z — Zod (for defining extract schemas)
5. Show the complete code to the user in a code block and explain what it does
6. Only call save_automation AFTER the user explicitly confirms

When modifying an existing automation:
1. Call get_automation to read the current code
2. Make the requested changes
3. Show the diff to the user
4. Only call update_automation_code after the user confirms

Important Stagehand rules:
- Keep act() calls atomic: "Click the Submit button" not "Fill out the form and submit"
- Use variables for sensitive data: act("type %password%", { variables: { password } })
- Use z.object().describe() fields for accurate extract() results`;

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
