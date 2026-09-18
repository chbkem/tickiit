import { LuBrain, LuCalendar, LuClock, LuPlus, LuSearch } from 'react-icons/lu';
import { cn } from '../../lib/utils';
import Logo from '../logo';
import { Badge, Button } from '../ui';
import { MockAvatar, MockChip } from './primitives';

const MockTicketRow = ({ active, status, statusVariant, id, subject, assignee, time }) => (
  <div
    className={cn(
      'flex items-center gap-3 px-4 py-2 text-xs transition-colors',
      active ? 'bg-primary text-background' : 'hover:bg-muted/40'
    )}
  >
    <span
      className={cn('h-3 w-3 shrink-0 rounded-sm border', active ? 'border-background/60' : 'border-border')}
    />
    <Badge
      variant={statusVariant}
      className={cn('font-mono text-[9px] uppercase', active && 'bg-background/20 text-background')}
    >
      {status}
    </Badge>
    <span className={cn('font-mono text-[11px]', active ? 'text-background/70' : 'text-muted-foreground')}>
      {id}
    </span>
    <span className="min-w-0 flex-1 truncate font-medium">{subject}</span>
    <span className={cn('hidden truncate md:inline', active ? 'text-background/80' : 'text-muted-foreground')}>
      {assignee}
    </span>
    <span
      className={cn(
        'hidden items-center gap-1 truncate sm:flex',
        active ? 'text-background/70' : 'text-muted-foreground/80'
      )}
    >
      <LuClock className="h-3 w-3 shrink-0" />
      {time}
    </span>
  </div>
);

const MockGroup = ({ label, count, children }) => (
  <div>
    <div className="flex items-center justify-between px-4 pb-1 pt-3">
      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </span>
      <span className="rounded-full bg-muted/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
        {count}
      </span>
    </div>
    <div>{children}</div>
  </div>
);

const HeroMock = () => (
  <div className="relative mx-auto mt-16 max-w-6xl">
    <div aria-hidden="true" className="absolute inset-x-8 -top-8 bottom-6 rounded-[3rem] bg-primary/10 blur-3xl" />
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
      <div className="flex items-center gap-3 border-b border-border bg-muted/30 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Logo className="h-5 w-auto" />
          <span className="font-serif text-sm font-bold tracking-tight">tickiit</span>
        </div>
        <div className="mx-auto hidden w-full max-w-xs sm:block">
          <div className="flex items-center gap-2 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-muted-foreground">
            <LuSearch className="h-3.5 w-3.5 shrink-0" />
            Search tickets…
          </div>
        </div>
        <div className="ml-auto flex -space-x-2 sm:ml-0">
          <MockAvatar initials="AR" className="bg-warning" />
          <MockAvatar initials="JT" className="bg-secondary" />
          <MockAvatar initials="MK" className="bg-primary" />
        </div>
      </div>

      <div className="grid bg-border lg:grid-cols-[minmax(0,5fr)_minmax(0,8fr)] lg:gap-px">
        <div className="bg-background lg:border-r lg:border-border">
          <div className="border-b border-border p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Tickets</h3>
              <span className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground">
                <LuPlus className="h-3 w-3" />
                New ticket
              </span>
            </div>
            <div className="mt-3 flex items-center gap-2 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-muted-foreground">
              <LuSearch className="h-3.5 w-3.5 shrink-0" />
              Search by subject…
            </div>
          </div>

          <div className="space-y-1 border-t border-border p-2">
            <MockGroup label="Urgent" count="1">
              <MockTicketRow
                active
                status="Open"
                statusVariant="info"
                id="#0042"
                subject="Login loop after authentication"
                assignee="Support team"
                time="09:12 AM"
              />
            </MockGroup>
            <MockGroup label="High" count="2">
              <MockTicketRow
                status="In progress"
                statusVariant="warning"
                id="#0041"
                subject="Invoice not received after payment"
                assignee="J. Torres"
                time="08:47 AM"
              />
              <MockTicketRow
                status="Open"
                statusVariant="info"
                id="#0039"
                subject="Role permissions missing for new hire"
                assignee="A. Rivera"
                time="09:02 AM"
              />
            </MockGroup>
          </div>
        </div>

        <div className="hidden bg-background sm:block">
          <div className="px-6 pt-5">
            <div className="flex items-start justify-between gap-4">
              <h4 className="font-serif text-lg font-semibold leading-snug tracking-tight text-foreground">
                Login loop after authentication
              </h4>
              <span className="shrink-0 rounded-md bg-muted/60 px-2 py-1 font-mono text-[11px] text-muted-foreground">
                #0042
              </span>
            </div>
            <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              <LuCalendar className="h-3.5 w-3.5 shrink-0" />
              Opened 09/17/2026 by A. Rivera
            </p>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1.5 px-6">
            <MockChip dot="bg-info" label="Open" />
            <MockChip dot="bg-destructive" label="Urgent" />
            <MockChip dot="bg-destructive" label="Bug" />
            <span className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-xs text-foreground">
              <MockAvatar initials="JT" className="h-5 w-5 text-[9px] bg-secondary" />
              <span className="font-medium">J. Torres</span>
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-xs text-foreground">
              <LuCalendar className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="font-medium">Due 09/20/2026</span>
            </span>
          </div>

          <p className="mt-4 px-6 text-sm leading-relaxed text-muted-foreground">
            After last night's deploy, sign-in bounces back to the login screen for multiple users. Password
            reset emails arrive but don't clear the loop. Affects desktop Chrome and Safari.
          </p>

          <div className="mx-6 mt-5 rounded-lg border border-accent/40 bg-accent/5 p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <LuBrain className="h-4 w-4 shrink-0 text-accent-foreground" />
                <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-foreground">
                  AI triage
                </span>
              </div>
              <Badge variant="info" className="font-mono text-[10px] uppercase">
                Auto-classified
              </Badge>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Classified as a <span className="font-medium text-foreground">Bug</span> at{' '}
              <span className="font-medium text-foreground">Urgent</span> priority — a deploy regression
              blocking multiple users. A reply draft is ready to send.
            </p>
            <div className="mt-3 flex gap-2">
              <Button size="sm" className="h-8 px-3 text-xs">
                Review draft
              </Button>
              <Button size="sm" variant="outline" className="h-8 px-3 text-xs">
                Edit classification
              </Button>
            </div>
          </div>

          <div className="mt-5 space-y-4 px-6 pb-6">
            <div>
              <div className="flex items-center gap-1.5">
                <MockAvatar initials="JT" className="h-5 w-5 text-[9px] bg-secondary" />
                <span className="text-xs font-semibold text-foreground">J. Torres</span>
                <span className="rounded bg-muted/60 px-1.5 py-0.5 font-mono text-[9px] uppercase text-muted-foreground">
                  support
                </span>
                <span className="text-xs text-muted-foreground">09/18/2026 9:12 a.m.</span>
              </div>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Checked the 11 p.m. deploy — the auth callback drops the session cookie on redirect. Rolling
                back now.
              </p>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <MockAvatar initials="AR" className="h-5 w-5 text-[9px] bg-warning" />
                <span className="text-xs font-semibold text-foreground">A. Rivera</span>
                <span className="rounded bg-muted/60 px-1.5 py-0.5 font-mono text-[9px] uppercase text-muted-foreground">
                  requester
                </span>
                <span className="text-xs text-muted-foreground">09/18/2026 9:24 a.m.</span>
              </div>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Confirming — still thrown back to login after reset.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

export default HeroMock;