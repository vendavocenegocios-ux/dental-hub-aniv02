## Objetivo

Confirmar se o ambiente onde a server function roda (Cloudflare Worker SSR via TanStack Start, deployado em Vercel/Lovable) consegue de fato fazer requisições HTTPS externas — em especial para `n8n.vendavocenegocios.com.br`. O sintoma atual é: `ANTES DO FETCH` aparece, mas `DEPOIS DO FETCH` nunca, e o cliente recebe 504.

## Plano

### 1. Criar server function de diagnóstico de rede
Arquivo novo: `src/utils/network-diagnostic.functions.ts`

Server function `diagnoseNetwork` que executa, em paralelo e cada um com timeout próprio de 8s via `AbortController`, os seguintes testes:

- `GET https://www.google.com/generate_204` (sanity check de egress geral)
- `GET https://1.1.1.1` (egress por IP — descarta DNS)
- `HEAD https://n8n.vendavocenegocios.com.br` (DNS + TLS + alcance ao host n8n)
- `HEAD https://n8n.vendavocenegocios.com.br/webhook-test/1a26f671-f9b2-4c65-b6a2-33000350a7a4` (rota exata do webhook de teste)
- `HEAD https://webhook.vendavocenegocios.com.br/webhook/1a26f671-f9b2-4c65-b6a2-33000350a7a4` (rota exata do webhook de produção)

Para cada teste registra: `url`, `ok`, `status`, `durationMs`, `error` (mensagem + nome — `AbortError`, `TypeError`, etc.). Tudo em `console.log` no servidor e devolvido no retorno para a UI.

### 2. Botão temporário “Diagnosticar rede” na aba Envio
Em `src/components/aniversarios/EnvioTab.tsx`, adicionar um botão discreto ao lado de “Enviar Teste” que chama `diagnoseNetwork` e mostra o resultado num toast + `console.table`. Sem alterar o fluxo existente do envio.

### 3. Executar e coletar evidências
Após o deploy:
- Clicar no botão e capturar o resultado.
- Rodar `stack_modern--server-function-logs` filtrando por `network-diagnostic` para ver os logs do servidor.
- Também invocar a server function direto via `stack_modern--invoke-server-function` para confirmar fora da UI.

### 4. Interpretação dos resultados (já com remediação pronta)

- **Todos os testes falham (incluindo Google/1.1.1.1):** egress totalmente bloqueado no runtime. Remediação: mover o disparo do webhook para fora do Worker — usar uma fila no Supabase (`webhook_queue`) consumida por um worker externo (pg_cron + endpoint `/api/public/process-webhook-queue`, ou n8n fazendo polling). Padrão recomendado pelo Stack Overflow knowledge.
- **Google OK, n8n falha por timeout/`fetch failed`:** problema específico de rota/egress para esse host (provavelmente IP do VPS bloqueando o range do Worker, ou Cloudflare em modo de ataque). Remediação: liberar User-Agent/IP do Worker no firewall do VPS, ou expor o n8n via Cloudflare Tunnel.
- **Google OK, n8n falha por DNS (`ENOTFOUND`/`getaddrinfo`):** DNS não resolve no runtime. Remediação: usar IP direto + header `Host`, ou apontar webhook para um domínio Cloudflare.
- **n8n responde mas com 401/403/404:** não é rede — é configuração do workflow no n8n (não está “Listen for test event” / não está ativo).
- **Tudo OK:** o problema é específico do POST com body grande ou do fluxo n8n travando antes de responder. Remediação: enviar o disparo de forma fire-and-forget (responder ao cliente antes do n8n terminar) ou aumentar o timeout/dividir o trabalho.

### 5. Limpeza
Quando o problema estiver identificado e corrigido, remover o botão de diagnóstico (ou deixá-lo apenas no painel admin).

## Arquivos afetados
- `src/utils/network-diagnostic.functions.ts` (novo)
- `src/components/aniversarios/EnvioTab.tsx` (botão de diagnóstico)

## Resultado esperado
Em até 1 ciclo de teste, teremos a causa-raiz com evidência concreta (status/erro por host) e a próxima ação correta — em vez de continuar trocando logs no fetch do webhook.