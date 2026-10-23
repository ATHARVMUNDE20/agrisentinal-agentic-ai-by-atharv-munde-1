import { guard, logEvent } from "@/lib/security";
import { db } from "@/lib/db";
import { alertPatchSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const blocked = guard(req, "/api/alerts");
  if (blocked) return blocked;
  try {
    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    const where = status && ["OPEN", "ACKNOWLEDGED", "RESOLVED"].includes(status) ? { status } : {};
    const alerts = await db.alert.findMany({
      where,
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 60,
      include: { field: { select: { name: true, crop: true } } },
    });
    return Response.json({ alerts });
  } catch (e) {
    console.error("alerts GET error", e);
    return Response.json({ error: "Failed to list alerts" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const blocked = guard(req, "/api/alerts");
  if (blocked) return blocked;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    logEvent("VALIDATION_FAILED", "/api/alerts", "invalid JSON body");
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = alertPatchSchema.safeParse(body);
  if (!parsed.success) {
    logEvent("VALIDATION_FAILED", "/api/alerts", "bad status transition payload");
    return Response.json({ error: "Validation failed" }, { status: 422 });
  }
  try {
    const alert = await db.alert.update({
      where: { id: parsed.data.id },
      data: { status: parsed.data.status },
    });
    return Response.json({ alert });
  } catch {
    return Response.json({ error: "Alert not found" }, { status: 404 });
  }
}
