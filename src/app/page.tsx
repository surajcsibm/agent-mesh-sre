"use client";

import { Canvas } from "@/components/canvas/Canvas";
import { MralStrip } from "@/components/canvas/MralStrip";
import { ApprovalQueue } from "@/components/panels/ApprovalQueue";
import { EventLog } from "@/components/panels/EventLog";
import { Inspector } from "@/components/panels/Inspector";
import { ScenarioPanel } from "@/components/panels/ScenarioPanel";
import { TopBar } from "@/components/panels/TopBar";
import { Toaster } from "@/components/ui/Toaster";
import { useClusterPolling } from "@/lib/cluster-status";
import { useMeshStream } from "@/lib/sse-client";

export default function Page() {
  // single source of truth for all live events from the server
  useMeshStream();
  // polls /api/cluster/{mode,connect,snapshot} so the TopBar shows real data
  useClusterPolling();

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <TopBar />

      <main className="flex-1 grid grid-cols-[300px_1fr_440px] min-h-0 gap-0">
        {/* Left rail */}
        <aside className="border-r border-white/10 overflow-y-auto p-4">
          <SectionTitle>Demo controller</SectionTitle>
          <ScenarioPanel />

          <div className="mt-6">
            <SectionTitle>Approvals</SectionTitle>
            <div className="rounded-xl border border-white/10 bg-bg-elev/40 overflow-hidden h-[440px]">
              <ApprovalQueue />
            </div>
          </div>
        </aside>

        {/* Canvas */}
        <section className="relative min-w-0">
          <Canvas />
          <CanvasLegend />
        </section>

        {/* Right inspector */}
        <aside className="border-l border-white/10 min-w-0 overflow-hidden">
          <Inspector />
        </aside>
      </main>

      <EventLog />
      <Toaster />
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] uppercase tracking-[0.18em] font-mono text-fg-dim mb-2.5 px-1">
      {children}
    </div>
  );
}

function CanvasLegend() {
  return (
    <>
      <div className="absolute top-4 left-4 glass rounded-lg px-3 py-2 max-w-[420px]">
        <div className="text-[10px] uppercase tracking-wider font-mono text-fg-dim mb-1.5">
          Mesh layout
        </div>
        <div className="text-[11.5px] text-fg-muted leading-snug">
          Each <span className="text-fg-base font-medium">node</span> is an MCP-speaking agent. Each{" "}
          <span className="text-fg-base font-medium">edge</span> is a Kafka topic governed by an{" "}
          <span className="text-fg-base font-medium">AsyncAPI 3.0</span> contract. Click any node or edge to inspect.
        </div>
      </div>
      <div className="absolute top-4 right-4">
        <MralStrip />
      </div>
    </>
  );
}
