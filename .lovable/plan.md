
## 1. Mobile-first nas telas (cliente e admin)

**MensagemTab (`src/components/aniversarios/MensagemTab.tsx`)**
- Trocar grid `md:grid-cols-2` por layout em coluna no mobile com cards full-width
- Adicionar `min-w-0`, `max-w-full`, `break-words` no Card pai e wrappers internos para evitar vazamento horizontal
- Textarea: `w-full resize-none` e container com `overflow-hidden`
- Preview: `max-w-full` com `overflow-hidden` no balão e imagem com `max-w-full h-auto`

**ModelosGaleria (`src/components/aniversarios/ModelosGaleria.tsx`)**
- Substituir scroll horizontal por **grid 3 col mobile / 4 col desktop** mostrando 6 imagens (2 linhas × 3) por padrão
- Botão "Ver mais opções (+N)" abaixo do grid quando houver mais que 6, abre Dialog com grid completo de todos os modelos
- Item da galeria: reduzir de `w-24` fixo para `w-full aspect-square`

**Admin (logs e demais)**
- `src/routes/_authenticated.admin.tsx` (layout) e cards do `_authenticated.admin.logs.tsx`: adicionar `overflow-x-hidden` no main, padding `p-3 sm:p-6`
- Filtros do admin/logs: empilhar verticalmente no mobile (`flex-col sm:flex-row`), Select com `w-full sm:w-auto`
- Tabela de logs: já tem `overflow-x-auto` ✓; reduzir colunas via `hidden sm:table-cell` para "Total" no mobile
- Verificar `_authenticated.admin.usuarios.tsx`, `_authenticated.admin.financeiro.tsx`, `_authenticated.admin.modelos.tsx` e aplicar mesmo padrão (cards `min-w-0`, padding mobile, tabelas em `overflow-x-auto`)
- Sidebar admin: garantir que vira drawer no mobile (já existe `Sheet` no `ui/sidebar.tsx`)

## 2. Filtro de período no histórico do cliente

**EnvioTab (`src/components/aniversarios/EnvioTab.tsx`)**
- Adicionar barra de filtro acima da tabela de envios com 3 botões: **Últimos 7 dias** (default), **Últimos 30 dias**, **Personalizado** (Popover + Calendar range)
- Atualizar `enviosQuery` para receber `from`/`to` como queryKey e filtrar `created_at` via `.gte()/.lte()`; remover `.limit(50)` quando filtro custom; manter limit alto (500)
- Mostrar contador "X envios no período"

**Admin Logs (`_authenticated.admin.logs.tsx`)**
- Substituir filtro atual (Mês/Ano/Personalizado) por: **Últimos 7 dias** (default), **Últimos 30 dias**, **Personalizado** (range calendar) — alinha com o cliente
- Manter "Mostrar 10/50/100"

## 3. Push notifications para o admin (VAPID / Web Push)

**Eventos que disparam push para o admin:**
- Instância WhatsApp desconecta (estado muda de `connected` → outro)
- Nova assinatura criada (webhook Asaas → status `confirmed/received`)

**Arquitetura:**

```text
[Cliente Browser] --subscribe--> [serverFn registerPushSubscription]
                                        |
                                        v
                                 push_subscriptions table
                                 (admin users only)

[Evento sistema] --> [serverFn notifyAdmins]
   - WhatsApp disconnect (em evolution.functions.ts)
   - Asaas webhook (em routes/api.public.asaas-webhook.ts)
                                        |
                                        v
                            web-push lib --> browsers admin
                            + insert em notificacoes (sino in-app)
```

**Mudanças:**

1. **Migration `supabase-migration-push-subscriptions.sql`**
   - Tabela `push_subscriptions(id, user_id, endpoint unique, p256dh, auth, user_agent, created_at)`
   - RLS: usuário gerencia suas próprias

2. **Server functions `src/utils/push.functions.ts`**
   - `getVapidPublicKey()` — devolve `process.env.VAPID_PUBLIC_KEY` p/ frontend
   - `registerPushSubscription({accessToken, subscription})` — upsert por endpoint
   - `unregisterPushSubscription({accessToken, endpoint})`
   - `sendPushToAdmins({title, body, url, tipo})` (interno) — busca admins via `profiles.role='admin'`, lê subscriptions, dispara `web-push` em paralelo com cleanup de 410/404, e cria registro em `notificacoes` (audiência admin)

3. **`bun add web-push @types/web-push`**

4. **Componente `src/components/PushSubscribeButton.tsx`** + integração na sidebar admin
   - Pede permissão, registra service worker (`/sw.js` em `public/`), faz `pushManager.subscribe` com VAPID public key
   - Mostra estado: ativado / desativado / não suportado
   - Aparece somente para usuários admin

5. **Service worker `public/sw.js`** — handler de `push` exibe `showNotification(title, {body, data:{url}, icon, badge})` e `notificationclick` abre `event.notification.data.url`

6. **Trigger nos eventos:**
   - **WhatsApp disconnect**: em `src/utils/evolution.functions.ts`, no fluxo que atualiza `whatsapp_instances.status`, comparar status anterior; se mudou para `disconnected/closed`, chamar `sendPushToAdmins({title:"Instância desconectada", body:"<email do user> · <instance_name>", url:"/admin/usuarios"})`
   - **Nova assinatura**: em `src/routes/api.public.asaas-webhook.ts`, ao receber `PAYMENT_RECEIVED/CONFIRMED` para assinatura nova, chamar `sendPushToAdmins({title:"Nova assinatura", body:"<email> · R$ <valor>", url:"/admin/financeiro"})`

7. **Tela admin `/admin` (index)** — adicionar card "Notificações Push" com botão de ativar/desativar e lista das mensagens disparadas (lê de `notificacoes` audiência=admin via server function existente)

## Dados que preciso de você

Para implementar push, preciso destas chaves VAPID (geradas com `npx web-push generate-vapid-keys`):

- `VAPID_PUBLIC_KEY` (chave pública — vai pro browser)
- `VAPID_PRIVATE_KEY` (privada — fica no server)
- `VAPID_SUBJECT` (mailto:seu@email ou URL)

Após você aprovar o plano, vou pedir essas 3 variáveis para configurar como secrets do projeto.

## Ordem de execução

1. Mobile-first MensagemTab + ModelosGaleria + AdminLogs
2. Filtros 7/30/personalizado em EnvioTab e AdminLogs
3. Push: migration → web-push install → server functions → SW → componente → triggers nos eventos → card no /admin
