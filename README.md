# Nexo Assist

Agent de service desk de TI: o funcionário conversa, o agent consulta a central de ajuda e os chamados, abre/atualiza chamados (sempre com confirmação) e passa para um analista quando necessário.

## Como rodar

```bash
npm install            # Node 22.13+ (usa o SQLite nativo do Node, sem compilar nada)
cp .env.example .env.local   # (PowerShell: copy .env.example .env.local) preencha GOOGLE_GENERATIVE_AI_API_KEY
npm run dev                  # http://localhost:3000
```

Usuários de demonstração (senha `nexo123`):

| Perfil | E-mail |
|---|---|
| Funcionária (tem chamado vencido e resolvido recente) | ana.souza@nexo.com.br |
| Funcionário | bruno.lima@nexo.com.br / carla.mendes@nexo.com.br |
| Analista | diego.alves@nexo.com.br / marina.costa@nexo.com.br |

O banco SQLite (`data/nexo.db`) é criado e populado com funcionários, 9 artigos e 7 chamados na primeira execução. Apague o arquivo para recriar. Testes: `npm test` (prazos/SLA). Typecheck: `npm run typecheck`.

## Arquitetura

```
src/app            UI (Next.js App Router) e rotas /api
src/components     Cards (chamado, rascunho, opções, transferência, trace)
src/mastra         Agent (Mastra) e suas tools
src/lib/desk       Domínio: SLA, chamados (legado), central de ajuda, conversas, auth
src/lib/db.ts      SQLite (node:sqlite, nativo do Node), schema e seed
```

- Interface, agent e serviços são separados: as tools só chamam serviços de `lib/desk`; a UI só fala com `/api`.
- Streaming: `POST /api/conversations/:id/messages` responde NDJSON (`user`, `trace`, `text`, `assistant`, `conversation`, `error`).
- Persistência: conversas, mensagens (com cards/trace), chamados, rascunho pendente e sessões ficam no SQLite e sobrevivem a reinício.

## Como o agent decide

O LLM (Gemini 2.5 Flash via Mastra) escolhe entre 8 tools; as regras do Anexo A estão no prompt **e** reforçadas em código:

| Regra | Onde é garantida |
|---|---|
| Confirmação antes de criar/atualizar | `propose_ticket_draft` só salva rascunho; `confirm_ticket_draft` exige que tenha chegado uma nova mensagem do usuário depois do rascunho |
| Sem duplicidade | `find_similar_tickets` (abertos e resolvidos ≤ 7 dias); `update`/`reopen` validam a janela de 7 dias |
| Prioridade e prazo | Calculados em `sla.ts` (impacto x urgência, horas/dias úteis seg-sex 8h-18h), não pelo LLM; o LLM só informa impacto/bloqueio/compromisso |
| Privacidade | O id do funcionário vem da sessão, nunca do LLM; consultas filtram por solicitante |
| Transferência | Pedido do usuário, chamado crítico (automática em `confirm_ticket_draft`), chamado vencido (oferece) ou falta de segurança. Com status != `agent` o backend não invoca o agent |
| Escopo só TI | Prompt (RH/financeiro/facilities redirecionados) |
| Sistema legado instável | `legacy.ts` simula falhas (`LEGACY_FAILURE_RATE`), faz retry com backoff e, se esgotar, a tool devolve `legacy_unavailable` e o agent avisa o usuário. Escrita é idempotente (chave conversa+turno) |

Transparência: cada resposta traz o bloco "Ações do agent" (tools consultadas) acima do texto, também visível no console.

## Decisões e trade-offs

- **Next.js full-stack + SQLite**: um único processo e poucos comandos; trade-off: SQLite não escala horizontalmente (trocaria por Postgres).
- **Agent criado por requisição**: as tools recebem funcionário/conversa por closure (seguro contra o LLM forjar ids). O histórico vem do nosso banco (últimas 16 mensagens) em vez da memória do Mastra, mantendo custo previsível.
- **Custo**: modelo Flash, `maxSteps: 6`, histórico truncado, limite de 30 mensagens por conversa e 2000 caracteres por mensagem.
- **Console por polling** (3-4s) em vez de WebSocket, por simplicidade.
- **Protótipo**: o layout segue a descrição das telas do PRD; o protótipo no Pencil não pôde ser consultado diretamente, então os detalhes visuais são interpretação.

## Com mais tempo

Testes automatizados de comportamento do agent (evals), rate limiting por usuário, Postgres, SSE/WebSocket no console, autenticação real (SSO), notificações ao analista e ajuste fino visual com o protótipo.

## Uso de IA

Código desenvolvido com assistência de IA (Devin), revisado e testado manualmente.

## Deploy (opcional)

Precisa de disco persistente por causa do SQLite: Railway/Fly.io/Render com volume em `DATABASE_PATH`. Configure `GOOGLE_GENERATIVE_AI_API_KEY` como variável secreta, `LEGACY_FAILURE_RATE=0.15` e limite de gasto na chave do Google AI Studio.
