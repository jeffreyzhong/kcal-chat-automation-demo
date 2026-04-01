import { requireUserId } from "@/lib/auth/require-user";
import { listAutomations } from "@/lib/db/queries";

export async function GET() {
  const userId = await requireUserId();
  const automations = await listAutomations(userId);
  return Response.json(automations);
}
