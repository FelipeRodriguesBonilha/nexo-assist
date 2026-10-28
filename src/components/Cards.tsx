import { SLA_LABEL } from "@/lib/desk/sla";
import { fmtDate } from "@/lib/client";
import type { MessagePart, Priority, Ticket } from "@/lib/desk/types";

const PRIORITY_STYLE: Record<Priority, string> = {
  Crítica: "bg-red-100 text-red-700",
  Alta: "bg-orange-100 text-orange-700",
  Média: "bg-amber-100 text-amber-700",
  Baixa: "bg-slate-100 text-slate-600",
};

export const Badge = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>{children}</span>
);

export function TicketCard({ ticket }: { ticket: Ticket }) {
  return (
    <div className={`rounded-xl border bg-white p-3 text-sm shadow-sm ${ticket.overdue ? "border-red-300" : "border-slate-200"}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold text-indigo-700">{ticket.id}</span>
        <Badge className={PRIORITY_STYLE[ticket.priority]}>{ticket.priority}</Badge>
        <Badge className="bg-slate-100 text-slate-700">{ticket.status}</Badge>
        {ticket.overdue && <Badge className="bg-red-600 text-white">Prazo vencido</Badge>}
      </div>
      <p className="mt-1 font-medium">{ticket.title}</p>
      <p className="mt-0.5 text-xs text-slate-500">
        {ticket.category} · atualizado em {fmtDate(ticket.updatedAt)}
        {ticket.status !== "Resolvido" && ` · prazo ${fmtDate(ticket.dueAt)}`}
      </p>
    </div>
  );
}

export function PartView({ part, onPick, disabled }: { part: MessagePart; onPick?: (text: string) => void; disabled?: boolean }) {
  switch (part.kind) {
    case "trace":
      return (
        <details className="text-xs text-slate-500" open>
          <summary className="cursor-pointer select-none">Ações do agent ({part.steps.length})</summary>
          <ul className="mt-1 space-y-0.5 border-l-2 border-slate-200 pl-2">
            {part.steps.map((s, i) => (
              <li key={i} className={s.ok ? "" : "text-red-600"}>
                {s.ok ? "✓" : "!"} {s.summary}
              </li>
            ))}
          </ul>
        </details>
      );
    case "ticket":
      return <TicketCard ticket={part.ticket} />;
    case "tickets":
      return (
        <div className="space-y-2">
          {part.tickets.map((t) => (
            <TicketCard key={t.id} ticket={t} />
          ))}
        </div>
      );
    case "options":
      return (
        <div className="flex flex-wrap gap-2">
          {part.options.map((o) => (
            <button
              key={o}
              disabled={disabled}
              onClick={() => onPick?.(o)}
              className="rounded-full border border-indigo-300 bg-white px-3 py-1 text-sm text-indigo-700 hover:bg-indigo-50 disabled:opacity-40"
            >
              {o}
            </button>
          ))}
        </div>
      );
    case "draft": {
      const d = part.draft;
      const verb = { create: "Novo chamado", update: `Atualizar ${d.ticketId}`, reopen: `Reabrir ${d.ticketId}` }[d.action];
      return (
        <div className="rounded-xl border-2 border-dashed border-indigo-300 bg-indigo-50/50 p-3 text-sm">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className="font-semibold text-indigo-800">Rascunho · {verb}</span>
            <Badge className={PRIORITY_STYLE[d.priority]}>{d.priority}</Badge>
          </div>
          <p className="font-medium">{d.title}</p>
          <p className="mt-1 whitespace-pre-wrap text-slate-600">{d.description}</p>
          <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-slate-600">
            <dt>Tipo</dt><dd>{d.type === "INC" ? "Incidente (INC)" : "Requisição (REQ)"}</dd>
            <dt>Categoria</dt><dd>{d.category}</dd>
            <dt>Afetado</dt><dd>{d.impact}</dd>
            <dt>Urgência</dt><dd>{d.urgency}</dd>
            <dt>Prazo ({SLA_LABEL[d.priority]})</dt><dd>{fmtDate(part.dueAt)}</dd>
          </dl>
        </div>
      );
    }
    case "handoff":
      return (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm">
          <p className="font-semibold text-amber-800">Conversa transferida para um analista</p>
          <p className="text-xs text-amber-700">Motivo: {part.reason}</p>
          <p className="mt-1 whitespace-pre-wrap text-slate-700">{part.summary}</p>
        </div>
      );
  }
}
