import { guard } from "@/lib/security";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const blocked = guard(req, "/api/agent/runs");
  if (blocked) return blocked;
  try {
    const runs = await db.agentRun.findMany({ orderBy: { createdAt: "desc" }, take: 10 });
    return Response.json({
      runs: runs.map((r) => ({
        id: r.id, trigger: r.trigger, status: r.status, durationMs: r.durationMs,
        fieldsScanned: r.fieldsScanned, alertsCreated: r.alertsCreated, summary: r.summary,
        steps: JSON.parse(r.steps ?? "[]"), at: r.createdAt.toISOString(),
      })),
    });
  } catch (e) {
    console.error("agent runs error", e);
    return Response.json({ error: "Failed to list agent runs" }, { status: 500 });
  }
}
