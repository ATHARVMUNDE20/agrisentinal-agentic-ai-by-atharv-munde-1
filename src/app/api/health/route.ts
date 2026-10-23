export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ status: "ok", service: "AgriSentinel", at: new Date().toISOString() });
}
