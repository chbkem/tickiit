import {
  LuArrowRight,
  LuCheckCircle2,
  LuHistory,
  LuLayers,
  LuListChecks,
  LuMessageSquare,
  LuShield,
  LuUsers,
} from 'react-icons/lu';
import { cn } from '../../lib/utils';
import { Badge, Card } from '../ui';
import { Eyebrow, MockAvatar } from './primitives';

const BentoCard = ({ icon, title, description, children, className }) => (
  <Card className={cn('flex flex-col p-6', className)}>
    <div className="flex items-center gap-2.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
        {icon}
      </span>
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
    </div>
    {description && <p className="mt-2 text-sm text-muted-foreground">{description}</p>}
    {children}
  </Card>
);

const TicketsBentoVisual = () => (
  <div className="mt-6 flex-1 overflow-hidden rounded-lg border border-border bg-background">
    <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
      <span className="text-xs font-semibold text-foreground">Tickets</span>
      <span className="rounded-full bg-primary/10 px-2 py-0.5 font-mono text-[10px] text-primary">12 open</span>
    </div>
    {[
      { v: 'info', s: 'Open', id: '#0042', sub: 'Login loop after authentication', a: 'Support team', active: true },
      { v: 'warning', s: 'In progress', id: '#0041', sub: 'Invoice not received after payment', a: 'J. Torres' },
      { v: 'info', s: 'Open', id: '#0039', sub: 'Role permissions missing for new hire', a: 'A. Rivera' },
      { v: 'success', s: 'Resolved', id: '#0036', sub: 'Two-factor enroll loop', a: 'T. Tanaka' },
    ].map((row) => (
      <div
        key={row.id}
        className={cn(
          'flex items-center gap-2.5 border-b border-border/60 px-4 py-2.5 text-xs last:border-0',
          row.active && 'bg-primary text-background'
        )}
      >
        <Badge
          variant={row.v}
          className={cn('font-mono text-[9px] uppercase', row.active && 'bg-background/20 text-background')}
        >
          {row.s}
        </Badge>
        <span className={cn('font-mono text-[10px]', row.active ? 'text-background/70' : 'text-muted-foreground')}>
          {row.id}
        </span>
        <span className="min-w-0 flex-1 truncate font-medium">{row.sub}</span>
        <span
          className={cn('hidden truncate sm:inline', row.active ? 'text-background/80' : 'text-muted-foreground')}
        >
          {row.a}
        </span>
      </div>
    ))}
  </div>
);

const PRIORITY_ROWS = [
  { label: 'Urgent', dot: 'bg-destructive', count: '2' },
  { label: 'High', dot: 'bg-warning', count: '7' },
  { label: 'Medium', dot: 'bg-info', count: '4' },
  { label: 'Low', dot: 'bg-muted-foreground', count: '3' },
];

const Features = () => (
  <section id="features" className="border-y border-border bg-card/40">
    <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
      <div className="mx-auto mb-14 max-w-2xl text-center">
        <Eyebrow>Capabilities</Eyebrow>
        <h2 className="mt-4 font-serif text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Everything around the ticket.
        </h2>
        <p className="mt-4 text-muted-foreground">
          Not just a queue — the roles, context, and history that make a ticket actually resolvable.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <BentoCard
          className="lg:col-span-2 lg:row-span-2"
          icon={<LuLayers className="h-4 w-4" />}
          title="Ticket management"
          description="One workspace for every request — grouped by priority, searchable, and filterable."
        >
          <TicketsBentoVisual />
        </BentoCard>

        <BentoCard
          icon={<LuListChecks className="h-4 w-4" />}
          title="Priorities & status"
          description="Clear signal at a glance."
        >
          <div className="mt-5 space-y-2">
            {PRIORITY_ROWS.map((row) => (
              <div key={row.label} className="flex items-center gap-2.5 text-xs">
                <span className={cn('h-2 w-2 shrink-0 rounded-full', row.dot)} />
                <span className="flex-1 font-medium text-foreground">{row.label}</span>
                <span className="font-mono text-muted-foreground">{row.count}</span>
              </div>
            ))}
            <div className="flex items-center gap-2.5 pt-1 text-xs">
              <span className="flex items-center gap-1.5 font-medium text-muted-foreground">
                <LuCheckCircle2 className="h-3.5 w-3.5 text-success" />
                <span className="text-foreground">Resolved</span>
                <span className="font-mono text-muted-foreground">13</span>
              </span>
            </div>
          </div>
        </BentoCard>

        <BentoCard
          icon={<LuUsers className="h-4 w-4" />}
          title="Team roles"
          description="Assign to a person, a group, or an organization."
        >
          <div className="mt-5 space-y-2">
            <div className="flex items-center gap-2.5 rounded-lg border border-border bg-background px-3 py-2 text-xs">
              <MockAvatar initials="TT" className="h-6 w-6 bg-primary" />
              <span className="flex-1 font-medium text-foreground">T. Tanaka</span>
              <Badge variant="info" className="font-mono text-[9px] uppercase">
                Admin
              </Badge>
            </div>
            <div className="flex items-center gap-2.5 rounded-lg border border-border bg-background px-3 py-2 text-xs">
              <MockAvatar initials="AR" className="h-6 w-6 bg-warning" />
              <span className="flex-1 font-medium text-foreground">A. Rivera</span>
              <Badge variant="muted" className="font-mono text-[9px] uppercase">
                Requester
              </Badge>
            </div>
            <div className="flex items-center gap-2.5 rounded-lg border border-border bg-background px-3 py-2 text-xs">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                <LuUsers className="h-3 w-3" />
              </span>
              <span className="flex-1 font-medium text-foreground">Support team</span>
              <Badge variant="secondary" className="font-mono text-[9px] uppercase">
                Group
              </Badge>
            </div>
          </div>
        </BentoCard>

        <BentoCard
          icon={<LuMessageSquare className="h-4 w-4" />}
          title="Comments & context"
          description="Per-ticket threads keep the discussion attached to the work."
        >
          <div className="mt-5 space-y-2">
            <div className="rounded-lg border border-border bg-background p-3">
              <div className="flex items-center gap-1.5">
                <MockAvatar initials="JT" className="h-5 w-5 text-[9px] bg-secondary" />
                <span className="text-[11px] font-semibold text-foreground">J. Torres</span>
                <span className="font-mono text-[9px] uppercase text-muted-foreground">support</span>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                Root cause found — fixing the session cookie.
              </p>
            </div>
            <div className="rounded-lg border border-border bg-background p-3">
              <div className="flex items-center gap-1.5">
                <MockAvatar initials="AR" className="h-5 w-5 text-[9px] bg-warning" />
                <span className="text-[11px] font-semibold text-foreground">A. Rivera</span>
                <span className="font-mono text-[9px] uppercase text-muted-foreground">requester</span>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">Working now — thanks.</p>
            </div>
          </div>
        </BentoCard>

        <BentoCard
          icon={<LuHistory className="h-4 w-4" />}
          title="Lifecycle tracking"
          description="Timestamps managed automatically as status changes."
        >
          <div className="mt-5 space-y-2">
            <div className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2.5">
              <span className="h-2 w-2 rounded-full bg-info" />
              <span className="font-mono text-[10px] text-muted-foreground">open</span>
              <LuArrowRight className="h-3 w-3 text-muted-foreground/50" />
              <span className="h-2 w-2 rounded-full bg-warning" />
              <span className="font-mono text-[10px] text-muted-foreground">in-progress</span>
              <LuArrowRight className="h-3 w-3 text-muted-foreground/50" />
              <span className="h-2 w-2 rounded-full bg-success" />
              <span className="font-mono text-[10px] text-muted-foreground">resolved</span>
            </div>
            <div className="space-y-1 rounded-lg border border-border bg-background px-3 py-2.5 font-mono text-[11px] text-muted-foreground">
              <p>
                resolvedAt <span className="text-foreground">09/18/2026 2:12 p.m.</span>
              </p>
              <p>
                closedAt <span className="text-foreground/60">—</span>
              </p>
            </div>
          </div>
        </BentoCard>

        <BentoCard
          icon={<LuShield className="h-4 w-4" />}
          title="Secure by default"
          description="Protected from the first request to the last click."
        >
          <div className="mt-5 rounded-lg border border-border bg-background p-3.5">
            <div className="flex items-center gap-2 text-xs font-medium text-foreground">
              <LuShield className="h-4 w-4 shrink-0 text-primary" />
              Passwordless-first authentication
            </div>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              <Badge variant="outline" className="font-mono text-[9px] uppercase">
                Clerk sessions
              </Badge>
              <Badge variant="outline" className="font-mono text-[9px] uppercase">
                Role-gated
              </Badge>
              <Badge variant="outline" className="font-mono text-[9px] uppercase">
                Sanitized input
              </Badge>
            </div>
          </div>
        </BentoCard>
      </div>
    </div>
  </section>
);

export default Features;