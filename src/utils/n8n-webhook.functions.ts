import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/integrations/supabase/client";

const N8N_TEST_WEBHOOK_URL =
  "https://n8n.vendavocenegocios.com.br/webhook-test/1a26f671-f9b2-4c65-b6a2-33000350a7a4";
const N8N_PROD_WEBHOOK_URL =
  "https://webhook.vendavocenegocios.com.br/webhook/1a26f671-f9b2-4c65-b6a2-33000350a7a4";

function resolveWebhookUrl(modo: string | null | undefined): {
  url: string;
  modo: "teste" | "producao";
} {
  const normalized = modo === "producao" ? "producao" : "teste";
  return {
    url: normalized === "producao" ? N8N_PROD_WEBHOOK_URL : N8N_TEST_WEBHOOK_URL,
    modo: normalized,
  };
}

const triggerSchema = z.object({
  accessToken: z.string().min(1),
  modo: z.enum(["teste", "producao"]).optional(),
  // Campos de override opcionais (vindos da UI). Se não vierem, o servidor
  // resolve TUDO a partir do Supabase — fonte da verdade.
  nome: z.string().min(1).max(200).optional(),
  telefone: z.string().min(8).max(20).optional(),
  // Mantemos compatibilidade com chamadas antigas que ainda passam estes campos:
  nomeInstancia: z.string().min(1).max(200).optional(),
  mensagem: z.string().min(1).max(4000).optional(),
  imagemUrl: z.string().max(2000).nullish(),
});

const DEFAULT_MENSAGEM = "🎂 Feliz aniversário, {nome}! 🎉";

async function getAuthenticatedSupabase(accessToken: string) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });

  const { data: userData, error } = await supabase.auth.getUser();
  if (error || !userData?.user) {
    throw new Error("Usuário não autenticado");
  }
  return { supabase, user: userData.user };
}

function normalizePhoneServer(input: string): string {
  let digits = String(input ?? "").replace(/\D/g, "").replace(/^0+/, "");
  if (!digits) throw new Error("Telefone vazio.");
  if (!(digits.startsWith("55") && (digits.length === 12 || digits.length === 13))) {
    if (digits.length === 10 || digits.length === 11) {
      digits = "55" + digits;
    }
  }
  if (digits.length !== 12 && digits.length !== 13 || !digits.startsWith("55")) {
    throw new Error(
      `Telefone inválido após normalização: ${digits}. Use formato 55DDXXXXXXXXX.`,
    );
  }
  return digits;
}

function renderMensagem(template: string, nome: string): string {
  return String(template ?? "")
    .replace(/\{\s*nome\s*\}/gi, nome)
    .trim();
}

function sanitizeImagemUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = String(url).trim();
  if (!trimmed) return null;
  if (!/^https?:\/\//i.test(trimmed)) return null;
  return trimmed;
}

/**
 * Aciona o webhook do n8n responsável pelo envio de teste.
 *
 * O servidor é a FONTE DA VERDADE: busca instância, mensagem e imagem
 * direto do Supabase no momento do disparo, garantindo que a UI nunca
 * envie dados defasados/cacheados ao n8n.
 *
 * Payload final enviado ao n8n:
 *   { telefone, nome, nome_instancia, mensagem, imagem_url }
 */
export const triggerN8nTestWebhook = createServerFn({ method: "POST" })
  .inputValidator((input: z.infer<typeof triggerSchema>) =>
    triggerSchema.parse(input),
  )
  .handler(async ({ data }) => {
    const { supabase, user } = await getAuthenticatedSupabase(data.accessToken);

    // 1) Instância (nome + imagem espelhada).
    const { data: instance, error: instanceError } = await supabase
      .from("whatsapp_instances")
      .select("id, instance_name, imagem_url")
      .eq("user_id", user.id)
      .maybeSingle();

    if (instanceError) {
      return {
        success: false as const,
        error: `Erro ao buscar instância: ${instanceError.message}`,
      };
    }
    if (!instance) {
      return {
        success: false as const,
        error: "Nenhuma instância WhatsApp encontrada para este usuário.",
      };
    }

    const nomeInstancia =
      data.nomeInstancia?.trim() || instance.instance_name?.trim() || "";
    if (!nomeInstancia) {
      return {
        success: false as const,
        error: "Instância sem nome (instance_name) — reconecte o WhatsApp.",
      };
    }

    // 2) Config da mensagem (mensagem + imagem da mensagem).
    const { data: configMensagem, error: configError } = await supabase
      .from("config_mensagem")
      .select("mensagem, imagem_url")
      .eq("user_id", user.id)
      .maybeSingle();

    if (configError) {
      return {
        success: false as const,
        error: `Erro ao buscar config_mensagem: ${configError.message}`,
      };
    }

    // 3) Modo do webhook — prioridade: payload da UI > config_webhook > teste.
    let modoSalvo: string | null | undefined = data.modo;
    if (!modoSalvo) {
      const { data: webhookConfig } = await supabase
        .from("config_webhook")
        .select("modo")
        .eq("user_id", user.id)
        .maybeSingle();
      modoSalvo = webhookConfig?.modo;
    }
    const { url: webhookUrl, modo: webhookModo } = resolveWebhookUrl(modoSalvo);

    // 4) Telefone e nome — aceita override da UI.
    if (!data.telefone) {
      return {
        success: false as const,
        error: "Telefone obrigatório.",
      };
    }
    let telefone: string;
    try {
      telefone = normalizePhoneServer(data.telefone);
    } catch (err) {
      return {
        success: false as const,
        error: err instanceof Error ? err.message : "Telefone inválido.",
      };
    }
    const nome = (data.nome?.trim() || "paciente").slice(0, 200);

    // 5) Mensagem — UI > config_mensagem > default.
    const mensagemTemplate =
      data.mensagem?.trim() ||
      configMensagem?.mensagem?.trim() ||
      DEFAULT_MENSAGEM;
    const mensagem = renderMensagem(mensagemTemplate, nome);
    if (!mensagem) {
      return {
        success: false as const,
        error: "Mensagem vazia após renderização.",
      };
    }

    // 6) Imagem — prioridade: UI > config_mensagem > whatsapp_instances.
    const imagemUiOverride =
      data.imagemUrl !== undefined ? sanitizeImagemUrl(data.imagemUrl) : null;
    const imagemConfig = sanitizeImagemUrl(configMensagem?.imagem_url);
    const imagemInstance = sanitizeImagemUrl(instance.imagem_url);

    let imagemUrl: string | null = null;
    let imagemFonte: "ui" | "config_mensagem" | "whatsapp_instances" | "none" =
      "none";
    if (imagemUiOverride) {
      imagemUrl = imagemUiOverride;
      imagemFonte = "ui";
    } else if (imagemConfig) {
      imagemUrl = imagemConfig;
      imagemFonte = "config_mensagem";
    } else if (imagemInstance) {
      imagemUrl = imagemInstance;
      imagemFonte = "whatsapp_instances";
    }

    // 7) Payload exatamente como o n8n espera.
    const payload = {
      telefone,
      nome,
      nome_instancia: nomeInstancia,
      mensagem,
      imagem_url: imagemUrl ?? "",
    };

    // Versão sanitizada para retorno ao frontend (debug).
    const debugPayload = {
      telefone: telefone.slice(0, 4) + "***" + telefone.slice(-2),
      nome,
      nome_instancia: nomeInstancia,
      mensagem_preview: mensagem.slice(0, 80),
      mensagem_len: mensagem.length,
      imagem_url: imagemUrl ?? "",
      imagem_fonte: imagemFonte,
    };

    console.info("[n8n-webhook] disparando", {
      modo: webhookModo,
      webhookUrl,
      nomeInstancia,
      hasImagem: Boolean(imagemUrl),
      imagemFonte,
    });

    try {
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const text = await res.text();

      console.info("[n8n-webhook] resposta", {
        modo: webhookModo,
        status: res.status,
        ok: res.ok,
        bodySnippet: text.slice(0, 200),
      });

      if (!res.ok) {
        return {
          success: false as const,
          error: `Webhook n8n (${webhookModo}) respondeu ${res.status}: ${text.slice(0, 500)}`,
          status: res.status,
          modo: webhookModo,
          webhookUrl,
          debugPayload,
        };
      }

      return {
        success: true as const,
        status: res.status,
        response: text.slice(0, 1000),
        modo: webhookModo,
        webhookUrl,
        debugPayload,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[n8n-webhook] falha de rede", { modo: webhookModo, message });
      return {
        success: false as const,
        error: `Falha ao chamar webhook n8n (${webhookModo}): ${message}`,
        modo: webhookModo,
        webhookUrl,
        debugPayload,
      };
    }
  });
