## Objetivo

Reescrever todo o conteúdo do FAQ para focar **exclusivamente no serviço de envio automático de mensagens de aniversário pelo WhatsApp** (removendo qualquer menção a "atendente virtual", "robô que responde", "confirmação de consulta", "orientações pós-operatórias", etc.) e exibir essas perguntas/respostas como uma **seção retrátil (accordion)** dentro da landing page principal.

---

## 1) Novo conteúdo do FAQ

Vou reescrever `src/content/legal/faq.md` com perguntas alinhadas ao produto real (Dental Hub — automação de aniversários via WhatsApp), agrupadas em 5 blocos:

**Sobre o serviço**
- O que é o Dental Hub?
- Como funciona o envio automático de mensagens de aniversário?
- Preciso instalar algo? Funciona pelo navegador?
- Preciso deixar o computador ligado para o sistema enviar?
- O sistema funciona para qualquer especialidade odontológica?

**Como começar**
- Como subo a lista de pacientes? (importação de planilha Excel/CSV com nome, telefone e data de nascimento)
- É difícil configurar pela primeira vez?
- Posso testar antes de assinar?
- Quais dados preciso para cadastrar um paciente?

**Sobre o WhatsApp e mensagens**
- Posso usar meu WhatsApp pessoal ou precisa ser um número novo?
- Como conecto meu WhatsApp ao Dental Hub? (QR Code, igual WhatsApp Web)
- Posso personalizar o texto da mensagem de aniversário?
- Posso enviar uma imagem ou cartão junto com a mensagem?
- Em que horário as mensagens são enviadas?
- O paciente percebe que é automática?
- E se o paciente responder a mensagem? (cai no seu WhatsApp normalmente)
- Posso pausar os envios quando estiver de férias?

**Pagamento e planos**
- Quais são os valores? (Mensal R$ 37,00 / Trimestral R$ 99,90 / Semestral R$ 188,70 / Anual R$ 355,20)
- Quais formas de pagamento? (PIX e Cartão)
- Existe taxa de adesão?
- Como mudo de plano?

**Cancelamento e suporte**
- Como cancelo o serviço?
- Tem reembolso? (7 dias)
- Como falo com o suporte? (e-mail contato@dentalhub.com.br e WhatsApp (21) 98108-9100)
- O sistema fica fora do ar com frequência?

**Removerei completamente** menções a: "robô responde dúvidas", "confirmação de consultas", "lembretes de consulta", "envio de orientações pós-operatórias", "secretária sobrecarregada com tarefas repetitivas" — pois o produto atual entrega apenas aniversários (os outros serviços aparecem como "Em breve").

---

## 2) Seção FAQ retrátil na landing page

Em `src/components/landing/LandingPage.tsx`:

- Adicionar uma nova seção `<FAQ />` entre `<Benefits />` e `<FinalCta />`.
- Usar o componente `Accordion` já existente em `src/components/ui/accordion.tsx` (modo `type="single"` `collapsible`, com 1 item aberto por vez).
- Estilo coerente com as outras seções (header com chip "Perguntas frequentes", título "Tire suas dúvidas", largura `max-w-3xl`, fundo claro).
- As perguntas exibidas na landing serão um **subconjunto enxuto (8–10 perguntas)** das mais relevantes — não todas, para não poluir. A página `/faq` continuará tendo a versão completa.
- Adicionar "Perguntas frequentes" ao array `navItems` do `Header` e fazer o link rolar até `#faq` (id na seção).
- O link "Perguntas frequentes" no rodapé continuará apontando para `/faq` (versão completa).

Estrutura das perguntas na landing (resumo):
1. Como funciona o envio automático de mensagens de aniversário?
2. Preciso instalar algo no computador?
3. Como subo a lista dos meus pacientes?
4. Posso usar meu WhatsApp pessoal?
5. Posso personalizar o texto da mensagem?
6. Em que horário as mensagens são enviadas?
7. Quais são os valores dos planos?
8. Como cancelo se não gostar?

Cada pergunta como `<AccordionItem>` com `<AccordionTrigger>` (pergunta) e `<AccordionContent>` (resposta em 1–3 frases).

---

## 3) Página `/faq` (mantida)

`src/routes/faq.tsx` continua existindo e renderizando o markdown completo via `<Markdown source={faqMd} />`. Apenas o conteúdo do `.md` é atualizado — sem mudanças estruturais na rota.

---

## Arquivos a editar

- `src/content/legal/faq.md` — reescrever completamente o conteúdo focando em aniversários
- `src/components/landing/LandingPage.tsx` — adicionar seção `<FAQ />` retrátil + item no menu do header

## Arquivos a criar

- Nenhum (o componente `Accordion` já existe)

## O que NÃO muda

- Rota `/faq` continua funcional (versão completa)
- Layout geral, cores, hero, planos, footer, etc.
- Componente `Markdown.tsx` e `LegalLayout.tsx`
