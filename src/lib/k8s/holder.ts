/**
 * Lazy singleton K8sClient. Safe to call from any API route.
 * Re-detects whenever a connection failure is reported.
 */
import "server-only";
import { K8sClient } from "./client";

const g = globalThis as unknown as { __ams_k8s?: { client?: K8sClient; error?: string } };

export async function getK8s(): Promise<K8sClient> {
  if (!g.__ams_k8s) g.__ams_k8s = {};
  if (g.__ams_k8s.client) return g.__ams_k8s.client;
  try {
    const c = await K8sClient.detect();
    g.__ams_k8s.client = c;
    g.__ams_k8s.error = undefined;
    return c;
  } catch (e) {
    g.__ams_k8s.error = e instanceof Error ? e.message : String(e);
    throw e;
  }
}

export function resetK8s(): void {
  g.__ams_k8s = {};
}

export function lastK8sError(): string | undefined {
  return g.__ams_k8s?.error;
}
