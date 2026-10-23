/** Shared client-side types for AgriSentinel UI */

export type ReadingLite = {
  recordedAt: string;
  soilMoisture: number;
  temperature: number;
  humidity: number;
  soilPh: number;
  ndvi: number;
  lightIntensity: number;
  rainfallMm: number;
  nitrogen: number;
  phosphorus: number;
  potassium: number;
};

export type FieldCard = {
  id: string;
  name: string;
  crop: string;
  variety: string | null;
  areaHectares: number;
  soilType: string;
  irrigation: string;
  status: string;
  baseYieldTonsPerHa: number;
  latest: ReadingLite | null;
  healthIndex: number;
  moistureMean: number;
  moistureSlope: number;
  ndviMean: number;
  spark: { t: string; moisture: number; ndvi: number }[];
};

export type DashboardData = {
  farm: { name: string; location: string; region: string | null } | null;
  fields: FieldCard[];
  timeseries: { day: string; moisture: number; ndvi: number; temperature: number }[];
  kpis: {
    totalFields: number;
    totalArea: number;
    avgHealth: number;
    avgMoisture: number;
    avgNdvi: number;
    openAlerts: number;
    waterSavedPct: number;
    forecastYieldTons: number;
    stressFields: number;
  };
  lastAgentRun: { id: string; at: string; summary: string; alertsCreated: number; durationMs: number } | null;
  lastIngestAt: string | null;
};

export type AlertItem = {
  id: string;
  fieldId: string | null;
  severity: string;
  type: string;
  title: string;
  message: string;
  recommendation: string | null;
  agentReasoning: string | null;
  status: string;
  source: string;
  createdAt: string;
  field?: { name: string; crop: string } | null;
};

export type AgentRunItem = {
  id: string;
  trigger: string;
  status: string;
  durationMs: number;
  fieldsScanned: number;
  alertsCreated: number;
  summary: string | null;
  steps: { tool: string; detail: string; ms: number }[];
  at: string;
};

export type ScanResult = {
  runId: string;
  durationMs: number;
  fieldsScanned: number;
  alertsCreated: number;
  summary: string;
  steps: { tool: string; detail: string; ms: number }[];
  mode: string;
};

export type DiagnosisItem = {
  id?: string;
  isCropImage: boolean;
  healthStatus: string;
  conditionName: string | null;
  confidence: number | null;
  severity: string | null;
  description: string | null;
  treatment: string[];
  prevention: string[];
  reasoning?: string | null;
  imageMeta?: string | null;
  at?: string;
};

export type ChatMsg = {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolTrace?: string[];
  at?: string;
};

export type SecurityMetrics = {
  security: {
    uptimeSec: number;
    counters: { totalRequests: number; rateLimited: number; validationFailed: number; payloadTooLarge: number; badImage: number };
    activeBuckets: number;
    headers: { name: string; value: string; purpose: string }[];
    events: { id: number; at: string; kind: string; route: string; detail: string }[];
  };
  performance: {
    cache: { entries: number; hits: number; misses: number; evictions: number; hitRate: number };
    dataVolume: { fields: number; readings: number; alerts: number; diagnoses: number; agentRuns: number };
  };
};

export const SEVERITY_STYLES: Record<string, string> = {
  CRITICAL: "bg-red-100 text-red-800 border-red-200",
  HIGH: "bg-orange-100 text-orange-800 border-orange-200",
  MEDIUM: "bg-amber-100 text-amber-800 border-amber-200",
  LOW: "bg-lime-100 text-lime-800 border-lime-200",
};

export const STATUS_STYLES: Record<string, string> = {
  HEALTHY: "bg-emerald-100 text-emerald-800 border-emerald-200",
  WATCH: "bg-amber-100 text-amber-800 border-amber-200",
  STRESS: "bg-orange-100 text-orange-800 border-orange-200",
  CRITICAL: "bg-red-100 text-red-800 border-red-200",
};
