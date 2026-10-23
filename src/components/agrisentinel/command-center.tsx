"use client";

import { useCallback, useState } from "react";
import { motion } from "framer-motion";
import { Activity, Bot, CloudRain, Droplets, Gauge, Leaf, Loader2, Play, ScanLine, Sun, ThermometerSun, TriangleAlert, Waves } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { FarmTimeseries, NdviTrend, FieldHealthBars, Sparkline } from "@/components/agrisentinel/charts";
import { STATUS_STYLES, type DashboardData, type ScanResult } from "@/components/agrisentinel/types";
import { cn } from "@/lib/utils";

type Props = {
  data: DashboardData | null;
  onRefresh: () => Promise<void>;
  gotoAlerts: () => void;
  gotoDiagnose: () => void;
};

export function CommandCenter({ data, onRefresh, gotoAlerts, gotoDiagnose }: Props) {
  const { toast } = useToast();
  const [scanning, setScanning] = useState(false);
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [ingesting, setIngesting] = useState<string | null>(null);

  const runScan = useCallback(async () => {
    setScanning(true);
    setScan(null);
    try {
      const res = await fetch("/api/agent/scan", { method: "POST" });
      if (!res.ok) throw new Error("scan failed");
      const result: ScanResult = await res.json();
      setScan(result);
      await onRefresh();
      toast({
        title: result.alertsCreated > 0 ? `Sentinel found ${result.alertsCreated} new issue(s)` : "Sentinel scan complete — all nominal",
        description: `${result.mode} · ${result.fieldsScanned} fields · ${result.durationMs} ms`,
      });
    } catch {
      toast({ title: "Agent scan failed", description: "Please retry in a moment.", variant: "destructive" });
    } finally {
      setScanning(false);
    }
  }, [onRefresh, toast]);

  const ingest = useCallback(async (profile: string) => {
    setIngesting(profile);
    try {
      const res = await fetch("/api/telemetry/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile }),
      });
      if (!res.ok) throw new Error();
      await onRefresh();
      toast({ title: "Telemetry ingested", description: `Scenario "${profile}" pushed fresh sensor readings to all fields.` });
    } catch {
      toast({ title: "Ingest failed", variant: "destructive" });
    } finally {
      setIngesting(null);
    }
  }, [onRefresh, toast]);

  if (!data) return <p className="text-sm text-muted-foreground">Loading command center…</p>;

  const { kpis, farm, fields, timeseries, lastAgentRun } = data;

  return (
    <div className="space-y-6">
      {/* Hero */}
      <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-emerald-900/10 bg-gradient-to-br from-emerald-950 via-green-900 to-emerald-800 p-6 sm:p-8 text-emerald-50 shadow-md">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5">
          <div className="max-w-xl">
            <Badge className="mb-3 bg-lime-400/95 text-emerald-950 hover:bg-lime-300 border-0">Autonomous agent · online</Badge>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-balance">{farm?.name ?? "Cooperative Farm"} Command Center</h1>
            <p className="mt-2 text-sm text-emerald-100/85 leading-relaxed">
              {farm?.location}{farm?.region ? `, ${farm.region}` : ""} — {kpis.totalFields} fields · {kpis.totalArea} ha under continuous AI watch. The Sentinel agent observes telemetry, detects anomalies, reasons over root causes and prescribes actions before losses happen.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2.5 shrink-0">
            <Button onClick={runScan} disabled={scanning} size="lg" className="bg-lime-400 text-emerald-950 hover:bg-lime-300 font-semibold shadow">
              {scanning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : <Play className="mr-2 h-4 w-4" aria-hidden />}
              {scanning ? "Agent scanning…" : "Run Sentinel Scan"}
            </Button>
            <Button onClick={gotoDiagnose} size="lg" variant="outline" className="border-emerald-500/40 bg-emerald-900/40 text-emerald-50 hover:bg-emerald-800/60 hover:text-white">
              <ScanLine className="mr-2 h-4 w-4" aria-hidden /> Diagnose crop photo
            </Button>
          </div>
        </div>
      </motion.section>

      {/* Agent trace / last run */}
      {(scanning || scan || lastAgentRun) && (
        <AgentPanel scanning={scanning} scan={scan} lastAgentRun={lastAgentRun} />
      )}

      {/* KPI cards */}
      <section aria-label="Key indicators" className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <KpiCard icon={Gauge} label="Crop Health Index" value={`${kpis.avgHealth}`} unit="/ 100" hint="Blended NDVI · moisture · nutrients · pH" tone="green" />
        <KpiCard icon={Droplets} label="Avg soil moisture" value={`${kpis.avgMoisture}`} unit="%" hint="Farm-wide, latest telemetry tick" tone="brown" />
        <KpiCard icon={Leaf} label="Mean NDVI" value={`${kpis.avgNdvi}`} unit="" hint="Canopy vigor across all fields" tone="olive" />
        <KpiCard icon={TriangleAlert} label="Open alerts" value={`${kpis.openAlerts}`} unit="" hint={kpis.stressFields > 0 ? `${kpis.stressFields} field(s) on watch/stress` : "All fields stable"} tone={kpis.openAlerts > 0 ? "amber" : "green"} onClick={gotoAlerts} />
      </section>

      {/* Charts */}
      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><Activity className="h-4 w-4 text-primary" aria-hidden /> 14-day moisture &amp; temperature</CardTitle>
            <CardDescription>Area-weighted farm averages from 678+ sensor records</CardDescription>
          </CardHeader>
          <CardContent><FarmTimeseries data={timeseries} /></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><Waves className="h-4 w-4 text-primary" aria-hidden /> NDVI canopy vigor</CardTitle>
            <CardDescription>Vegetation index trend, 0–1 scale</CardDescription>
          </CardHeader>
          <CardContent><NdviTrend data={timeseries} /></CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><Leaf className="h-4 w-4 text-primary" aria-hidden /> Field health ranking</CardTitle>
            <CardDescription>Composite 0–100 index per field</CardDescription>
          </CardHeader>
          <CardContent><FieldHealthBars data={fields} /></CardContent>
        </Card>

        {/* Telemetry simulator */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><CloudRain className="h-4 w-4 text-primary" aria-hidden /> IoT ingest simulator</CardTitle>
            <CardDescription>Push a new telemetry tick under a weather scenario</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {[
              { key: "normal", label: "Normal conditions", icon: Sun },
              { key: "heatwave", label: "Heatwave (35°C+)", icon: ThermometerSun },
              { key: "rain", label: "Heavy rainfall", icon: CloudRain },
              { key: "dryspell", label: "Dry spell", icon: Droplets },
            ].map((s) => (
              <Button key={s.key} variant="outline" disabled={ingesting !== null} onClick={() => ingest(s.key)} className="w-full justify-start border-input">
                {ingesting === s.key ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : <s.icon className="mr-2 h-4 w-4 text-primary" aria-hidden />}
                {s.label}
              </Button>
            ))}
            <p className="text-xs text-muted-foreground pt-1">Last ingest: {data.lastIngestAt ? new Date(data.lastIngestAt).toLocaleTimeString() : "—"}</p>
          </CardContent>
        </Card>
      </section>

      {/* Field grid */}
      <section aria-label="Fields overview">
        <h2 className="text-lg font-semibold mb-3">Fields under watch</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {fields.map((f, i) => (
            <motion.div key={f.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card className="h-full hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-sm font-semibold leading-tight">{f.name}</CardTitle>
                      <CardDescription className="text-xs">{f.crop}{f.variety ? ` · ${f.variety}` : ""} · {f.areaHectares} ha</CardDescription>
                    </div>
                    <Badge variant="outline" className={cn("text-[10px] shrink-0", STATUS_STYLES[f.status] ?? "")}>{f.status}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Health index</span>
                    <span className="font-semibold text-foreground">{f.healthIndex}/100</span>
                  </div>
                  <Progress value={f.healthIndex} className="h-2" aria-label={`${f.name} health ${f.healthIndex} of 100`} />
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <MiniStat label="Moisture" value={`${f.latest?.soilMoisture ?? "—"}%`} />
                    <MiniStat label="NDVI" value={`${f.latest?.ndvi ?? "—"}`} />
                    <MiniStat label="Nitrogen" value={f.latest ? `${f.latest.nitrogen} ppm` : "—"} />
                  </div>
                  <div className="pt-1">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">24-tick moisture</p>
                    <Sparkline data={f.spark} />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  );
}

function AgentPanel({ scanning, scan, lastAgentRun }: { scanning: boolean; scan: ScanResult | null; lastAgentRun: DashboardData["lastAgentRun"] }) {
  const steps = scan?.steps ?? [];
  const shown = scanning || steps.length > 0;
  return (
    <Card className="border-primary/25 bg-secondary/40">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2"><Bot className="h-4 w-4 text-primary" aria-hidden /> Sentinel Agent activity</CardTitle>
        <CardDescription>Observe → detect → reason → act, fully autonomously</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {shown && (
          <ol className="space-y-1.5 text-sm">
            {(scanning ? [
              { tool: "observe_telemetry", detail: "Pulling latest readings + 7-day history per field" },
              { tool: "detect_anomalies", detail: "Threshold + z-score + trend checks" },
              { tool: "reason_with_llm", detail: "Prioritizing root causes and prescribing actions" },
              { tool: "act_persist_alerts", detail: "Deduping against last 6h and persisting" },
            ] : steps).map((s, i) => (
              <motion.li key={i} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.12 }} className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/15 text-primary text-[10px] font-bold">{i + 1}</span>
                <code className="text-xs font-mono text-primary bg-primary/10 rounded px-1.5 py-0.5">{s.tool}</code>
                <span className="text-muted-foreground text-xs truncate">{s.detail}</span>
                {!scanning && <span className="ml-auto text-[10px] text-muted-foreground shrink-0">{s.ms} ms</span>}
              </motion.li>
            ))}
          </ol>
        )}
        <Separator />
        <div className="text-sm">
          {scan ? (
            <div className="space-y-1">
              <p><Badge variant="outline" className="mr-2 border-primary/40 text-primary">{scan.mode}</Badge><span className="font-medium">{scan.summary}</span></p>
              <p className="text-xs text-muted-foreground">{scan.fieldsScanned} fields · {scan.alertsCreated} new alerts · completed in {scan.durationMs} ms</p>
            </div>
          ) : scanning ? (
            <p className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Agent is reasoning over live telemetry…</p>
          ) : lastAgentRun ? (
            <div className="space-y-1">
              <p><span className="font-medium">Last run:</span> {lastAgentRun.summary}</p>
              <p className="text-xs text-muted-foreground">{new Date(lastAgentRun.at).toLocaleString()} · {lastAgentRun.alertsCreated} alerts · {lastAgentRun.durationMs} ms</p>
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function KpiCard({ icon: Icon, label, value, unit, hint, tone, onClick }: { icon: typeof Gauge; label: string; value: string; unit: string; hint: string; tone: "green" | "brown" | "olive" | "amber"; onClick?: () => void }) {
  const tones: Record<string, string> = {
    green: "bg-emerald-100 text-emerald-800",
    brown: "bg-amber-50 text-amber-900",
    olive: "bg-lime-100 text-lime-900",
    amber: "bg-orange-100 text-orange-900",
  };
  return (
    <button onClick={onClick} disabled={!onClick} className={cn("text-left rounded-xl border bg-card p-4 shadow-sm transition-all focus-visible:ring-2 focus-visible:ring-ring", onClick && "hover:shadow-md hover:-translate-y-0.5 cursor-pointer", !onClick && "cursor-default")}>
      <div className="flex items-center gap-2">
        <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg", tones[tone])}><Icon className="h-4 w-4" aria-hidden /></span>
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
      </div>
      <p className="mt-2.5 text-2xl font-bold tracking-tight">{value}<span className="text-sm font-medium text-muted-foreground ml-0.5">{unit}</span></p>
      <p className="mt-1 text-[11px] text-muted-foreground leading-snug">{hint}</p>
    </button>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-secondary/60 py-1.5">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-xs font-semibold">{value}</p>
    </div>
  );
}
