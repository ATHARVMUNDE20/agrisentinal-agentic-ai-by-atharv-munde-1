/**
 * AgriBot — conversational agronomist with an agentic tool-use loop.
 * The model can call read-only farm tools (get_farm_overview, get_field_detail,
 * get_active_alerts, get_recent_diagnoses) before answering. Loop is capped at
 * 3 tool rounds to bound latency and cost.
 */
import { guard, logEvent, sanitizeText } from "@/lib/security";
import { db } from "@/lib/db";
import { chatRequestSchema } from "@/lib/validation";
import { listFields, latestReadings, fieldHistory, computeStats, healthIndex } from "@/lib/farm-data";
import ZAI from "z-ai-web-dev-sdk";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TOOLS = ["get_farm_overview", "get_field_detail", "get_active_alerts", "get_recent_diagnoses"];

async function executeTool(name: string, args: Record<string, unknown>): Promise<string> {
  switch (name) {
    case "get_farm_overview": {
      const fields = await listFields();
      const latest = await latestReadings(fields.map((f) => f.id));
      const open = await db.alert.count({ where: { status: "OPEN" } });
      return JSON.stringify({
        farm: "Green Valley Cooperative Farm",
        fields: fields.map((f) => {
          const lr = latest.get(f.id);
          return { name: f.name, crop: f.crop, area: f.areaHectares, status: f.status, healthIndex: lr ? healthIndex(lr) : null, moisture: lr?.soilMoisture ?? null, ndvi: lr?.ndvi ?? null, nitrogen: lr?.nitrogen ?? null };
        }),
        openAlerts: open,
      });
    }
    case "get_field_detail": {
      const name = String(args.fieldName ?? "").toLowerCase();
      const fields = await listFields();
      const f = fields.find((x) => x.name.toLowerCase().includes(name)) ?? fields.find((x) => x.crop.toLowerCase().includes(name));
      if (!f) return JSON.stringify({ error: "No field matches that name/crop", available: fields.map((x) => x.name) });
      const series = await fieldHistory(f.id, 5);
      const latest = (await latestReadings([f.id])).get(f.id);
      return JSON.stringify({
        field: f,
        latest,
        stats5d: {
          moistureMean: Math.round(computeStats(series, "soilMoisture").mean * 10) / 10,
          moistureSlopePerDay: Math.round(computeStats(series, "soilMoisture").slopePerDay * 100) / 100,
          ndviMean: Math.round(computeStats(series, "ndvi").mean * 100) / 100,
          tempMean: Math.round(computeStats(series, "temperature").mean * 10) / 10,
          nitrogenMean: Math.round(computeStats(series, "nitrogen").mean * 10) / 10,
        },
        healthIndex: latest ? healthIndex(latest) : null,
      });
    }
    case "get_active_alerts": {
      const alerts = await db.alert.findMany({
        where: { status: { in: ["OPEN", "ACKNOWLEDGED"] } },
        orderBy: { createdAt: "desc" }, take: 10,
        include: { field: { select: { name: true } } },
      });
      return JSON.stringify(alerts.map((a) => ({ severity: a.severity, type: a.type, field: a.field?.name, title: a.title, recommendation: a.recommendation, at: a.createdAt.toISOString() })));
    }
    case "get_recent_diagnoses": {
      const items = await db.diagnosis.findMany({ orderBy: { createdAt: "desc" }, take: 5 });
      return JSON.stringify(items.map((d) => ({ crop: d.crop, condition: d.conditionName, status: d.healthStatus, confidence: d.confidence, at: d.createdAt.toISOString() })));
    }
    default:
      return JSON.stringify({ error: `Unknown tool ${name}` });
  }
}

function tryParseToolCall(text: string): { tool: string; args: Record<string, unknown> } | null {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const j = JSON.parse(m[0]);
    if (j && typeof j.tool === "string" && TOOLS.includes(j.tool)) {
      return { tool: j.tool, args: (j.args && typeof j.args === "object" ? j.args : {}) as Record<string, unknown> };
    }
  } catch { /* not JSON */ }
  return null;
}

export async function GET(req: Request) {
  const blocked = guard(req, "/api/chat");
  if (blocked) return blocked;
  const url = new URL(req.url);
  const sessionId = (url.searchParams.get("sessionId") ?? "").slice(0, 64);
  if (!/^[a-zA-Z0-9_-]{6,64}$/.test(sessionId)) return Response.json({ messages: [] });
  const rows = await db.chatMessage.findMany({ where: { sessionId }, orderBy: { createdAt: "asc" }, take: 50 });
  return Response.json({
    messages: rows.map((r) => ({ id: r.id, role: r.role, content: r.content, toolTrace: r.toolTrace ? JSON.parse(r.toolTrace) : [], at: r.createdAt.toISOString() })),
  });
}

export async function POST(req: Request) {
  const blocked = guard(req, "/api/chat");
  if (blocked) return blocked;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    logEvent("VALIDATION_FAILED", "/api/chat", "invalid JSON body");
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = chatRequestSchema.safeParse(body);
  if (!parsed.success) {
    logEvent("VALIDATION_FAILED", "/api/chat", parsed.error.issues[0]?.message ?? "schema mismatch");
    return Response.json({ error: "Validation failed", details: parsed.error.issues.map((i) => i.message) }, { status: 422 });
  }
  const { sessionId } = parsed.data;
  const message = sanitizeText(parsed.data.message, 1000);

  try {
    const history = await db.chatMessage.findMany({ where: { sessionId }, orderBy: { createdAt: "desc" }, take: 12 });
    history.reverse();

    const sysPrompt = `You are AgriBot, the agronomist assistant inside AgriSentinel, monitoring Green Valley Cooperative Farm (Nashik, India). You have read-only tools to fetch live farm data. TOOL CALL PROTOCOL: if and only if you need data, reply with ONLY a JSON object {"tool": "get_farm_overview"|"get_field_detail"|"get_active_alerts"|"get_recent_diagnoses", "args": {"fieldName": "optional field or crop name"}} — nothing else. After tool results arrive as assistant messages prefixed [TOOL_RESULT], continue: call another tool the same way if needed, otherwise give the final answer. FINAL ANSWERS: concise, practical agronomy advice grounded in the fetched numbers; use short markdown bullets; mention concrete values (moisture %, NDVI, ppm). Never invent sensor numbers you did not fetch.`;

    const msgs: { role: "assistant" | "user"; content: string }[] = [
      { role: "assistant", content: sysPrompt },
      ...history.map((h) => ({ role: h.role === "user" ? ("user" as const) : ("assistant" as const), content: h.role === "user" ? h.content : `[EARLIER_ANSWER] ${h.content.slice(0, 600)}` })),
      { role: "user", content: message },
    ];

    const zai = await ZAI.create();
    const toolTrace: string[] = [];
    let final = "";
    let toolCalls = 0;
    const MAX_TOOL_ROUNDS = 3;

    while (toolCalls < MAX_TOOL_ROUNDS) {
      const completion = await zai.chat.completions.create({
        messages: msgs,
        thinking: { type: "disabled" },
      });
      const text = completion.choices[0]?.message?.content ?? "";
      const call = tryParseToolCall(text);
      if (call) {
        toolCalls += 1;
        toolTrace.push(call.tool + (call.args.fieldName ? `(${call.args.fieldName})` : ""));
        const result = await executeTool(call.tool, call.args);
        msgs.push({ role: "assistant", content: text.slice(0, 200) });
        msgs.push({ role: "user", content: `[TOOL_RESULT] ${result.slice(0, 4000)}` });
        continue;
      }
      final = text;
      break;
    }

    if (!final) {
      // Tool budget exhausted — force one final grounded answer from gathered data
      msgs.push({ role: "user", content: "[SYSTEM] Tool budget exhausted. Using ONLY the [TOOL_RESULT] data above, give your final answer now. Do not request more tools." });
      try {
        const forced = await zai.chat.completions.create({ messages: msgs, thinking: { type: "disabled" } });
        final = forced.choices[0]?.message?.content ?? "";
      } catch { /* fall through to generic fallback */ }
    }

    if (!final || /^\s*$/.test(final)) {
      final = "I could not complete the analysis. Please rephrase or try again.";
    }

    await db.chatMessage.create({ data: { sessionId, role: "user", content: message } });
    const saved = await db.chatMessage.create({
      data: { sessionId, role: "assistant", content: final, toolTrace: JSON.stringify(toolTrace) },
    });

    // Bounded history per session (keep last 50)
    const all = await db.chatMessage.findMany({ where: { sessionId }, orderBy: { createdAt: "desc" }, skip: 50, select: { id: true } });
    if (all.length) await db.chatMessage.deleteMany({ where: { id: { in: all.map((r) => r.id) } } });

    return Response.json({ id: saved.id, content: final, toolTrace, at: saved.createdAt.toISOString() });
  } catch (e) {
    console.error("chat POST error", e);
    return Response.json({ error: "AgriBot is unavailable. Please retry." }, { status: 502 });
  }
}
