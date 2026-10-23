"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Bot, Send, Trash2, User, Wrench } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { ChatMsg } from "@/components/agrisentinel/types";
import { cn } from "@/lib/utils";

const SESSION_KEY = "agrisentinel.chat.session";
const SUGGESTIONS = [
  "Which field needs attention first and why?",
  "Summarize nitrogen status across the farm.",
  "Should I irrigate the tomato plot tonight?",
  "Any active alerts I should act on now?",
];

/** Minimal markdown-ish renderer: bold, bullets, headings, line breaks. */
function renderContent(text: string) {
  const lines = text.split("\n");
  return lines.map((line, i) => {
    const bolded = line.split(/(\*\*[^*]+\*\*)/g).map((seg, j) =>
      seg.startsWith("**") && seg.endsWith("**") ? <strong key={j}>{seg.slice(2, -2)}</strong> : <span key={j}>{seg}</span>
    );
    if (line.trimStart().startsWith("- ") || line.trimStart().startsWith("* ")) {
      return <li key={i} className="ml-4 list-disc">{bolded.map((el) => el)}</li>;
    }
    if (/^#{1,4}\s/.test(line)) {
      return <p key={i} className="font-semibold mt-1">{bolded.map((el) => el)}</p>;
    }
    if (line.trim() === "") return <div key={i} className="h-2" />;
    return <p key={i} className="leading-relaxed">{bolded.map((el) => el)}</p>;
  });
}

export function ChatView() {
  const [sessionId, setSessionId] = useState<string>("");
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let sid = localStorage.getItem(SESSION_KEY);
    if (!sid) {
      sid = `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem(SESSION_KEY, sid);
    }
    setSessionId(sid);
    fetch(`/api/chat?sessionId=${sid}`)
      .then((r) => r.json())
      .then((j) => setMessages(j.messages ?? []))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  const send = useCallback(async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || busy || !sessionId) return;
    setInput("");
    setBusy(true);
    const userMsg: ChatMsg = { id: `u-${Date.now()}`, role: "user", content };
    setMessages((m) => [...m, userMsg]);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, message: content }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "failed");
      setMessages((m) => [...m, { id: j.id, role: "assistant", content: j.content, toolTrace: j.toolTrace }]);
    } catch {
      setMessages((m) => [...m, { id: `e-${Date.now()}`, role: "assistant", content: "I could not reach the server. Please try again in a moment." }]);
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }, [input, busy, sessionId]);

  const clear = useCallback(() => {
    if (!sessionId) return;
    localStorage.removeItem(SESSION_KEY);
    const sid = `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(SESSION_KEY, sid);
    setSessionId(sid);
    setMessages([]);
  }, [sessionId]);

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
      <Card className="flex flex-col h-[calc(100vh-14rem)] min-h-96">
        <CardHeader className="pb-3 border-b border-border/60">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-primary"><Bot className="h-5 w-5" aria-hidden /></span>
              <div>
                <CardTitle className="text-base leading-tight">AgriBot — autonomous agronomist</CardTitle>
                <CardDescription className="text-xs">Grounded in live farm tools: fetches telemetry, alerts &amp; diagnoses before answering</CardDescription>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={clear} aria-label="Clear conversation" title="Clear conversation"><Trash2 className="h-4 w-4" aria-hidden /></Button>
          </div>
        </CardHeader>

        <CardContent className="flex-1 overflow-y-auto agri-scroll py-4 space-y-4" ref={scrollRef}>
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center py-8">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Bot className="h-7 w-7" aria-hidden /></span>
              <p className="mt-3 font-medium">Ask about your farm — I&apos;ll pull the live numbers first.</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">AgriBot uses a tool-calling loop: it can fetch field telemetry, active alerts and past diagnoses, then answers grounded in those results.</p>
            </div>
          )}
          {messages.map((m) => (
            <motion.div key={m.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={cn("flex gap-2.5", m.role === "user" ? "justify-end" : "justify-start")}>
              {m.role === "assistant" && (
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary mt-0.5"><Bot className="h-4 w-4" aria-hidden /></span>
              )}
              <div className={cn("max-w-[82%] rounded-2xl px-3.5 py-2.5 text-sm space-y-1.5", m.role === "user" ? "bg-primary text-primary-foreground rounded-br-md" : "bg-muted/70 rounded-bl-md")}>
                {m.toolTrace && m.toolTrace.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pb-1">
                    {m.toolTrace.map((t, i) => (
                      <span key={i} className="inline-flex items-center gap-1 rounded-full bg-primary/10 border border-primary/25 text-primary text-[10px] px-2 py-0.5 font-mono"><Wrench className="h-2.5 w-2.5" aria-hidden />{t}</span>
                    ))}
                  </div>
                )}
                <div className="space-y-1">{renderContent(m.content)}</div>
              </div>
              {m.role === "user" && (
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground mt-0.5"><User className="h-4 w-4" aria-hidden /></span>
              )}
            </motion.div>
          ))}
          {busy && (
            <div className="flex gap-2.5 items-center">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/15 text-primary"><Bot className="h-4 w-4" aria-hidden /></span>
              <div className="bg-muted/70 rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-1">
                <span className="typing-dot h-1.5 w-1.5 rounded-full bg-primary/70 inline-block" />
                <span className="typing-dot h-1.5 w-1.5 rounded-full bg-primary/70 inline-block" />
                <span className="typing-dot h-1.5 w-1.5 rounded-full bg-primary/70 inline-block" />
                <span className="ml-2 text-xs text-muted-foreground">checking farm tools…</span>
              </div>
            </div>
          )}
        </CardContent>

        <div className="border-t border-border/60 p-3">
          <div className="flex items-end gap-2">
            <Textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Ask AgriBot… (Enter to send, Shift+Enter for newline)"
              rows={1}
              maxLength={1000}
              className="min-h-11 max-h-36 resize-none"
              aria-label="Message to AgriBot"
            />
            <Button onClick={() => send()} disabled={busy || !input.trim()} size="icon" className="h-11 w-11 shrink-0 bg-primary hover:bg-primary/90" aria-label="Send message">
              <Send className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        </div>
      </Card>

      {/* Suggestions + capability card */}
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Try asking</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {SUGGESTIONS.map((s) => (
              <Button key={s} variant="outline" className="w-full h-auto py-2 text-left text-xs justify-start whitespace-normal" disabled={busy} onClick={() => send(s)}>
                {s}
              </Button>
            ))}
          </CardContent>
        </Card>
        <Card className="border-dashed">
          <CardHeader className="pb-1"><CardTitle className="text-sm">How AgriBot reasons</CardTitle></CardHeader>
          <CardContent className="text-xs text-muted-foreground leading-relaxed">
            Each question triggers an agentic loop: the model may invoke read-only tools — <code className="font-mono text-primary">get_farm_overview</code>, <code className="font-mono text-primary">get_field_detail</code>, <code className="font-mono text-primary">get_active_alerts</code>, <code className="font-mono text-primary">get_recent_diagnoses</code> — up to 3 rounds, then answers strictly from fetched data. Tool calls are rendered as chips above each reply.
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
