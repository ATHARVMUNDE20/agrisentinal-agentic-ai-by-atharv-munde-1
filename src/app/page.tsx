"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Activity, Bot, LayoutDashboard, Leaf, ScanLine, ShieldCheck, Sprout, TriangleAlert } from "lucide-react";
import { CommandCenter } from "@/components/agrisentinel/command-center";
import { FieldsView } from "@/components/agrisentinel/fields-view";
import { DiagnoseView } from "@/components/agrisentinel/diagnose-view";
import { ChatView } from "@/components/agrisentinel/chat-view";
import { AlertsView } from "@/components/agrisentinel/alerts-view";
import { SecurityView } from "@/components/agrisentinel/security-view";
import type { DashboardData } from "@/components/agrisentinel/types";
import { cn } from "@/lib/utils";

type ViewKey = "command" | "fields" | "diagnose" | "alerts" | "chat" | "security";

const NAV: { key: ViewKey; label: string; icon: typeof LayoutDashboard }[] = [
  { key: "command", label: "Command Center", icon: LayoutDashboard },
  { key: "fields", label: "Fields", icon: Sprout },
  { key: "diagnose", label: "AI Diagnosis", icon: ScanLine },
  { key: "alerts", label: "Alerts", icon: TriangleAlert },
  { key: "chat", label: "AgriBot", icon: Bot },
  { key: "security", label: "Trust & Impact", icon: ShieldCheck },
];

export default function Home() {
  const [view, setView] = useState<ViewKey>("command");
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [booting, setBooting] = useState(true);
  const [tick, setTick] = useState(0);
  const mainRef = useRef<HTMLDivElement>(null);

  const loadDashboard = useMemo(
    () => async () => {
      try {
        const res = await fetch("/api/dashboard", { cache: "no-store" });
        if (res.ok) setDashboard(await res.json());
      } catch {
        /* keep previous data on transient failure */
      } finally {
        setBooting(false);
      }
    },
    []
  );

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard, tick]);

  // Light telemetry heartbeat: pull fresh dashboard every 45s while on the command center
  useEffect(() => {
    if (view !== "command") return;
    const id = setInterval(() => setTick((t) => t + 1), 45_000);
    return () => clearInterval(id);
  }, [view]);

  const switchTo = (v: ViewKey) => {
    setView(v);
    mainRef.current?.scrollTo({ top: 0 });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-emerald-900/10 bg-gradient-to-r from-emerald-950 via-green-900 to-emerald-950 text-emerald-50 shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex h-16 items-center justify-between gap-3">
            <button onClick={() => switchTo("command")} className="flex items-center gap-2.5 group" aria-label="AgriSentinel home">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-lime-400/90 text-emerald-950 shadow-inner group-hover:rotate-6 transition-transform">
                <Leaf className="h-5 w-5" aria-hidden />
              </span>
              <span className="leading-tight text-left">
                <span className="block text-base font-bold tracking-tight">AgriSentinel</span>
                <span className="block text-[11px] text-emerald-200/80 -mt-0.5">Agentic Crop Health Intelligence</span>
              </span>
            </button>

            <div className="flex items-center gap-3">
              <span className="hidden md:inline-flex items-center gap-1.5 rounded-full bg-emerald-800/60 px-3 py-1 text-xs font-medium text-emerald-100 border border-emerald-700/50">
                <span className="live-dot h-1.5 w-1.5 rounded-full bg-lime-300" aria-hidden />
                Live telemetry
              </span>
              {dashboard && (
                <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-emerald-800/60 px-3 py-1 text-xs text-emerald-100 border border-emerald-700/50" title="Open alerts">
                  <Activity className="h-3.5 w-3.5" aria-hidden />
                  {dashboard.kpis.openAlerts} alerts
                </span>
              )}
            </div>
          </div>

          {/* Nav */}
          <nav aria-label="Primary" className="flex gap-1 overflow-x-auto agri-scroll pb-2 -mt-0.5">
            {NAV.map((n) => (
              <button
                key={n.key}
                onClick={() => switchTo(n.key)}
                aria-current={view === n.key ? "page" : undefined}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  view === n.key
                    ? "bg-lime-400/95 text-emerald-950 shadow"
                    : "text-emerald-100/85 hover:bg-emerald-800/60 hover:text-white"
                )}
              >
                <n.icon className="h-4 w-4" aria-hidden />
                {n.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Main */}
      <main ref={mainRef} className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 py-6">
        {booting && !dashboard ? (
          <BootSkeleton />
        ) : (
          <>
            {view === "command" && <CommandCenter data={dashboard} onRefresh={loadDashboard} gotoAlerts={() => switchTo("alerts")} gotoDiagnose={() => switchTo("diagnose")} />}
            {view === "fields" && <FieldsView onChanged={loadDashboard} />}
            {view === "diagnose" && <DiagnoseView />}
            {view === "alerts" && <AlertsView />}
            {view === "chat" && <ChatView />}
            {view === "security" && <SecurityView dashboard={dashboard} />}
          </>
        )}
      </main>

      {/* Footer — sticks to bottom via flex column + mt-auto */}
      <footer className="mt-auto border-t border-emerald-900/10 bg-emerald-950 text-emerald-200">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <p>
            <span className="font-semibold text-emerald-50">AgriSentinel</span> — agentic crop health intelligence for sustainability &amp; food security. Original application built on disclosed open libraries.
          </p>
          <p className="text-emerald-300/70">
            Next.js 16 · TypeScript · Prisma/SQLite · shadcn/ui · Recharts · z-ai-web-dev-sdk (pretrained LLM/VLM)
          </p>
        </div>
      </footer>
    </div>
  );
}

function BootSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 rounded-xl bg-card border border-border animate-pulse" />
        ))}
      </div>
      <div className="h-72 rounded-xl bg-card border border-border animate-pulse" />
      <div className="h-40 rounded-xl bg-card border border-border animate-pulse" />
    </div>
  );
}
