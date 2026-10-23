import { guard, logEvent, validateImageDataUrl, sanitizeText } from "@/lib/security";
import { db } from "@/lib/db";
import { diagnoseSchema } from "@/lib/validation";
import ZAI from "z-ai-web-dev-sdk";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type VisionResult = {
  isCropImage: boolean;
  healthStatus: "HEALTHY" | "DISEASED" | "PEST" | "NUTRIENT_DEFICIENT" | "UNKNOWN";
  conditionName: string;
  confidence: number;
  severity: "NONE" | "MILD" | "MODERATE" | "SEVERE";
  description: string;
  treatment: string[];
  prevention: string[];
  reasoning: string;
};

function parseVisionJson(raw: string): Partial<VisionResult> | null {
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]);
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const blocked = guard(req, "/api/diagnose");
  if (blocked) return blocked;
  try {
    const items = await db.diagnosis.findMany({ orderBy: { createdAt: "desc" }, take: 12 });
    return Response.json({
      diagnoses: items.map((d) => ({
        id: d.id, crop: d.crop, isCropImage: d.isCropImage, healthStatus: d.healthStatus,
        conditionName: d.conditionName, confidence: d.confidence, severity: d.severity,
        description: d.description, treatment: JSON.parse(d.treatment ?? "[]"),
        prevention: JSON.parse(d.prevention ?? "[]"), imageMeta: d.imageMeta, at: d.createdAt.toISOString(),
      })),
    });
  } catch (e) {
    console.error("diagnose GET error", e);
    return Response.json({ error: "Failed to list diagnoses" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const blocked = guard(req, "/api/diagnose");
  if (blocked) return blocked;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    logEvent("VALIDATION_FAILED", "/api/diagnose", "invalid JSON body");
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = diagnoseSchema.safeParse(body);
  if (!parsed.success) {
    logEvent("VALIDATION_FAILED", "/api/diagnose", parsed.error.issues[0]?.message ?? "schema mismatch");
    return Response.json({ error: "Validation failed", details: parsed.error.issues.map((i) => i.message) }, { status: 422 });
  }

  // Hardened image validation: MIME allowlist + magic-byte sniffing + 4MB cap
  const img = validateImageDataUrl(parsed.data.image);
  if (!img.ok) {
    logEvent(img.reason.includes("large") ? "PAYLOAD_TOO_LARGE" : "BAD_IMAGE", "/api/diagnose", img.reason);
    return Response.json({ error: img.reason }, { status: 415 });
  }

  const cropHint = sanitizeText(parsed.data.cropHint ?? "", 40);
  const note = sanitizeText(parsed.data.note ?? "", 300);

  try {
    const zai = await ZAI.create();
    const response = await zai.chat.completions.createVision({
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `You are the AgriSentinel Diagnosis Agent, a plant-pathology expert. Analyze the attached crop photo. ${cropHint ? `Farmer says the crop is: ${cropHint}. ` : ""}${note ? `Farmer note: ${note}. ` : ""}Return STRICT JSON only, no markdown fences, in this exact shape: {"isCropImage": true|false, "healthStatus": "HEALTHY"|"DISEASED"|"PEST"|"NUTRIENT_DEFICIENT"|"UNKNOWN", "conditionName": "short name or 'Healthy'", "confidence": 0-100, "severity": "NONE"|"MILD"|"MODERATE"|"SEVERE", "description": "what you see, 2-3 sentences", "treatment": ["step 1", "step 2", "step 3"], "prevention": ["step 1", "step 2"], "reasoning": "visual evidence you relied on, 1-2 sentences"}. If the image is not a plant/crop, set isCropImage=false, healthStatus=UNKNOWN, confidence=0 and explain briefly in description.`,
            },
            { type: "image_url", image_url: { url: `data:${img.mime};base64,${img.base64}` } },
          ],
        },
      ],
      thinking: { type: "disabled" },
    });

    const raw = response.choices[0]?.message?.content ?? "";
    const v = parseVisionJson(raw);
    if (!v) {
      // Model replied but without parseable JSON — wrap raw text as description
      const fallback: VisionResult = {
        isCropImage: true, healthStatus: "UNKNOWN", conditionName: "Unclassified observation",
        confidence: 40, severity: "UNKNOWN" as unknown as VisionResult["severity"],
        description: raw.slice(0, 800) || "The model could not produce a structured verdict.",
        treatment: [], prevention: [], reasoning: "Raw model output (unstructured).",
      };
      await persist(fallback, img.bytes);
      return Response.json({ diagnosis: { ...fallback, severity: "UNKNOWN" } });
    }

    const result: VisionResult = {
      isCropImage: Boolean(v.isCropImage),
      healthStatus: (["HEALTHY", "DISEASED", "PEST", "NUTRIENT_DEFICIENT", "UNKNOWN"].includes(v.healthStatus ?? "") ? v.healthStatus : "UNKNOWN") as VisionResult["healthStatus"],
      conditionName: String(v.conditionName ?? "Unknown").slice(0, 120),
      confidence: Math.max(0, Math.min(100, Number(v.confidence ?? 0))),
      severity: (["NONE", "MILD", "MODERATE", "SEVERE"].includes(v.severity ?? "") ? v.severity : "UNKNOWN") as VisionResult["severity"],
      description: String(v.description ?? "").slice(0, 1200),
      treatment: Array.isArray(v.treatment) ? v.treatment.map((s) => String(s).slice(0, 300)).slice(0, 8) : [],
      prevention: Array.isArray(v.prevention) ? v.prevention.map((s) => String(s).slice(0, 300)).slice(0, 6) : [],
      reasoning: String(v.reasoning ?? "").slice(0, 600),
    };
    const saved = await persist(result, img.bytes);
    return Response.json({ diagnosis: { ...result, id: saved.id, at: saved.createdAt.toISOString() } });
  } catch (e) {
    console.error("diagnose POST error", e);
    return Response.json({ error: "Vision diagnosis failed. Please retry." }, { status: 502 });
  }
}

async function persist(result: VisionResult, bytes: number) {
  return db.diagnosis.create({
    data: {
      isCropImage: result.isCropImage,
      healthStatus: result.healthStatus,
      conditionName: result.conditionName,
      confidence: result.confidence,
      severity: ["NONE", "MILD", "MODERATE", "SEVERE"].includes(result.severity) ? result.severity : null,
      description: result.description,
      treatment: JSON.stringify(result.treatment),
      prevention: JSON.stringify(result.prevention),
      agentReasoning: result.reasoning,
      imageMeta: JSON.stringify({ bytes }),
    },
  });
}
