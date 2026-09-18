import { LuArrowDown, LuArrowRight, LuBrain } from 'react-icons/lu';
import { cn } from '../../lib/utils';
import { Badge } from '../ui';
import { Eyebrow } from './primitives';

const FIELDS = [
  { label: 'Type', value: 'Bug', dot: 'bg-destructive' },
  { label: 'Priority', value: 'Urgent', dot: 'bg-destructive' },
  { label: 'Status', value: 'Open', dot: 'bg-info' },
  { label: 'Assignee', value: 'Support team', dot: 'bg-primary' },
];

const AiTriage = () => (
  <section id="ai-triage" className="-mt-24 px-4 pb-20 pt-40 sm:px-6">
    <div className="mx-auto text-center">
      <Eyebrow>AI triage</Eyebrow>
    </div>

    <div className="mx-auto mt-8 grid items-center gap-6 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:gap-10">
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Raw customer message
          </span>
          <Badge variant="muted" className="font-mono text-[10px] uppercase">
            inbound
          </Badge>
        </div>
        <div className="mt-4 rounded-lg bg-muted/40 p-5 font-mono text-sm leading-relaxed text-foreground/90">
          hey, i've tried logging in like 5 times
          <br />
          and it just keeps throwing me back to the
          <br />
          login screen. password reset didn't help either
        </div>
      </div>

      <div className="flex items-center justify-center lg:flex-col lg:gap-3">
        <div className="flex flex-row-reverse items-center gap-2 lg:flex-col">
          <span className="rounded-full bg-accent/15 px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-accent-foreground">
            AI triage
          </span>
          <span className="hidden lg:block">
            <LuArrowDown className="h-4 w-4 text-accent-foreground" />
          </span>
        </div>
        <LuArrowRight className="h-4 w-4 text-accent-foreground lg:hidden" />
      </div>

      <div className="rounded-xl border border-border bg-card p-6 shadow-xl">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Structured ticket
          </span>
          <Badge variant="success" className="font-mono text-[10px] uppercase">
            Created
          </Badge>
        </div>
        <div className="mt-4 flex items-baseline justify-between gap-3">
          <span className="font-mono text-xs text-muted-foreground">#0042</span>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <LuBrain className="h-3.5 w-3.5 text-accent" /> auto-classified
          </span>
        </div>
        <p className="mt-1 font-sans text-xl font-bold leading-snug tracking-tight text-foreground">
          Login loop after authentication
        </p>
        <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4">
          {FIELDS.map((field) => (
            <div key={field.label}>
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                {field.label}
              </p>
              <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-foreground">
                <span className={cn('h-2 w-2 shrink-0 rounded-full', field.dot)} />
                {field.value}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>

    <div className="mx-auto mt-14 max-w-2xl text-center">
      <h2 className="font-serif text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
        From complaint to actionable ticket.
      </h2>
      <p className="mt-4 text-muted-foreground">
        tickiit normalizes the inbound message, classifies the type, prioritizes the work, and creates a clean
        ticket your team can assign — automatically, in one step.
      </p>
    </div>
  </section>
);

export default AiTriage;