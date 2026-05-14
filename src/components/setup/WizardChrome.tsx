"use client";

import Link from "next/link";
import { ArrowLeft, Network } from "lucide-react";

export function WizardChrome({
  step,
  total,
  title,
  subtitle,
  children,
}: {
  step: number;
  total: number;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  const pct = Math.round((step / total) * 100);
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-white/10 bg-bg-elev/60 backdrop-blur-md">
        <div className="px-5 py-3 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2 text-fg-muted hover:text-fg-base transition-colors">
            <ArrowLeft size={14} />
            <span className="text-[12px]">Back to canvas</span>
          </Link>
          <div className="flex items-center gap-2 min-w-0">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{
                background: "linear-gradient(135deg, rgba(34, 211, 238, 0.25), rgba(167, 139, 250, 0.25))",
                border: "1px solid rgba(167, 139, 250, 0.3)",
              }}
            >
              <Network size={15} className="text-fg-base" />
            </div>
            <div className="leading-tight text-right">
              <div className="text-[12.5px] font-semibold text-fg-base">Cluster Setup Wizard</div>
              <div className="text-[10px] uppercase tracking-wider font-mono text-fg-dim">
                Step {step} of {total}
              </div>
            </div>
          </div>
        </div>
        <div className="h-1 bg-white/5 relative overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 transition-all duration-700"
            style={{
              width: `${pct}%`,
              background: "linear-gradient(90deg, #22d3ee, #a78bfa, #34d399)",
              boxShadow: "0 0 16px rgba(167, 139, 250, 0.6)",
            }}
          />
        </div>
      </header>

      <main className="flex-1 px-6 py-10 overflow-y-auto">
        <div className="max-w-3xl mx-auto">
          <div className="mb-8">
            <h1 className="text-[28px] font-semibold tracking-tight text-fg-base mb-1.5 leading-tight">
              {title}
            </h1>
            <p className="text-[14px] text-fg-muted leading-relaxed max-w-2xl">{subtitle}</p>
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
