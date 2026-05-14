"use client";

import { Bot, GripVertical, Sparkles } from "lucide-react";
import { PALETTE_TEMPLATES, type BuilderAccent } from "@/lib/builder-store";

const ACCENT_TO_RGB: Record<BuilderAccent, string> = {
  cyan: "34, 211, 238",
  violet: "167, 139, 250",
  emerald: "52, 211, 153",
  amber: "251, 191, 36",
  rose: "251, 113, 133",
};

const PALETTE_DRAG_TYPE = "application/x-ams-palette-template";

export function BuilderPalette() {
  function onDragStart(e: React.DragEvent<HTMLDivElement>, idx: number) {
    e.dataTransfer.setData(PALETTE_DRAG_TYPE, String(idx));
    e.dataTransfer.effectAllowed = "copy";
  }

  return (
    <div className="space-y-2">
      <div className="text-[10.5px] uppercase tracking-wider font-mono text-fg-dim mb-1 px-1 flex items-center gap-1">
        <Sparkles size={10} className="text-violet-400" />
        Drag onto canvas
      </div>
      {PALETTE_TEMPLATES.map((tpl, idx) => {
        const rgb = ACCENT_TO_RGB[tpl.accent];
        return (
          <div
            key={`${tpl.role}-${idx}`}
            draggable
            onDragStart={(e) => onDragStart(e, idx)}
            className="rounded-lg border border-white/10 bg-bg-elev p-2.5 cursor-grab hover:border-white/30 active:cursor-grabbing transition-colors group"
            style={{ background: `linear-gradient(165deg, rgba(${rgb}, 0.08), rgba(20,24,38,0.6))` }}
          >
            <div className="flex items-start gap-2">
              <GripVertical size={12} className="text-fg-dim mt-0.5 opacity-50 group-hover:opacity-100 transition-opacity flex-shrink-0" />
              <div
                className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0"
                style={{ background: `rgba(${rgb}, 0.18)`, border: `1px solid rgba(${rgb}, 0.4)` }}
              >
                <Bot size={13} style={{ color: `rgb(${rgb})` }} />
              </div>
              <div className="min-w-0">
                <div className="text-[12px] font-semibold text-fg-base">{tpl.name}</div>
                <div className="text-[10px] uppercase tracking-wider font-mono text-fg-dim">{tpl.role}</div>
                <div className="text-[10.5px] text-fg-muted mt-1 leading-snug line-clamp-2">{tpl.description}</div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export const BUILDER_PALETTE_DRAG_TYPE = PALETTE_DRAG_TYPE;
