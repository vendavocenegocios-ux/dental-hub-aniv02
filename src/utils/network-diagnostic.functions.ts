import { createServerFn } from "@tanstack/react-start";

type TestResult = {
  url: string;
  method: string;
  ok: boolean;
  status: number | null;
  durationMs: number;
  error: string | null;
  errorName: string | null;
};

async function probe(url: string, method: "GET" | "HEAD" = "HEAD", timeoutMs = 8000): Promise<TestResult> {
  const start = Date.now();
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { method, signal: controller.signal });
    const durationMs = Date.now() - start;
    console.log(`[net-diag] ${method} ${url} -> ${res.status} (${durationMs}ms)`);
    return { url, method, ok: res.ok, status: res.status, durationMs, error: null, errorName: null };
  } catch (err) {
    const durationMs = Date.now() - start;
    const e = err as Error;
    console.error(`[net-diag] ${method} ${url} FAIL (${durationMs}ms): ${e.name} ${e.message}`);
    return { url, method, ok: false, status: null, durationMs, error: e.message, errorName: e.name };
  } finally {
    clearTimeout(t);
  }
}

export const diagnoseNetwork = createServerFn({ method: "POST" }).handler(async () => {
  console.log("=== NETWORK DIAGNOSTIC START ===");
  const targets: Array<[string, "GET" | "HEAD"]> = [
    ["https://www.google.com/generate_204", "GET"],
    ["https://1.1.1.1/", "GET"],
    ["https://n8n.vendavocenegocios.com.br/", "HEAD"],
    ["https://n8n.vendavocenegocios.com.br/webhook-test/1a26f671-f9b2-4c65-b6a2-33000350a7a4", "HEAD"],
    ["https://webhook.vendavocenegocios.com.br/webhook/1a26f671-f9b2-4c65-b6a2-33000350a7a4", "HEAD"],
  ];
  const results = await Promise.all(targets.map(([u, m]) => probe(u, m)));
  console.log("=== NETWORK DIAGNOSTIC END ===", JSON.stringify(results));
  return { results, runtime: { hasProcess: typeof process !== "undefined", node: process?.version ?? null } };
});
