import { guard, logEvent } from "@/lib/security";
import { ingestTick } from "@/lib/telemetry";
import { ingestSchema } from "@/lib/validation";
import { invalidatePrefix } from "@/lib/cache";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const blocked = guard(req, "/api/telemetry/ingest");
  if (blocked) return blocked;
  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const parsed = ingestSchema.safeParse(body);
  if (!parsed.success) {
    logEvent("VALIDATION_FAILED", "/api/telemetry/ingest", "bad profile enum");
    return Response.json({ error: "Validation failed" }, { status: 422 });
  }
  try {
    const result = await ingestTick(parsed.data.profile);
    invalidatePrefix("dashboard");
    return Response.json(result);
  } catch (e) {
    console.error("ingest error", e);
    return Response.json({ error: "Ingest failed" }, { status: 500 });
  }
}
