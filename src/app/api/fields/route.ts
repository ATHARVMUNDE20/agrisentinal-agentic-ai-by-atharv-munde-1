import { guard, logEvent, sanitizeText } from "@/lib/security";
import { db } from "@/lib/db";
import { createFieldSchema } from "@/lib/validation";
import { listFields, latestReadings, healthIndex } from "@/lib/farm-data";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const blocked = guard(req, "/api/fields");
  if (blocked) return blocked;
  try {
    const fields = await listFields();
    const latest = await latestReadings(fields.map((f) => f.id));
    const cards = fields.map((f) => {
      const lr = latest.get(f.id);
      return { ...f, latest: lr ?? null, healthIndex: lr ? healthIndex(lr) : 0 };
    });
    return Response.json({ fields: cards });
  } catch (e) {
    console.error("fields GET error", e);
    return Response.json({ error: "Failed to list fields" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const blocked = guard(req, "/api/fields");
  if (blocked) return blocked;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    logEvent("VALIDATION_FAILED", "/api/fields", "invalid JSON body");
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = createFieldSchema.safeParse(body);
  if (!parsed.success) {
    logEvent("VALIDATION_FAILED", "/api/fields", parsed.error.issues.map((i) => i.message).join("; ").slice(0, 150));
    return Response.json({ error: "Validation failed", details: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) }, { status: 422 });
  }
  try {
    const farm = await db.farm.findFirst();
    const field = await db.field.create({
      data: {
        farmId: farm?.id ?? null,
        name: sanitizeText(parsed.data.name, 80),
        crop: sanitizeText(parsed.data.crop, 40),
        variety: parsed.data.variety ? sanitizeText(parsed.data.variety, 60) : null,
        areaHectares: parsed.data.areaHectares,
        soilType: sanitizeText(parsed.data.soilType, 40),
        irrigation: sanitizeText(parsed.data.irrigation, 40),
        baseYieldTonsPerHa: parsed.data.baseYieldTonsPerHa,
        plantedAt: new Date(),
      },
    });
    return Response.json({ field }, { status: 201 });
  } catch (e) {
    console.error("fields POST error", e);
    return Response.json({ error: "Failed to create field" }, { status: 500 });
  }
}
