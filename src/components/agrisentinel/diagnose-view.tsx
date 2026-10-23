"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { BrainCircuit, FileImage, Loader2, RotateCcw, ScanLine, ShieldAlert, Stethoscope, Upload } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import type { DiagnosisItem } from "@/components/agrisentinel/types";
import { cn } from "@/lib/utils";

const MAX_BYTES = 4 * 1024 * 1024;

const STATUS_TONE: Record<string, string> = {
  HEALTHY: "bg-emerald-100 text-emerald-800 border-emerald-200",
  DISEASED: "bg-red-100 text-red-800 border-red-200",
  PEST: "bg-orange-100 text-orange-800 border-orange-200",
  NUTRIENT_DEFICIENT: "bg-amber-100 text-amber-800 border-amber-200",
  UNKNOWN: "bg-muted text-muted-foreground border-border",
};

/** Downscale + re-encode to JPEG via canvas so uploads stay small and fast. */
async function compressImage(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(new Error("read failed"));
    fr.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error("decode failed"));
    im.src = dataUrl;
  });
  const maxSide = 1280;
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.width * scale));
  canvas.height = Math.max(1, Math.round(img.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.82);
}

export function DiagnoseView() {
  const { toast } = useToast();
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [cropHint, setCropHint] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<DiagnosisItem | null>(null);
  const [history, setHistory] = useState<DiagnosisItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/diagnose", { cache: "no-store" });
      if (res.ok) {
        const j = await res.json();
        setHistory(j.diagnoses);
      }
    } catch { /* non-fatal */ }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const accept = useCallback(async (file: File) => {
    if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) {
      toast({ title: "Unsupported file", description: "Upload a PNG, JPEG or WebP photo.", variant: "destructive" });
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      toast({ title: "Photo too large", description: "Max 12 MB before compression.", variant: "destructive" });
      return;
    }
    try {
      const compressed = await compressImage(file);
      setPreview(compressed);
      setFileName(file.name);
      setResult(null);
    } catch {
      toast({ title: "Could not read image", variant: "destructive" });
    }
  }, [toast]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) accept(f);
  }, [accept]);

  const analyze = useCallback(async () => {
    if (!preview) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/diagnose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: preview, cropHint, note }),
      });
      const j = await res.json();
      if (!res.ok) {
        toast({ title: "Diagnosis rejected", description: j.details?.join("; ") ?? j.error ?? "Try another photo", variant: "destructive" });
        return;
      }
      setResult(j.diagnosis);
      await loadHistory();
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }, [preview, cropHint, note, loadHistory, toast]);

  const reset = () => {
    setPreview(null);
    setFileName("");
    setResult(null);
    setNote("");
    setCropHint("");
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight flex items-center gap-2"><ScanLine className="h-5 w-5 text-primary" aria-hidden /> Vision diagnosis agent</h1>
        <p className="text-sm text-muted-foreground">Upload a leaf or plant photo. A pretrained vision-language model inspects it in-field and returns condition, confidence, severity and a treatment plan — images are validated (type, magic bytes, size) before analysis.</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Upload */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">1 · Capture</CardTitle>
            <CardDescription>JPEG / PNG / WebP, auto-compressed to ≤1280px on-device</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              role="button"
              tabIndex={0}
              aria-label="Upload crop photo"
              onClick={() => fileRef.current?.click()}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") fileRef.current?.click(); }}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={cn(
                "flex min-h-56 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition-colors",
                dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-secondary/40"
              )}
            >
              {preview ? (
                <img src={preview} alt="Uploaded crop preview" className="max-h-52 rounded-lg shadow-sm object-contain" />
              ) : (
                <>
                  <Upload className="h-9 w-9 text-muted-foreground" aria-hidden />
                  <p className="mt-2 text-sm font-medium">Drop a crop photo here</p>
                  <p className="text-xs text-muted-foreground mt-0.5">or click to browse — leaf spots, wilting, pests, nutrient symptoms</p>
                </>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) accept(f); }} />

            <div className="grid gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="d-crop">Crop (optional hint)</Label>
                <Input id="d-crop" value={cropHint} onChange={(e) => setCropHint(e.target.value)} placeholder="e.g. Tomato" maxLength={40} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="d-note">Note (optional)</Label>
                <Input id="d-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. spots appeared after rain" maxLength={300} />
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={analyze} disabled={!preview || busy} className="flex-1 bg-primary hover:bg-primary/90">
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : <Stethoscope className="mr-2 h-4 w-4" aria-hidden />}
                {busy ? "Agent analyzing…" : "Analyze photo"}
              </Button>
              {preview && <Button variant="outline" onClick={reset} aria-label="Reset"><RotateCcw className="h-4 w-4" aria-hidden /></Button>}
            </div>
            {fileName && <p className="text-[11px] text-muted-foreground flex items-center gap-1"><FileImage className="h-3 w-3" aria-hidden /> {fileName}</p>}
          </CardContent>
        </Card>

        {/* Result */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">2 · Verdict &amp; action plan</CardTitle>
            <CardDescription>Structured output: condition · confidence · severity · treatment</CardDescription>
          </CardHeader>
          <CardContent>
            {busy && (
              <div className="py-10 text-center space-y-3">
                <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" aria-hidden />
                <p className="text-sm text-muted-foreground">Vision agent inspecting pixels…</p>
              </div>
            )}
            {!busy && !result && (
              <div className="py-10 text-center text-sm text-muted-foreground">
                <Stethoscope className="mx-auto h-8 w-8 text-muted-foreground/50" aria-hidden />
                <p className="mt-2">The verdict will appear here after analysis.</p>
              </div>
            )}
            {!busy && result && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3.5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={cn("text-xs", STATUS_TONE[result.healthStatus] ?? "")}>{result.healthStatus.replace(/_/g, " ")}</Badge>
                  {result.severity && result.severity !== "UNKNOWN" && <Badge variant="secondary" className="text-xs">Severity: {result.severity}</Badge>}
                  {typeof result.confidence === "number" && <Badge variant="outline" className="text-xs border-primary/40 text-primary">{Math.round(result.confidence)}% confidence</Badge>}
                </div>
                <div>
                  <p className="text-lg font-bold">{result.conditionName ?? "Unknown"}</p>
                  <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{result.description}</p>
                </div>
                {result.treatment?.length > 0 && (
                  <div className="rounded-lg border border-primary/25 bg-secondary/50 p-3">
                    <p className="text-xs font-semibold text-primary mb-1.5 flex items-center gap-1.5"><Stethoscope className="h-3.5 w-3.5" aria-hidden /> Treatment plan</p>
                    <ol className="list-decimal ml-5 space-y-1 text-sm">
                      {result.treatment.map((t, i) => <li key={i} className="leading-relaxed">{t}</li>)}
                    </ol>
                  </div>
                )}
                {result.prevention?.length > 0 && (
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-xs font-semibold mb-1.5 flex items-center gap-1.5"><ShieldAlert className="h-3.5 w-3.5 text-amber-600" aria-hidden /> Prevention</p>
                    <ul className="list-disc ml-5 space-y-1 text-sm">
                      {result.prevention.map((t, i) => <li key={i} className="leading-relaxed">{t}</li>)}
                    </ul>
                  </div>
                )}
                {result.reasoning && (
                  <p className="text-xs text-muted-foreground flex items-start gap-1.5"><BrainCircuit className="h-3.5 w-3.5 shrink-0 mt-0.5" aria-hidden /><span>{result.reasoning}</span></p>
                )}
              </motion.div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* History */}
      <section>
        <h2 className="text-sm font-semibold mb-2.5 text-muted-foreground uppercase tracking-wide">Recent diagnoses</h2>
        {history.length === 0 ? (
          <Card><CardContent className="py-6 text-center text-sm text-muted-foreground">No diagnoses yet — analyze your first crop photo above.</CardContent></Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {history.map((d, i) => (
              <Card key={d.id ?? i} className="py-3">
                <CardContent className="px-4 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold truncate">{d.conditionName ?? "—"}</p>
                    <Badge variant="outline" className={cn("text-[10px] shrink-0", STATUS_TONE[d.healthStatus] ?? "")}>{d.healthStatus.replace(/_/g, " ")}</Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground">{d.crop ? `${d.crop} · ` : ""}{typeof d.confidence === "number" ? `${Math.round(d.confidence)}% · ` : ""}{d.at ? new Date(d.at).toLocaleString() : ""}</p>
                  {d.description && <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{d.description}</p>}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
