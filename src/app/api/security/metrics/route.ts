import { guard } from "@/lib/security";
import { getSecurityMetrics } from "@/lib/security";
import { cacheStats } from "@/lib/cache";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const blocked = guard(req, "/api/security/metrics");
  if (blocked) return blocked;
  try {
    const [fields, readings, alerts, diagnoses, runs] = await Promise.all([
      db.field.count(),
      db.sensorReading.count(),
      db.alert.count(),
      db.diagnosis.count(),
      db.agentRun.count(),
    ]);
    return Response.json({
      security: getSecurityMetrics(),
      performance: {
        cache: cacheStats(),
        dataVolume: { fields, readings, alerts, diagnoses, agentRuns: runs },
      },
    });
  } catch (e) {
    console.error("security metrics error", e);
    return Response.json({ error: "Failed to load metrics" }, { status: 500 });
  }
}
