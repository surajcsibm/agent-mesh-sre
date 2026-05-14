"use client";

import { useState, useEffect } from "react";
import { BuilderCanvas } from "@/components/builder/BuilderCanvas";
import { BuilderInspector } from "@/components/builder/BuilderInspector";
import { BuilderPalette } from "@/components/builder/BuilderPalette";
import { BuilderTopBar } from "@/components/builder/BuilderTopBar";
import { DeployModal } from "@/components/builder/DeployModal";
import { Toaster } from "@/components/ui/Toaster";

export default function BuilderPage() {
  const [deployOpen, setDeployOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-fg-dim">Loading builder...</div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <BuilderTopBar onDeploy={() => setDeployOpen(true)} />

      <main className="flex-1 grid grid-cols-[260px_1fr_360px] min-h-0">
        <aside className="border-r border-white/10 overflow-y-auto p-3">
          <BuilderPalette />
        </aside>

        <section className="relative min-w-0">
          <BuilderCanvas />
          <CanvasHint />
        </section>

        <aside className="border-l border-white/10 min-w-0 overflow-y-auto">
          <BuilderInspector />
        </aside>
      </main>

      {deployOpen && <DeployModal onClose={() => setDeployOpen(false)} />}
      <Toaster />
    </div>
  );
}

function CanvasHint() {
  return (
    <div className="absolute top-3 left-3 glass rounded-lg px-3 py-2 max-w-[460px] pointer-events-none">
      <div className="text-[10px] uppercase tracking-wider font-mono text-fg-dim mb-1">Canvas</div>
      <div className="text-[11px] text-fg-muted leading-snug">
        Drag from the <span className="text-fg-base font-medium">palette</span> to add an agent. Drag from a node&apos;s
        right edge to another node to draw a Kafka topic. Click anything to edit.
      </div>
    </div>
  );
}
