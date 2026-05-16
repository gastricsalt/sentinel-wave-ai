import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { askAnalyst } from "@/lib/ai-analyst.functions";
import { PageHeader, Card } from "@/components/ui-kit";
import { Send, Bot, User, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";

export const Route = createFileRoute("/_authenticated/analyst")({
  head: () => ({ meta: [{ title: "AI Analyst — SentinelWave AI" }] }),
  component: Page,
});

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "Summarize the threats detected in the last 24 hours.",
  "What is the most likely active attack and how do I stop it?",
  "Generate a remediation runbook for the top finding.",
  "Which clients should I isolate right now?",
];

function Page() {
  const ask = useServerFn(askAnalyst);
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: "Hi — I'm your SentinelWave analyst. I can triage detections, recommend remediation, and explain wireless attacks. Ask me anything about your environment." },
  ]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const mut = useMutation({
    mutationFn: (next: Msg[]) => ask({ data: { messages: next.filter((m) => m.role !== "assistant" || messages.indexOf(m) > 0) } }),
    onSuccess: (res) => setMessages((m) => [...m, { role: "assistant", content: res.content }]),
    onError: (err: Error) => setMessages((m) => [...m, { role: "assistant", content: `⚠️ ${err.message}` }]),
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || mut.isPending) return;
    const next: Msg[] = [...messages, { role: "user", content: trimmed }];
    setMessages(next);
    setInput("");
    mut.mutate(next);
  }

  return (
    <div className="p-8 max-w-5xl mx-auto h-screen flex flex-col">
      <PageHeader
        title="AI Security Analyst"
        subtitle="Conversational triage backed by your live telemetry"
        actions={<span className="flex items-center gap-1.5 text-xs text-primary"><Sparkles className="w-3.5 h-3.5" /> Gemini 2.5 Flash</span>}
      />

      <Card className="flex-1 flex flex-col min-h-0">
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-2 py-2 space-y-4">
          {messages.map((m, i) => (
            <div key={i} className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
              <div className={`w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 ${m.role === "user" ? "bg-primary/15 border border-primary/30" : "bg-surface-elevated border border-border"}`}>
                {m.role === "user" ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5 text-primary" />}
              </div>
              <div className={`max-w-[80%] rounded-lg px-4 py-2.5 text-sm ${m.role === "user" ? "bg-primary/10 border border-primary/30" : "bg-surface-elevated/60 border border-border"}`}>
                <div className="prose prose-sm prose-invert max-w-none prose-p:my-1.5 prose-ul:my-1.5 prose-ol:my-1.5 prose-li:my-0.5 prose-code:text-primary prose-code:bg-surface prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-headings:text-foreground prose-strong:text-foreground">
                  <ReactMarkdown>{m.content}</ReactMarkdown>
                </div>
              </div>
            </div>
          ))}
          {mut.isPending && (
            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-md flex items-center justify-center bg-surface-elevated border border-border">
                <Bot className="w-3.5 h-3.5 text-primary animate-pulse" />
              </div>
              <div className="rounded-lg px-4 py-3 bg-surface-elevated/60 border border-border text-xs text-muted-foreground">
                Analyzing telemetry<span className="inline-block animate-pulse">…</span>
              </div>
            </div>
          )}
        </div>

        {messages.length <= 2 && (
          <div className="px-2 pb-2 flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button key={s} onClick={() => send(s)} className="text-xs px-2.5 py-1 rounded-full border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 transition">
                {s}
              </button>
            ))}
          </div>
        )}

        <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="flex items-center gap-2 pt-3 border-t border-border">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about a threat, request a remediation plan, or pivot on a BSSID…"
            className="flex-1 bg-input border border-border rounded-md px-3 py-2.5 text-sm focus:outline-none focus:border-primary"
            disabled={mut.isPending}
          />
          <button type="submit" disabled={mut.isPending || !input.trim()}
            className="px-4 py-2.5 rounded-md text-sm font-medium text-primary-foreground transition disabled:opacity-40"
            style={{ background: "var(--gradient-primary)" }}>
            <Send className="w-4 h-4" />
          </button>
        </form>
      </Card>
    </div>
  );
}
