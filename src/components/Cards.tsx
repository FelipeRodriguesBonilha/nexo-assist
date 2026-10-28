import { fmtDate } from "@/lib/client";
import { SLA_LABEL } from "@/lib/desk/sla";
import type { MessagePart, Priority, Ticket, TicketStatus } from "@/lib/desk/types";

const DOT: Record<Priority, string> = { Crítica: "bg-red-500", Alta: "bg-amber-500", Média: "bg-slate-400", Baixa: "bg-emerald-500" };
const STATUS_COLOR: Record<TicketStatus, string> = {
  Aberto: "text-blue-600",
  "Em andamento": "text-blue-600",
  "Aguardando analista": "text-amber-600",
  Aprovado: "text-emerald-600",
  Resolvido: "text-slate-500",
};

export const Badge = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>{children}</span>
);

export const Logo = ({ dark = false }: { dark?: boolean }) => (
  <div className="flex items-center gap-2">
    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#0b5fc1] text-xs font-bold text-white">N</span>
    <span className={`text-sm font-semibold ${dark ? "text-white" : "text-slate-900"}`}>Nexo Assist</span>
  </div>
);

const days = (iso: string) => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));
export const ago = (iso: string) => {
  const d = days(iso);
  return d === 0 ? "hoje" : d === 1 ? "há 1 dia" : `há ${d} dias`;
};

export function TicketCard({ ticket }: { ticket: Ticket }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm shadow-sm">
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-500">Chamado · {ticket.id}</span>
        <span className={`flex items-center gap-1 font-medium ${STATUS_COLOR[ticket.status]}`}>
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          {ticket.status}
        </span>
      </div>
      <h4 className="mt-2 text-base font-semibold">{ticket.title}</h4>
      <p className="mt-1 text-slate-600">{ticket.description.split("\n")[0]}</p>
      <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3 text-xs sm:grid-cols-4">
        <div><dt className="text-slate-500">Categoria</dt><dd className="mt-0.5 font-semibold">{ticket.category}</dd></div>
        <div>
          <dt className="text-slate-500">Prioridade</dt>
          <dd className="mt-0.5 flex items-center gap-1 font-semibold"><span className={`h-2 w-2 rounded-full ${DOT[ticket.priority]}`} />{ticket.priority}</dd>
        </div>
        <div><dt className="text-slate-500">Aberto em</dt><dd className="mt-0.5 font-semibold">{fmtDate(ticket.createdAt)}</dd></div>
        <div>
          <dt className="text-slate-500">Última atualização</dt>
          <dd className={`mt-0.5 font-semibold ${ticket.overdue ? "text-red-600" : ""}`}>
            {ago(ticket.updatedAt)}{ticket.overdue && " · prazo vencido"}
          </dd>
        </div>
      </dl>
    </div>
  );
}

export function TicketList({ tickets, onPick, disabled }: { tickets: Ticket[]; onPick?: (t: Ticket) => void; disabled?: boolean }) {
  return (
    <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white text-sm shadow-sm">
      {tickets.map((t) => (
        <button key={t.id} disabled={disabled || !onPick} onClick={() => onPick?.(t)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left enabled:hover:bg-slate-50">
          <span className="h-3.5 w-3.5 shrink-0 rounded-full border border-slate-300" />
          <span className="w-20 shrink-0 text-xs text-slate-500">{t.id}</span>
          <span className="min-w-0 flex-1 truncate">{t.title}</span>
          <span className={`flex shrink-0 items-center gap-1 text-xs ${STATUS_COLOR[t.status]}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{t.status}</span>
          <span className="w-14 shrink-0 text-right text-xs text-slate-400">{fmtDate(t.updatedAt).slice(0, 5)}</span>
        </button>
      ))}
    </div>
  );
}

export function TraceLine({ steps }: { steps: { summary: string; ok: boolean }[] }) {
  return (
    <>
      {steps.map((s, i) => (
        <span key={i} className={`text-xs ${s.ok ? "text-slate-500" : "text-red-600"}`} title={s.summary}>
          {s.ok ? "✓" : "!"} {s.summary.length > 46 ? `${s.summary.slice(0, 46)}…` : s.summary}
        </span>
      ))}
    </>
  );
}

interface ViewProps {
  part: MessagePart;
  onPick?: (text: string) => void;
  onEdit?: () => void;
  disabled?: boolean;
}

export function PartView({ part, onPick, onEdit, disabled }: ViewProps) {
  switch (part.kind) {
    case "trace":
      return null;
    case "ticket":
      return <TicketCard ticket={part.ticket} />;
    case "tickets":
      return <TicketList tickets={part.tickets} disabled={disabled} onPick={onPick && ((t) => onPick(`${t.id} · ${t.title}`))} />;
    case "options":
      return (
        <div>
          <p className="mb-2 text-sm font-semibold">{part.question}</p>
          <div className="flex flex-wrap gap-2">
            {part.options.map((o) => (
              <button key={o} disabled={disabled} onClick={() => onPick?.(o)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-sm hover:border-[#0b5fc1] hover:text-[#0b5fc1] disabled:opacity-50">
                {o}
              </button>
            ))}
          </div>
        </div>
      );
    case "draft": {
      const d = part.draft;
      return (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white text-sm shadow-sm">
          <div className="p-4">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">{{ create: "Novo chamado", update: `Atualizar ${d.ticketId}`, reopen: `Reabrir ${d.ticketId}` }[d.action]}</span>
              <span className="flex items-center gap-1 font-medium text-amber-600"><span className="h-1.5 w-1.5 rounded-full bg-current" />Aguardando confirmação</span>
            </div>
            <h4 className="mt-2 text-base font-semibold">{d.title}</h4>
            <p className="mt-1 whitespace-pre-wrap text-slate-600">{d.description}</p>
            <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3 text-xs sm:grid-cols-4">
              <div><dt className="text-slate-500">Tipo</dt><dd className="mt-0.5 font-semibold">{d.type === "INC" ? "Incidente" : "Requisição"}</dd></div>
              <div><dt className="text-slate-500">Categoria</dt><dd className="mt-0.5 font-semibold">{d.category}</dd></div>
              <div>
                <dt className="text-slate-500">Prioridade</dt>
                <dd className="mt-0.5 flex items-center gap-1 font-semibold"><span className={`h-2 w-2 rounded-full ${DOT[d.priority]}`} />{d.priority} · resposta até {fmtDate(part.dueAt)}</dd>
              </div>
              <div><dt className="text-slate-500">Afetados</dt><dd className="mt-0.5 font-semibold">{d.impact}</dd></div>
            </dl>
            <p className="mt-2 text-[11px] text-slate-400">Prazo de {SLA_LABEL[d.priority]}.</p>
          </div>
          <div className="flex gap-2 border-t border-slate-100 bg-slate-50 px-4 py-2.5">
            <button disabled={disabled} onClick={() => onPick?.("Confirmo, pode prosseguir.")} className="rounded-lg bg-[#0b5fc1] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#094e9e] disabled:opacity-50">Confirmar</button>
            <button disabled={disabled} onClick={onEdit} className="rounded-lg border border-slate-300 bg-white px-4 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50">Editar</button>
            <button disabled={disabled} onClick={() => onPick?.("Cancelar, não quero abrir o chamado.")} className="px-3 py-1.5 text-sm text-slate-600 hover:underline disabled:opacity-50">Cancelar</button>
          </div>
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
