import { LuCalendar, LuClock, LuMessageSquare } from 'react-icons/lu';
import { Badge, Card, CardContent, CardHeader } from '../ui';
import { formatTicketDateTime } from '../../lib/format-date';

const STATUS_VARIANT = {
  OPEN: 'info',
  IN_PROGRESS: 'warning',
  ON_HOLD: 'warning',
  RESOLVED: 'success',
  CLOSED: 'muted',
};

const PRIORITY_VARIANT = {
  LOW: 'muted',
  MEDIUM: 'info',
  HIGH: 'warning',
  URGENT: 'destructive',
};

const titleCase = (value) =>
  String(value || '')
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

const displayAuthor = (authorId) =>
  String(authorId || '').startsWith('customer:') ? 'You' : authorId || 'Support team';

const CustomerTicketView = ({ ticket }) => (
  <div className="space-y-4">
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {ticket.orgName}
          </p>
          <span className="font-mono text-sm font-semibold text-foreground">
            {ticket.ticketNumber}
          </span>
        </div>
        <h1 className="text-2xl font-bold leading-tight text-foreground">{ticket.subject}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={STATUS_VARIANT[ticket.status] || 'muted'}>{titleCase(ticket.status)}</Badge>
          <Badge variant={PRIORITY_VARIANT[ticket.priority] || 'muted'}>
            {titleCase(ticket.priority)} priority
          </Badge>
          <Badge variant="outline">{titleCase(ticket.type)}</Badge>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <LuCalendar className="h-3.5 w-3.5" />
            Opened {formatTicketDateTime(ticket.createdAt)}
          </span>
          <span className="flex items-center gap-1.5">
            <LuClock className="h-3.5 w-3.5" />
            Updated {formatTicketDateTime(ticket.updatedAt)}
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Your request
        </h2>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
          {ticket.description || 'No description was provided.'}
        </p>
      </CardContent>
    </Card>

    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <LuMessageSquare className="h-4 w-4 text-muted-foreground" />
          Conversation
        </h2>
        <span className="text-xs text-muted-foreground">
          {ticket.comments.length} {ticket.comments.length === 1 ? 'reply' : 'replies'}
        </span>
      </CardHeader>
      <CardContent>
        {ticket.comments.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No replies yet. Add one below if you have more detail to share.
          </p>
        ) : (
          <ul className="space-y-4">
            {ticket.comments.map((comment, index) => {
              const isCustomer = String(comment.authorId || '').startsWith('customer:');
              return (
                <li
                  key={comment.id || index}
                  className="rounded-lg border border-border bg-background p-4"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">
                        {displayAuthor(comment.authorId)}
                      </span>
                      {isCustomer && <Badge variant="secondary">Your reply</Badge>}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatTicketDateTime(comment.createdAt)}
                    </span>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                    {comment.body}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  </div>
);

export default CustomerTicketView;
