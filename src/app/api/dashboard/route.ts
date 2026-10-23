import { guard } from "@/lib/security";
import { db } from "@/lib/db";
import { cached } from "@/lib/cache";
import { listFields, latestReadings, fieldHistory, healthIndex, computeStats } from "@/lib/farm-data";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const blocked = guard(req, "/api/dashboard");
  if (blocked) return blocked;

  try {
    const payload = await cached("dashboard:v1", 15_000, async () => {
      const fields = await listFields();
      const latest = await latestReadings(fields.map((f) => f.id));
      const histories = await Promise.all(fields.map((f) => fieldHistory(f.id, 7)));

      const farm = await db.farm.findFirst({ select: { name: true, location: true, region: true } });

      const fieldCards = fields.map((f, i) => {
        const series = histories[i];
        const lr = latest.get(f.id);
        const stats = {
          moisture: computeStats(series, "soilMoisture"),
          ndvi: computeStats(series, "ndvi"),
        };
        return {
          ...f,
          latest: lr ?? null,
          healthIndex: lr ? healthIndex(lr) : 0,
          moistureMean: Math.round(stats.moisture.mean * 10) / 10,
          moistureSlope: Math.round(stats.moisture.slopePerDay * 100) / 100,
          ndviMean: Math.round(stats.ndvi.mean * 100) / 100,
          spark: series.slice(-24).map((s) => ({
            t: s.recordedAt,
            moisture: s.soilMoisture,
            ndvi: s.ndvi,
          })),
        };
      });

      // Farm-wide daily timeseries (area-weighted means) for the main chart
      const daily = new Map<string, { moisture: number[]; ndvi: number[]; temp: number[] }>();
      for (let i = 0; i < fields.length; i++) {
        const w = Math.max(1, Math.round(fields[i].areaHectares));
        for (const s of histories[i]) {
          const day = s.recordedAt.slice(0, 10);
          const bucket = daily.get(day) ?? { moisture: [], ndvi: [], temp: [] };
          for (let k = 0; k < w; k++) { bucket.moisture.push(s.soilMoisture); bucket.ndvi.push(s.ndvi); bucket.temp.push(s.temperature); }
          daily.set(day, bucket);
        }
      }
      const timeseries = Array.from(daily.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([day, b]) => ({
          day,
          moisture: Math.round((b.moisture.reduce((a, x) => a + x, 0) / b.moisture.length) * 10) / 10,
          ndvi: Math.round((b.ndvi.reduce((a, x) => a + x, 0) / b.ndvi.length) * 100) / 100,
          temperature: Math.round((b.temp.reduce((a, x) => a + x, 0) / b.temp.length) * 10) / 10,
        }));

      const totalArea = fields.reduce((a, f) => a + f.areaHectares, 0);
      const avgHealth = fieldCards.length ? Math.round(fieldCards.reduce((a, f) => a + f.healthIndex, 0) / fieldCards.length) : 0;
      const avgMoisture = fieldCards.length ? Math.round(fieldCards.reduce((a, f) => a + (f.latest?.soilMoisture ?? 0), 0) / fieldCards.length * 10) / 10 : 0;
      const avgNdvi = fieldCards.length ? Math.round(fieldCards.reduce((a, f) => a + (f.latest?.ndvi ?? 0), 0) / fieldCards.length * 100) / 100 : 0;

      const alertCount = await db.alert.count({ where: { status: "OPEN" } });
      const lastRun = await db.agentRun.findFirst({ orderBy: { createdAt: "desc" } });
      const lastIngest = await db.sensorReading.findFirst({ orderBy: { recordedAt: "desc" }, select: { recordedAt: true } });

      // Sustainability metrics (derived)
      const dripArea = fields.filter((f) => f.irrigation === "drip").reduce((a, f) => a + f.areaHectares, 0);
      const waterSavedPct = totalArea ? Math.round((dripArea / totalArea) * 35) : 0; // up to 35% vs flood irrigation
      const forecastYield = fields.reduce((a, f) => {
        const hi = fieldCards.find((c) => c.id === f.id)?.healthIndex ?? 70;
        return a + f.baseYieldTonsPerHa * (0.7 + 0.3 * (hi / 100)) * f.areaHectares;
      }, 0);

      return {
        farm,
        fields: fieldCards,
        timeseries,
        kpis: {
          totalFields: fields.length,
          totalArea: Math.round(totalArea * 10) / 10,
          avgHealth,
          avgMoisture,
          avgNdvi,
          openAlerts: alertCount,
          waterSavedPct,
          forecastYieldTons: Math.round(forecastYield * 10) / 10,
          stressFields: fields.filter((f) => f.status === "STRESS" || f.status === "WATCH").length,
        },
        lastAgentRun: lastRun ? { id: lastRun.id, at: lastRun.createdAt.toISOString(), summary: lastRun.summary, alertsCreated: lastRun.alertsCreated, durationMs: lastRun.durationMs } : null,
        lastIngestAt: lastIngest?.recordedAt.toISOString() ?? null,
      };
    });

    return Response.json(payload, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("dashboard error", e);
    return Response.json({ error: "Failed to build dashboard" }, { status: 500 });
  }
}
