"use client";

/**
 * Tiny toast / notification store. Used to surface scenario dispatch results
 * (especially the per-step `oc ...` shell-equivalent commands when running
 * against the real Strimzi-managed cluster).
 */
import { create } from "zustand";

export type ToastTone = "info" | "ok" | "warn" | "error";

export type ToastStep = {
  description: string;
  command?: string;
  status: "running" | "ok" | "error";
  message?: string;
  durationMs?: number;
};

export type Toast = {
  id: string;
  title: string;
  subtitle?: string;
  tone: ToastTone;
  steps?: ToastStep[];
  /** ms before auto-dismiss; 0 = sticky */
  ttlMs: number;
  createdAt: number;
};

type ToastStore = {
  toasts: Toast[];
  push: (t: Omit<Toast, "id" | "createdAt">) => string;
  update: (id: string, patch: Partial<Toast>) => void;
  dismiss: (id: string) => void;
  clear: () => void;
};

let counter = 0;

export const useToasts = create<ToastStore>((set, get) => ({
  toasts: [],
  push: (t) => {
    const id = `t${++counter}`;
    const toast: Toast = { id, createdAt: Date.now(), ...t };
    set({ toasts: [...get().toasts, toast].slice(-6) });
    if (t.ttlMs > 0) {
      setTimeout(() => get().dismiss(id), t.ttlMs);
    }
    return id;
  },
  update: (id, patch) =>
    set({
      toasts: get().toasts.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    }),
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
  clear: () => set({ toasts: [] }),
}));
