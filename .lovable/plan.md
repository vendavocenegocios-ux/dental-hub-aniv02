Pedido atual: remover completamente da aplicação o procedimento de envio de teste de mensagem e as referências às webhooks usadas nesse teste.

Feito:
- Removido da aba Envio o formulário/botão de envio de teste.
- Removido da aba Envio o seletor de webhook, URLs de teste/produção, diagnóstico de rede e último envio de teste.
- Removidas as imports/chamadas das server functions relacionadas ao teste por webhook.
- Mantido somente o status do WhatsApp, aviso de mensagem configurada e histórico real de envios registrados pela automação.
- Removidos os arquivos de server function usados exclusivamente para webhook/diagnóstico de teste.
