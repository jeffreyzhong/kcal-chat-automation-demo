import { requireUserId } from "@/lib/auth/require-user";
import {
  getAutomation,
  updateAutomationStatus,
  resetFailures,
} from "@/lib/db/queries";
import { schedules } from "@trigger.dev/sdk/v3";
import { NextRequest } from "next/server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await requireUserId();
  const { id } = await params;
  const { action } = await req.json();

  const auto = await getAutomation(id);
  if (!auto || auto.user_id !== userId) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  if (action === "pause") {
    await updateAutomationStatus(id, "paused");
    if (auto.schedule_id) {
      await schedules.deactivate(auto.schedule_id as string);
    }
    return Response.json({ status: "paused" });
  }

  if (action === "resume") {
    await resetFailures(id);
    if (auto.schedule_id) {
      await schedules.activate(auto.schedule_id as string);
    }
    return Response.json({ status: "active" });
  }

  return Response.json({ error: "Invalid action" }, { status: 400 });
}
