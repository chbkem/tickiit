import { LuCheckCircle2 } from 'react-icons/lu';
import { Badge, Card } from '../ui';
import {
  normalizeValue,
  getLabel,
  statusLabel,
} from '../tickets/ticket-details/utils';
import { PRIORITY_OPTIONS } from '../../lib/constants';

const statusBadgeVariant = {
  open: 'info',
  'in-progress': 'warning',
  'on-hold': 'muted',
  resolved: 'success',
  closed: 'muted',
};

const priorityBadgeVariant = {
  urgent: 'destructive',
  high: 'warning',
  medium: 'info',
  low: 'muted',
};

const AttentionList = ({ tickets, showUnassigned, onSelect, resolvePerson }) => {
  return (
    <section aria-label="Needs attention">
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 pb-4 pt-5">
          <div>
            <h2 className="font-serif text-lg font-bold text-foreground">Needs attention</h2>
            <p className="text-sm text-muted-foreground">
              {showUnassigned
                ? 'Urgent, overdue, and unassigned tickets, newest first.'
                : 'Urgent and overdue tickets, newest first.'}
            </p>
          </div>
          <Badge variant="outline" className="font-mono">
            {tickets.length}
          </Badge>
        </div>

        {tickets.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 px-6 pb-12 pt-2 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success/10 text-success">
              <LuCheckCircle2 className="h-5 w-5" />
            </div>
            <p className="text-sm font-semibold text-foreground">All caught up</p>
            <p className="text-sm text-muted-foreground">Nothing in your queue needs your eyes right now.</p>
          </div>
        ) : (
          <ul className="divide-y">
            {tickets.map((ticket) => {
              const status = normalizeValue(ticket.status);
              const priority = normalizeValue(ticket.priority);
              const overdue = ticket.dueAt && new Date(ticket.dueAt).getTime() < Date.now();

              let assigneeName = null;
              if (ticket.group) {
                assigneeName = resolvePerson(ticket.group);
              } else {
                const assigneeValue = ticket.assigneeId ?? ticket.assignee;
                if (assigneeValue) {
                  const id =
                    typeof assigneeValue === 'string'
                      ? assigneeValue
                      : assigneeValue.id || assigneeValue.userId || '';
                  const name = resolvePerson(assigneeValue);
                  assigneeName = name && name !== id ? name : `#${id}`;
                }
              }

              return (
                <li key={ticket.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(ticket.id)}
                    className="flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  >
                    <Badge
                      variant={priorityBadgeVariant[priority] || 'muted'}
                      className="w-14 flex-none justify-center text-[10px] font-mono uppercase"
                    >
                      {getLabel(PRIORITY_OPTIONS, priority)}
                    </Badge>
                    <span
                      className="hidden w-24 flex-none truncate font-mono text-xs text-muted-foreground sm:block"
                      title={ticket.ticketNumber}
                    >
                      {ticket.ticketNumber}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                      {ticket.subject}
                    </span>
                    {assigneeName && (
                      <span
                        className="hidden w-36 flex-none truncate text-xs text-muted-foreground lg:block"
                        title={assigneeName}
                      >
                        {assigneeName}
                      </span>
                    )}
                    {overdue && (
                      <Badge variant="destructive" className="flex-none text-[10px] font-mono uppercase">
                        Overdue
                      </Badge>
                    )}
                    <Badge
                      variant={statusBadgeVariant[status] || 'outline'}
                      className="flex-none text-[10px] font-mono uppercase"
                    >
                      {statusLabel(status)}
                    </Badge>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </section>
  );
};

export default AttentionList;