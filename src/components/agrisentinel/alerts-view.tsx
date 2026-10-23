"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Bot, BrainCircuit, Check, CircleCheck, Loader2, TriangleAlert, Wrench } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { SEVERITY_STYLES, type AlertItem } from "@/components/agrisentinel/types";
import { cn } from "@/lib/utils";

export function AlertsView() {
  const { toast } = useToast();
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [filter, setFilter] = useState<string>("ALL");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/alerts", { cache: "no-store" });
      if (res.ok) {
        const j = await res.json();
        setAlerts(j.alerts);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const patch = useCallback(async (id: string, status: string) => {
    setBusyId(id);
    try {
      const res = await fetch("/api/alerts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      if (!res.ok) throw new Error();
      setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)));
      toast({ title: status === "RESOLVED" ? "Alert resolved" : "Alert acknowledged" });
    } catch {
      toast({ title: "Update failed", variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  }, [toast]);

  const shown = filter === "ALL" ? alerts : alerts.filter((a) => a.status === filter);
  const openCount = alerts.filter((a) => a.status === "OPEN").length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2"><TriangleAlert className="h-5 w-5 text-amber-600" aria-hidden /> Alert inbox</h1>
          <p className="text-sm text-muted-foreground">{openCount} open · {alerts.length} total — every alert carries the agent&apos;s reasoning chain and a concrete action plan.</p>
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[180px]" aria-label="Filter by status"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            <SelectItem value="OPEN">Open</SelectItem>
            <SelectItem value="ACKNOWLEDGED">Acknowledged</SelectItem>
            <SelectItem value="RESOLVED">Resolved</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-28 rounded-xl bg-card border border-border animate-pulse" />)}</div>
      ) : shown.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CircleCheck className="mx-auto h-10 w-10 text-primary" aria-hidden />
            <p className="mt-3 font-medium">No alerts in this bucket</p>
            <p className="text-sm text-muted-foreground mt-1">Run a Sentinel scan from the Command Center to hunt for fresh issues.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {shown.map((a, i) => (
            <motion.div key={a.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.04, 0.3) }}>
              <Card className={cn("overflow-hidden", a.status === "RESOLVED" && "opacity-70")}>
                <CardHeader className="pb-2">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className={cn("text-[10px] shrink-0", SEVERITY_STYLES[a.severity] ?? "")}>{a.severity}</Badge>
                        <Badge variant="secondary" className="text-[10px]">{a.type.replace(/_/g, " ")}</Badge>
                        {a.field && <span className="text-xs text-muted-foreground truncate">{a.field.name} · {a.field.crop}</span>}
                      </div>
                      <CardTitle className="text-sm mt-1.5 leading-snug">{a.title}</CardTitle>
                      <CardDescription className="text-xs">{new Date(a.createdAt).toLocaleString()} · source: {a.source === "AGENT" ? "Sentinel agent (LLM reasoning)" : "Deterministic rules"}</CardDescription>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {a.status !== "ACKNOWLEDGED" && a.status !== "RESOLVED" && (
                        <Button size="sm" variant="outline" disabled={busyId === a.id} onClick={() => patch(a.id, "ACKNOWLEDGED")}>
                          {busyId === a.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Check className="h-3.5 w-3.5" aria-hidden />} Acknowledge
                        </Button>
                      )}
                      {a.status !== "RESOLVED" && (
                        <Button size="sm" className="bg-primary hover:bg-primary/90" disabled={busyId === a.id} onClick={() => patch(a.id, "RESOLVED")}>
                          <CircleCheck className="h-3.5 w-3.5" aria-hidden /> Resolve
                        </Button>
                      )}
                      {a.status === "RESOLVED" && <Badge variant="outline" className="text-[10px] border-emerald-300 text-emerald-700">Resolved</Badge>}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm leading-relaxed">{a.message}</p>
                  {a.recommendation && (
                    <div className="rounded-lg border border-primary/25 bg-secondary/50 p-3">
                      <p className="text-xs font-semibold flex items-center gap-1.5 text-primary"><Wrench className="h-3.5 w-3.5" aria-hidden /> Prescribed action</p>
                      <p className="text-sm mt-1 leading-relaxed">{a.recommendation}</p>
                    </div>
                  )}
                  {a.agentReasoning && (
                    <Accordion type="single" collapsible>
                      <AccordionItem value="reasoning" className="border-none">
                        <AccordionTrigger className="text-xs py-1.5 text-muted-foreground hover:no-underline"><span className="flex items-center gap-1.5"><BrainCircuit className="h-3.5 w-3.5" aria-hidden /> Why did the agent flag this?</span></AccordionTrigger>
                        <AccordionContent className="text-xs text-muted-foreground leading-relaxed">{a.agentReasoning}</AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      <Card className="border-dashed">
        <CardHeader className="pb-1">
          <CardTitle className="text-sm flex items-center gap-2"><Bot className="h-4 w-4 text-primary" aria-hidden /> How alerts are produced</CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground leading-relaxed">
          The Sentinel agent merges two engines: (1) deterministic threshold/z-score/trend rules that never miss a hard limit, and (2) an LLM reasoning pass that ranks root causes, cites the statistics and writes the action plan. Duplicates are suppressed with a 6-hour window per field and alert type.
        </CardContent>
      </Card>
    </div>
  );
}
