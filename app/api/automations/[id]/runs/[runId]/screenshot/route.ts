import { requireUserId } from "@/lib/auth/require-user";
import { getAutomation, getRunScreenshot } from "@/lib/db/queries";
import { NextRequest } from "next/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; runId: string }> },
) {
  const userId = await requireUserId();
  const { id, runId } = await params;

  // Verify automation belongs to this user
  const auto = await getAutomation(id);
  if (!auto || auto.user_id !== userId) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const base64 = await getRunScreenshot(runId);
  if (!base64) {
    return Response.json({ error: "No screenshot" }, { status: 404 });
  }

  const buffer = Buffer.from(base64, "base64");
  return new Response(buffer, {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
