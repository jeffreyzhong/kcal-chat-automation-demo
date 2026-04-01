import { requireUserId } from "@/lib/auth/require-user";
import { getAutomation, getAutomationRuns } from "@/lib/db/queries";
import { NextRequest } from "next/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await requireUserId();
  const { id } = await params;

  // Verify automation belongs to this user
  const auto = await getAutomation(id);
  if (!auto || auto.user_id !== userId) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const runs = await getAutomationRuns(id, 20);
  return Response.json(runs);
}
