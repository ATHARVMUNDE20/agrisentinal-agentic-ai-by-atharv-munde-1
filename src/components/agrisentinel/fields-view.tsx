"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, MapPin, Plus, Sprout } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Sparkline } from "@/components/agrisentinel/charts";
import { STATUS_STYLES, type FieldCard } from "@/components/agrisentinel/types";
import { cn } from "@/lib/utils";

const CROPS = ["Wheat", "Rice", "Tomato", "Maize", "Cotton", "Soybean", "Sugarcane", "Onion", "Chickpea", "Groundnut"];
const IRRIGATION = ["drip", "sprinkler", "canal", "flood", "rainfed"];
const SOILS = ["loam", "clay", "sandy loam", "silt loam", "black cotton", "alluvial"];

export function FieldsView({ onChanged }: { onChanged: () => Promise<void> }) {
  const { toast } = useToast();
  const [fields, setFields] = useState<FieldCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", crop: "Wheat", variety: "", areaHectares: "2.5", soilType: "loam", irrigation: "drip", baseYieldTonsPerHa: "4.5" });

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/fields", { cache: "no-store" });
      if (res.ok) {
        const j = await res.json();
        setFields(j.fields);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const createField = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/fields", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          crop: form.crop,
          variety: form.variety.trim() || undefined,
          areaHectares: Number(form.areaHectares),
          soilType: form.soilType,
          irrigation: form.irrigation,
          baseYieldTonsPerHa: Number(form.baseYieldTonsPerHa),
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        toast({ title: "Could not create field", description: j.details?.join("; ") ?? j.error ?? "Validation failed", variant: "destructive" });
        return;
      }
      toast({ title: "Field registered", description: `${j.field.name} is now under Sentinel watch.` });
      setOpen(false);
      setForm({ name: "", crop: "Wheat", variety: "", areaHectares: "2.5", soilType: "loam", irrigation: "drip", baseYieldTonsPerHa: "4.5" });
      await load();
      await onChanged();
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }, [form, load, onChanged, toast]);

  if (loading) return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-64 rounded-xl bg-card border border-border animate-pulse" />)}</div>;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Field registry</h1>
          <p className="text-sm text-muted-foreground">{fields.length} plots enrolled — every field streams soil, canopy and nutrient telemetry into the Sentinel agent.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90"><Plus className="mr-2 h-4 w-4" aria-hidden /> Enroll field</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Enroll a new field</DialogTitle>
              <DialogDescription>Validated server-side with Zod. The agent starts scanning it on the next run.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 py-1">
              <div className="grid gap-1.5">
                <Label htmlFor="f-name">Field name</Label>
                <Input id="f-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Chilli Block 4" maxLength={80} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label>Crop</Label>
                  <Select value={form.crop} onValueChange={(v) => setForm({ ...form, crop: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{CROPS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="f-area">Area (ha)</Label>
                  <Input id="f-area" type="number" min="0.1" step="0.1" value={form.areaHectares} onChange={(e) => setForm({ ...form, areaHectares: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label>Soil type</Label>
                  <Select value={form.soilType} onValueChange={(v) => setForm({ ...form, soilType: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{SOILS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label>Irrigation</Label>
                  <Select value={form.irrigation} onValueChange={(v) => setForm({ ...form, irrigation: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{IRRIGATION.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="f-variety">Variety (optional)</Label>
                  <Input id="f-variety" value={form.variety} onChange={(e) => setForm({ ...form, variety: e.target.value })} maxLength={60} placeholder="e.g. HD-3086" />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="f-yield">Base yield (t/ha)</Label>
                  <Input id="f-yield" type="number" min="0.1" step="0.1" value={form.baseYieldTonsPerHa} onChange={(e) => setForm({ ...form, baseYieldTonsPerHa: e.target.value })} />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={createField} disabled={saving || form.name.trim().length < 2}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}{saving ? "Registering…" : "Enroll field"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {fields.map((f, i) => (
          <motion.div key={f.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
            <Card className="h-full flex flex-col hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-sm font-semibold leading-tight flex items-center gap-1.5"><Sprout className="h-3.5 w-3.5 text-primary" aria-hidden />{f.name}</CardTitle>
                    <CardDescription className="text-xs flex items-center gap-1 mt-0.5"><MapPin className="h-3 w-3" aria-hidden />{f.crop}{f.variety ? ` · ${f.variety}` : ""} · {f.soilType} · {f.irrigation}</CardDescription>
                  </div>
                  <Badge variant="outline" className={cn("text-[10px] shrink-0", STATUS_STYLES[f.status] ?? "")}>{f.status}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 flex-1">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Health index</span><span className="font-semibold text-foreground">{f.healthIndex}/100</span>
                </div>
                <Progress value={f.healthIndex} className="h-2" />
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-center">
                  {[
                    { l: "Area", v: `${f.areaHectares} ha` },
                    { l: "Moisture", v: f.latest ? `${f.latest.soilMoisture}%` : "—" },
                    { l: "Temp", v: f.latest ? `${f.latest.temperature}°C` : "—" },
                    { l: "pH", v: f.latest ? `${f.latest.soilPh}` : "—" },
                  ].map((s) => (
                    <div key={s.l} className="rounded-md bg-secondary/60 py-1.5">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{s.l}</p>
                      <p className="text-xs font-semibold">{s.v}</p>
                    </div>
                  ))}
                </div>
                <div className="pt-1 mt-auto">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Moisture — last 24 ticks</p>
                  <Sparkline data={f.spark} />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
