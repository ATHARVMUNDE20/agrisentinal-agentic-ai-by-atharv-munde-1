import { guard } from "@/lib/security";
import { runSentinelScan } from "@/lib/agent";
import { invalidatePrefix } from "@/lib/cache";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  const blocked = guard(req, "/api/agent/scan");
  if (blocked) return blocked;
  try {
    const result = await runSentinelScan("MANUAL");
    invalidatePrefix("dashboard");
    return Response.json(result);
  } catch (e) {
    console.error("agent scan error", e);
    return Response.json({ error: "Agent scan failed" }, { status: 500 });
  }
}
