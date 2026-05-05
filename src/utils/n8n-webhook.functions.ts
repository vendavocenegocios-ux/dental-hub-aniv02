import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/integrations/supabase/client";

const N8N_TEST_WEBHOOK_URL =
  "https://n8n.vendavocenegocios.com.br/webhook-test/1a26f671-f9b2-4c65-b6a2-33000350a7a4";
const N8N_PROD_WEBHOOK_URL =
  "https://webhook.vendavocenegocios.com.br/webhook/1a26f671-f9b2-4c65-b6a2-33000350a7a4";

const schema = z.object({
  accessToken: z.string().min(1),
  nome: z.string().min(1).max(200),
  telefone: z.string().min(8).max(20),
  mensagem: z.string().min(1).max(4000),
  modo: z.enum(["teste", "producao"]).optional(),
});

function normalizePhone(input: string): string {
  let d = String(input ?? "").replace(/\D/g, "").replace(/^0+/, "");
  if (!d) throw new Error("Telefone vazio.");
  if (!(d.startsWith("55") && (d.length === 12 || d.length === 13))) {
    if (d.length === 10 || d.length === 11) d = "55" + d;
  }
  if ((d.length !== 12 && d.length !== 13) || !d.startsWith("55"))
    throw new Error(`Telefone inválido: ${d}`);
  return d;
}

function renderMensagem(t: string, nome: string) {
  return String(t ?? "").replace(/\{\s*nome\s*\}/gi, nome).trim();
}

function sanitizeUrl(u: string | null | undefined) {
  const v = String(u ?? "").trim();
  return /^https?:\/\//i.test(v) ? v : null;
}

export const triggerN8nTestWebhook = createServerFn({ method: "POST" })
  .inputValidator((input: z.infer<typeof schema>) => schema.parse(input))
  .handler(async ({ data }) => {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${data.accessToken}` } },
    });
    const { data: u } = await supabase.auth.getUser();
    if (!u?.user) return { success: false as const, error: "Não autenticado" };

    const { data: instance } = await supabase
      .from("whatsapp_instances")
      .select("instance_name, instance_id, imagem_url")
      .eq("user_id", u.user.id)
      .maybeSingle();
    if (!instance?.instance_name)
      return { success: false as const, error: "Instância sem instance_name" };

    let modo: "teste" | "producao" = data.modo ?? "teste";
    if (!data.modo) {
      const { data: cfg } = await supabase
        .from("config_webhook")
        .select("modo")
        .eq("user_id", u.user.id)
        .maybeSingle();
      modo = cfg?.modo === "producao" ? "producao" : "teste";
    }
    const webhookUrl = modo === "producao" ? N8N_PROD_WEBHOOK_URL : N8N_TEST_WEBHOOK_URL;

    const telefone = normalizePhone(data.telefone);
    const nome = data.nome.trim() || "paciente";
    const mensagem = renderMensagem(data.mensagem, nome);

    const payload = {
      nome,
      telefone,
      mensagem,
      nome_instancia: instance.instance_name,
      user_id: u.user.id,
      imagem_url: sanitizeUrl(instance.imagem_url) ?? "",
      instancia_id: instance.instance_id ?? "",
      api_url: process.env.EVOLUTION_API_URL ?? "",
      token: process.env.EVOLUTION_API_KEY ?? "",
    };

    console.log("[n8n-webhook] POST", {
      modo,
      webhookUrl,
      payload: { ...payload, token: "***" },
    });

    try {
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const text = await res.text();
      console.log("[n8n-webhook] response", res.status, text.slice(0, 300));
      if (!res.ok)
        return {
          success: false as const,
          error: `n8n ${res.status}: ${text.slice(0, 500)}`,
          status: res.status,
          modo,
          webhookUrl,
          response: text.slice(0, 1000),
        };
      return {
        success: true as const,
        status: res.status,
        response: text.slice(0, 1000),
        modo,
        webhookUrl,
      };
    } catch (err) {
      const m = err instanceof Error ? err.message : String(err);
      console.error("[n8n-webhook] fetch failed", m);
      return {
        success: false as const,
        error: `Falha fetch: ${m}`,
        modo,
        webhookUrl,
      };
    }
  });
