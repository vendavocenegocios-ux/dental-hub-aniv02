Pelo que consegui confirmar em modo somente leitura, há um problema claro na implementação atual: o botão chama uma Server Function que apenas confia nos dados passados pelo frontend. Isso deixa o envio dependente do cache/estado da aba e não confirma no servidor se a mensagem e a imagem realmente foram salvas no Supabase antes de disparar para o n8n.

Também comparei com o projeto anterior “Dental Hub Dashboard”. Lá, a função do webhook buscava a instância e a `imagem_url` diretamente no Supabase no momento do disparo. Na versão atual, isso foi alterado para enviar `nomeInstancia` e `imagemUrl` vindos da tela. Essa mudança explica a recorrência: se a UI estiver com cache antigo, se a aba Envio não refetchou, ou se a imagem foi salva mas ainda não chegou no estado local, o webhook pode ir sem a URL correta — ou nem chegar ao n8n se a validação/estado do botão falhar antes.

Plano de correção:

1. Tornar o disparo server-side como era no projeto funcional
   - Ajustar `src/utils/n8n-webhook.functions.ts` para, após autenticar o usuário, buscar no Supabase em tempo real:
     - `whatsapp_instances.instance_name`
     - `whatsapp_instances.instance_id`
     - `whatsapp_instances.imagem_url`
     - `config_mensagem.mensagem`
     - `config_mensagem.imagem_url`
     - `config_webhook.modo`
   - O servidor escolherá a imagem com prioridade:
     1. `config_mensagem.imagem_url`
     2. `whatsapp_instances.imagem_url`
     3. string vazia
   - Assim o webhook não dependerá mais do cache da aba.

2. Enviar exatamente o payload que você pediu ao n8n
   - Manter o payload final com estes campos:
     ```json
     {
       "telefone": "string",
       "nome": "string",
       "nome_instancia": "string",
       "mensagem": "string",
       "imagem_url": "string"
     }
     ```
   - A mensagem será renderizada no servidor substituindo `{nome}`.
   - O telefone continuará normalizado para o padrão `55DDXXXXXXXXX`.

3. Corrigir a seleção de modo teste/produção
   - A função server-side usará o `modo` enviado pela tela quando existir, mas também consultará `config_webhook` como fallback.
   - Isso evita divergência entre “modo selecionado na UI” e “modo salvo no banco”.

4. Adicionar logs úteis e seguros para diagnóstico
   - Antes de chamar o n8n, registrar no servidor:
     - modo usado
     - URL do webhook usada
     - nome da instância
     - se havia imagem (`hasImagem`)
     - origem da imagem (`config_mensagem`, `whatsapp_instances` ou `none`)
   - Não logar telefone completo nem conteúdo integral da mensagem.
   - Depois do fetch, registrar status HTTP retornado pelo n8n.

5. Melhorar a resposta visual do botão
   - Após o clique, se a função não chegar ao n8n, o toast mostrará o motivo real retornado pelo servidor.
   - Se chegar ao n8n mas o n8n responder erro, mostrar o HTTP status e um trecho da resposta.
   - Se sucesso, mostrar qual modo foi usado e se a imagem foi enviada.

6. Criar uma função temporária/diagnóstico ou retorno enriquecido para confirmar o payload
   - Fazer a própria função retornar ao frontend um `debugPayload` sanitizado contendo exatamente o que foi enviado ao n8n.
   - Isso permitirá eu simular o clique depois e te mostrar aqui o payload real, incluindo a `imagem_url`.

7. Verificar o armazenamento da imagem
   - Conferir se `MensagemTab` está persistindo a URL em `config_mensagem.imagem_url` e espelhando em `whatsapp_instances.imagem_url`.
   - Se necessário, ajustar a query/invalidação para garantir que a aba Envio carregue a imagem recém-salva.
   - Se a imagem salva vier como URL pública do bucket `imagens-whatsapp`, confirmar que o bucket/policy está público conforme a migration existente.

8. Testar após implementar
   - Simular o clique do botão via navegador/logs ou chamada da Server Function.
   - Confirmar:
     - a função server-side foi chamada;
     - o n8n recebeu resposta HTTP;
     - o payload enviado contém `telefone`, `nome`, `nome_instancia`, `mensagem`, `imagem_url`;
     - a `imagem_url` não está vazia quando há imagem salva;
     - teste e produção retornam mensagens distintas se o n8n estiver inativo/não ouvindo.

Observação importante: em modo somente leitura eu não consigo consultar diretamente o banco externo porque não há `PGHOST` disponível nesta sessão. Na implementação, vou usar a própria Server Function com o Supabase configurado no projeto e os logs/retornos para confirmar o dado salvo e o payload real.