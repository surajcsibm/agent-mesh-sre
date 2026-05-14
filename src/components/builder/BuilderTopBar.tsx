"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Download, FileUp, Pause, Play, RotateCcw, Save, Sparkles, Wand2, Zap } from "lucide-react";
import { useBuilder, type BuilderDesign } from "@/lib/builder-store";
import { useBuilderRuntime } from "@/lib/builder-runtime";

export function BuilderTopBar({ onDeploy }: { onDeploy: () => void }) {
  const design = useBuilder((s) => s.design);
  const setMeta = useBuilder((s) => s.setMeta);
  const reset = useBuilder((s) => s.reset);
  const load = useBuilder((s) => s.load);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  // mounted gate: avoid hydration mismatch on the "saved Xs ago" string.
  // SSR renders with one wall-clock; client hydrates a moment later with another.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const running = useBuilderRuntime((s) => s.running);
  const startRuntime = useBuilderRuntime((s) => s.start);
  const stopRuntime = useBuilderRuntime((s) => s.stop);

  function exportFile() {
    const blob = new Blob([JSON.stringify(design, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slug(design.name)}.ams.json`;
    a.click();
    URL.revokeObjectURL(url);
    setSavedAt(new Date().toISOString());
  }

  function importFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    f.text().then((txt) => {
      try {
        const parsed = JSON.parse(txt) as BuilderDesign;
        if (parsed && Array.isArray(parsed.agents) && Array.isArray(parsed.topics)) {
          load(parsed);
          setSavedAt(new Date().toISOString());
        }
      } catch {
        /* show toast if needed */
      }
    });
    if (fileRef.current) fileRef.current.value = "";
  }

  const lastSaved = savedAt ?? design.updatedAt;
  const ago = mounted ? relativeAgo(lastSaved) : "—";

  return (
    <header className="border-b border-white/10 bg-bg-elev/60 backdrop-blur-md">
      <div className="flex items-center justify-between px-5 py-3 gap-4">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-fg-dim hover:text-fg-base text-[12px] px-2 py-1 rounded hover:bg-white/5 transition-colors"
          >
            <ArrowLeft size={13} /> Demo
          </Link>
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, rgba(167,139,250,0.25), rgba(34,211,238,0.25))", border: "1px solid rgba(167,139,250,0.4)" }}
          >
            <Wand2 size={16} className="text-violet-300" />
          </div>
          <div className="leading-tight min-w-0">
            <input
              type="text"
              value={design.name}
              onChange={(e) => setMeta({ name: e.target.value })}
              className="text-[14px] font-semibold text-fg-base bg-transparent border-0 focus:outline-none focus:bg-white/5 rounded px-1 -mx-1 max-w-[420px]"
            />
            <div className="text-[10px] uppercase tracking-wider font-mono text-fg-dim flex items-center gap-1.5">
              <Sparkles size={9} className="text-violet-400" />
              Workflow builder · saved {ago}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={importFile} />
          <button
            type="button"
            onClick={() => (running ? stopRuntime() : startRuntime(design))}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11.5px] border transition-all"
            style={
              running
                ? {
                    background: "linear-gradient(135deg, rgba(34,211,238,0.22), rgba(167,139,250,0.18))",
                    border: "1px solid rgba(34,211,238,0.45)",
                    color: "#fff",
                    boxShadow: "0 0 18px rgba(34,211,238,0.18)",
                  }
                : { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)", color: "var(--color-fg-base)" }
            }
            title={running ? "Pause flow simulation" : "Run flow simulation on canvas"}
          >
            {running ? <Pause size={12} /> : <Play size={12} />}
            {running ? "Pause" : "Run on canvas"}
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11.5px] bg-white/5 hover:bg-white/10 border border-white/10 text-fg-base transition-colors"
            title="Import design JSON"
          >
            <FileUp size={12} /> Import
          </button>
          <button
            type="button"
            onClick={exportFile}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11.5px] bg-white/5 hover:bg-white/10 border border-white/10 text-fg-base transition-colors"
            title="Export design JSON"
          >
            <Download size={12} /> Export
          </button>
          <button
            type="button"
            onClick={() => {
              if (window.confirm("Reset the canvas to the starter mesh? Your current design will be replaced.")) reset();
            }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11.5px] bg-white/5 hover:bg-white/10 border border-white/10 text-fg-base transition-colors"
            title="Reset to starter"
          >
            <RotateCcw size={12} /> Reset
          </button>
          <button
            type="button"
            onClick={() => setSavedAt(new Date().toISOString())}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11.5px] bg-white/5 hover:bg-white/10 border border-white/10 text-fg-base transition-colors"
            title="Save (autosaves on every change)"
          >
            <Save size={12} /> Saved
          </button>
          <button
            type="button"
            onClick={onDeploy}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-md text-[12.5px] font-semibold transition-all"
            style={{
              background: "linear-gradient(135deg, rgba(34,197,94,0.25), rgba(34,211,238,0.22))",
              border: "1px solid rgba(34,197,94,0.45)",
              color: "#fff",
              boxShadow: "0 0 24px rgba(34,197,94,0.18)",
            }}
          >
            <Zap size={13} /> Deploy
          </button>
        </div>
      </div>
    </header>
  );
}

function relativeAgo(iso: string): string {
  const d = Date.now() - new Date(iso).getTime();
  if (d < 5_000) return "just now";
  if (d < 60_000) return `${Math.floor(d / 1000)}s ago`;
  if (d < 3600_000) return `${Math.floor(d / 60_000)}m ago`;
  return `${Math.floor(d / 3600_000)}h ago`;
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
