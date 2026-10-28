import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { searchArticles } from "@/lib/desk/kb";
import { getDraft, setDraft, updateConversation, countUserMessages } from "@/lib/desk/conversations";
import { LegacyUnavailableError } from "@/lib/desk/legacy";
import { SLA_LABEL, computeDueAt, derivePriority } from "@/lib/desk/sla";
import { isOpen, legacyApplyDraft, legacyFindSimilar, legacyGetTicket, legacyListTickets, newId } from "@/lib/desk/tickets";
import { CATEGORIES, type Employee, type MessagePart, type TicketDraft, type TraceStep } from "@/lib/desk/types";

export interface ToolContext {
  employee: Employee;
  conversationId: string;
  parts: MessagePart[];
  trace: TraceStep[];
}

const UNAVAILABLE = {
  error: "legacy_unavailable",
  message: "O sistema de chamados está instável agora. Avise o funcionário, não invente dados e ofereça tentar de novo ou chamar um analista.",
};

export function buildTools(ctx: ToolContext) {
  const step = (tool: string, summary: string, ok = true) => ctx.trace.push({ tool, summary, ok });

  /** Executa uma operação no sistema legado convertendo indisponibilidade em resultado estruturado para o agent. */
  async function guarded<T>(tool: string, label: string, op: () => Promise<T>): Promise<T | typeof UNAVAILABLE> {
    try {
      const r = await op();
      step(tool, label);
      return r;
    } catch (e) {
      if (e instanceof LegacyUnavailableError) {
        step(tool, `${label} (sistema de chamados indisponível)`, false);
        return UNAVAILABLE;
      }
      throw e;
    }
  };

  const searchKnowledgeBase = createTool({
    id: "search_knowledge_base",
    description: "Busca artigos na central de ajuda. Use antes de abrir chamado para tentar resolver a dúvida no próprio chat.",
    inputSchema: z.object({ query: z.string().describe("Palavras-chave do problema") }),
    execute: async ({ query }) => {
      const articles = searchArticles(query);
      step("search_knowledge_base", `consultou a central de ajuda por "${query}" (${articles.length} artigo(s))`);
      return { articles };
    },
  });

  const listMyTickets = createTool({
    id: "list_my_tickets",
    description: "Lista os chamados do próprio funcionário logado (abertos e/ou resolvidos). Nunca traz chamados de outras pessoas.",
    inputSchema: z.object({ status: z.enum(["aberto", "resolvido"]).optional() }),
    execute: async ({ status }) =>
      guarded("list_my_tickets", "consultou seus chamados", async () => {
        const tickets = await legacyListTickets(ctx.employee.id, status);
        if (tickets.length) ctx.parts.push({ kind: "tickets", tickets });
        return { tickets };
      }),
  });

  const getTicket = createTool({
    id: "get_ticket",
    description: "Consulta um chamado pelo número (ex.: INC-20311). Só retorna se o chamado pertencer ao funcionário logado.",
    inputSchema: z.object({ ticketId: z.string() }),
    execute: async ({ ticketId }) =>
      guarded("get_ticket", `consultou o chamado ${ticketId.toUpperCase()}`, async () => {
        const ticket = await legacyGetTicket(ctx.employee.id, ticketId);
        if (!ticket) return { found: false, message: "Não encontrei esse chamado entre os seus. Não revele informações de chamados de terceiros." };
        ctx.parts.push({ kind: "ticket", ticket });
        return { found: true, ticket, hint: ticket.overdue ? "Chamado VENCIDO: ofereça chamar um analista." : undefined };
      }),
  });

  const findSimilarTickets = createTool({
    id: "find_similar_tickets",
    description: "Procura chamados do funcionário (abertos, ou resolvidos há até 7 dias) sobre o mesmo problema. Chame SEMPRE antes de propor um novo chamado.",
    inputSchema: z.object({ text: z.string().describe("Resumo do problema"), category: z.enum(CATEGORIES).optional() }),
    execute: async ({ text, category }) =>
      guarded("find_similar_tickets", "verificou chamados duplicados", async () => {
        const similar = await legacyFindSimilar(ctx.employee.id, text, category);
        return { similar, hint: similar.length ? "Atualize (open) ou reabra (reopenable) em vez de criar outro." : "Nenhum duplicado." };
      }),
  });

  const proposeTicketDraft = createTool({
    id: "propose_ticket_draft",
    description:
      "Monta o RASCUNHO do chamado (criar, atualizar ou reabrir) e mostra ao funcionário para confirmação. NÃO cria nada. Só chame com todos os campos conhecidos; pergunte o que faltar. A prioridade é calculada pelo sistema.",
    inputSchema: z.object({
      action: z.enum(["create", "update", "reopen"]),
      ticketId: z.string().optional().describe("Obrigatório em update/reopen"),
      type: z.enum(["INC", "REQ"]).describe("INC: algo parou/não funciona. REQ: pedido de acesso, equipamento ou software."),
      title: z.string().min(5),
      description: z.string().min(20).describe("Descrição completa, sem exigir novas perguntas do analista"),
      category: z.enum(CATEGORIES),
      impact: z.enum(["pessoa", "equipe", "empresa"]).describe("Quem é afetado"),
      blocked: z.boolean().describe("O funcionário/equipe está impedido de trabalhar?"),
      sameDayCommitment: z.boolean().describe("Há compromisso no mesmo dia em risco?"),
    }),
    execute: async (i) => {
      if (i.action !== "create" && !i.ticketId) return { error: "ticketId é obrigatório para atualizar/reabrir." };
      const priority = derivePriority({ impact: i.impact, blocked: i.blocked, sameDayCommitment: i.sameDayCommitment, type: i.type });
      const draft: TicketDraft = {
        action: i.action, ticketId: i.ticketId?.toUpperCase(), type: i.type, title: i.title, description: i.description, category: i.category,
        priority, impact: { pessoa: "Apenas o solicitante", equipe: "Uma equipe", empresa: "A empresa toda" }[i.impact],
        urgency: i.blocked ? "Impede o trabalho" : i.sameDayCommitment ? "Compromisso no mesmo dia" : "Há alternativa / sem urgência",
      };
      setDraft(ctx.conversationId, draft);
      const dueAt = computeDueAt(priority, new Date()).toISOString();
      ctx.parts.push({ kind: "draft", draftId: newId(), draft, dueAt, slaLabel: SLA_LABEL[priority] });
      step("propose_ticket_draft", `montou rascunho (${i.type}, ${i.category}, prioridade ${priority})`);
      return { shown: true, priority, sla: SLA_LABEL[priority], next: "Peça confirmação explícita. NÃO confirme nesta mesma resposta." };
    },
  });

  const confirmTicketDraft = createTool({
    id: "confirm_ticket_draft",
    description: "Cria/atualiza/reabre o chamado do rascunho vigente. Só chame DEPOIS que o funcionário confirmar explicitamente em uma mensagem posterior ao rascunho.",
    inputSchema: z.object({}),
    execute: async () => {
      const pending = getDraft(ctx.conversationId);
      if (!pending) return { error: "Não há rascunho pendente. Proponha um rascunho primeiro." };
      if (countUserMessages(ctx.conversationId) <= pending.turn)
        return { error: "O funcionário ainda não confirmou o rascunho. Mostre o rascunho e aguarde a confirmação." };
      const result = await guarded("confirm_ticket_draft", `${{ create: "criou", update: "atualizou", reopen: "reabriu" }[pending.draft.action]} o chamado`, () =>
        legacyApplyDraft(ctx.employee.id, pending.draft, `${ctx.conversationId}:${pending.turn}`),
      );
      if ("error" in result) return result;
      setDraft(ctx.conversationId, null);
      ctx.parts.push({ kind: "ticket", ticket: result });
      const critical = result.priority === "Crítica";
      if (critical) {
        const summary = `Chamado crítico ${result.id}: ${result.title}. ${result.description}`;
        updateConversation(ctx.conversationId, { status: "waiting_analyst", handoffSummary: summary });
        ctx.parts.push({ kind: "handoff", summary, reason: "Chamado de prioridade crítica" });
        step("escalate_to_analyst", "transferiu para um analista (caso crítico)");
      }
      return { ticket: result, escalatedToAnalyst: critical };
    },
  });

  const offerOptions = createTool({
    id: "offer_options",
    description: "Exibe opções rápidas (botões) para o funcionário responder com um clique. Use ao perguntar algo com respostas previsíveis.",
    inputSchema: z.object({ question: z.string(), options: z.array(z.string()).min(2).max(5) }),
    execute: async ({ question, options }) => {
      ctx.parts.push({ kind: "options", question, options });
      return { shown: true };
    },
  });

  const escalateToAnalyst = createTool({
    id: "escalate_to_analyst",
    description:
      "Transfere a conversa para um analista humano. Use quando o funcionário pedir, em casos críticos, em chamados vencidos (após aceitar) ou quando você não tiver segurança. Após isso o agent para de responder.",
    inputSchema: z.object({ reason: z.string(), summary: z.string().describe("Resumo do caso para o analista: problema, o que já foi tentado, chamados relacionados") }),
    execute: async ({ reason, summary }) => {
      updateConversation(ctx.conversationId, { status: "waiting_analyst", handoffSummary: summary });
      ctx.parts.push({ kind: "handoff", summary, reason });
      step("escalate_to_analyst", `transferiu para um analista (${reason})`);
      return { transferred: true, note: "Avise o funcionário que um analista vai assumir. Não responda mais." };
    },
  });

  return {
    search_knowledge_base: searchKnowledgeBase,
    list_my_tickets: listMyTickets,
    get_ticket: getTicket,
    find_similar_tickets: findSimilarTickets,
    propose_ticket_draft: proposeTicketDraft,
    confirm_ticket_draft: confirmTicketDraft,
    offer_options: offerOptions,
    escalate_to_analyst: escalateToAnalyst,
  };
}



