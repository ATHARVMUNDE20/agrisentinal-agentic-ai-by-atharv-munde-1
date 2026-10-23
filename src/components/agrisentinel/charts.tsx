"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { DashboardData } from "@/components/agrisentinel/types";

const GREEN = "oklch(0.55 0.14 150)";
const AMBER = "oklch(0.72 0.15 75)";
const OLIVE = "oklch(0.62 0.1 115)";
const BROWN = "oklch(0.45 0.09 140)";

const tooltipStyle = {
  borderRadius: 10,
  border: "1px solid oklch(0.9 0.025 125)",
  backgroundColor: "white",
  fontSize: 12,
  boxShadow: "0 4px 14px oklch(0.3 0.03 150 / 0.12)",
} as const;

export function FarmTimeseries({ data }: { data: DashboardData["timeseries"] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.02 125)" />
        <XAxis dataKey="day" tick={{ fontSize: 11, fill: "oklch(0.45 0.03 150)" }} tickFormatter={(v: string) => v.slice(5)} />
        <YAxis yAxisId="m" domain={[0, 100]} tick={{ fontSize: 11, fill: "oklch(0.45 0.03 150)" }} />
        <YAxis yAxisId="t" orientation="right" domain={[0, 50]} tick={{ fontSize: 11, fill: "oklch(0.45 0.03 150)" }} />
        <Tooltip contentStyle={tooltipStyle} labelFormatter={(l) => `Day ${l}`} />
        <Line yAxisId="m" type="monotone" dataKey="moisture" name="Soil moisture %" stroke={GREEN} strokeWidth={2.2} dot={false} />
        <Line yAxisId="t" type="monotone" dataKey="temperature" name="Temp °C" stroke={AMBER} strokeWidth={1.8} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function NdviTrend({ data }: { data: DashboardData["timeseries"] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
        <defs>
          <linearGradient id="ndviFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={OLIVE} stopOpacity={0.45} />
            <stop offset="100%" stopColor={OLIVE} stopOpacity={0.04} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.02 125)" />
        <XAxis dataKey="day" tick={{ fontSize: 11, fill: "oklch(0.45 0.03 150)" }} tickFormatter={(v: string) => v.slice(5)} />
        <YAxis domain={[0, 1]} tick={{ fontSize: 11, fill: "oklch(0.45 0.03 150)" }} />
        <Tooltip contentStyle={tooltipStyle} labelFormatter={(l) => `Day ${l}`} />
        <Area type="monotone" dataKey="ndvi" name="NDVI" stroke={OLIVE} strokeWidth={2.2} fill="url(#ndviFill)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function FieldHealthBars({ data }: { data: DashboardData["fields"] }) {
  const rows = data.map((f) => ({ name: f.name.split(" ")[0], crop: f.crop, health: f.healthIndex, status: f.status }));
  const color = (status: string) => (status === "HEALTHY" ? GREEN : status === "WATCH" ? AMBER : status === "STRESS" ? "#c2410c" : "#b91c1c");
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={rows} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.02 125)" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: "oklch(0.45 0.03 150)" }} />
        <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "oklch(0.45 0.03 150)" }} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v: number, _n, p) => [`${v} / 100 (${p.payload.status})`, p.payload.crop]} />
        <Bar dataKey="health" name="Health index" radius={[6, 6, 0, 0]} maxBarSize={46}>
          {rows.map((r, i) => (
            <Cell key={i} fill={color(r.status)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function Sparkline({ data, stroke }: { data: { moisture: number }[]; stroke?: string }) {
  return (
    <ResponsiveContainer width="100%" height={38}>
      <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
        <Area type="monotone" dataKey="moisture" stroke={stroke ?? BROWN} strokeWidth={1.6} fill={stroke ?? BROWN} fillOpacity={0.12} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
