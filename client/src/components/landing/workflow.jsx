import { Fragment, useState } from 'react';
import {
  LuArrowDown,
  LuArrowRight,
  LuCheckCircle2,
  LuChevronRight,
  LuMail,
  LuMessageSquare,
  LuUsers,
  LuZap,
} from 'react-icons/lu';
import { cn } from '../../lib/utils';
import { Badge } from '../ui';
import { Eyebrow, MockAvatar } from './primitives';

const CaptureVisual = () => (
  <div className="rounded-lg border border-border bg-background p-4">
    <div className="flex items-center gap-2 text-muted-foreground">
      <LuMail className="h-3.5 w-3.5 shrink-0" />
      <span className="font-mono text-[10px] uppercase tracking-[0.16em]">email · inbound</span>
    </div>
    <p className="mt-3 text-sm leading-relaxed text-foreground">
      “Checkout crashes every time I reach payment — tried three different cards.”
    </p>
    <div className="mt-3 flex items-center justify-between">
      <span className="rounded-full bg-accent/15 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-accent-foreground">
        pending triage
      </span>
      <span className="font-mono text-[10px] text-muted-foreground">09/17/2026 8:41 p.m.</span>
    </div>
  </div>
);

const TriageVisual = () => (
  <div className="space-y-3">
    <div className="rounded-lg border border-dashed border-border bg-muted/30 p-3 font-mono text-[11px] leading-relaxed text-muted-foreground">
      “it STILL won’t let me in after reset — please help”
    </div>
    <div className="flex items-center justify-center">
      <span className="flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-primary">
        <LuZap className="h-3 w-3" />
        AI triage
      </span>
    </div>
    <div className="rounded-lg border border-border bg-background p-3">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] text-muted-foreground">#0042</span>
        <Badge variant="info" className="font-mono text-[9px] uppercase">
          Classified
        </Badge>
      </div>
      <p className="mt-1 text-sm font-medium text-foreground">Login loop after authentication</p>
      <div className="mt-2 flex gap-4 text-[11px] text-muted-foreground">
        <span>
          Type <span className="font-medium text-foreground">Bug</span>
        </span>
        <span>
          Priority <span className="font-medium text-foreground">Urgent</span>
        </span>
      </div>
    </div>
  </div>
);

const AssignVisual = () => (
  <div className="space-y-2">
    <div className="flex items-center gap-3 rounded-lg border border-accent/50 bg-accent/5 px-3 py-2 text-xs">
      <MockAvatar initials="JT" className="h-6 w-6 bg-secondary" />
      <span className="flex-1 font-medium text-foreground">J. Torres</span>
      <span className="rounded-full bg-accent/15 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-accent-foreground">
        suggested
      </span>
    </div>
    <div className="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2 text-xs">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[9px] text-white">
        <LuUsers className="h-3 w-3" />
      </span>
      <span className="flex-1 font-medium text-foreground">Support team (group)</span>
      <span className="font-mono text-[10px] text-muted-foreground">4 members</span>
    </div>
    <div className="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2 text-xs">
      <MockAvatar initials="AR" className="h-6 w-6 bg-warning" />
      <span className="flex-1 font-medium text-foreground">A. Rivera</span>
      <span className="font-mono text-[10px] text-muted-foreground">requester</span>
    </div>
  </div>
);

const CollaborateVisual = () => (
  <div className="space-y-2.5">
    <div className="rounded-lg border border-border bg-background p-3">
      <div className="flex items-center gap-1.5">
        <MockAvatar initials="JT" className="h-5 w-5 text-[9px] bg-secondary" />
        <span className="text-[11px] font-semibold text-foreground">J. Torres</span>
        <span className="font-mono text-[9px] uppercase text-muted-foreground">support · 9:12 a.m.</span>
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
        Root cause found — auth callback drops the session cookie on redirect.
      </p>
    </div>
    <div className="rounded-lg border border-border bg-background p-3">
      <div className="flex items-center gap-1.5">
        <MockAvatar initials="AR" className="h-5 w-5 text-[9px] bg-warning" />
        <span className="text-[11px] font-semibold text-foreground">A. Rivera</span>
        <span className="font-mono text-[9px] uppercase text-muted-foreground">requester · 9:24 a.m.</span>
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">Fix confirmed on my end, thanks.</p>
    </div>
    <div className="rounded-lg border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
      Write a comment…
    </div>
  </div>
);

const ResolveVisual = () => (
  <div className="rounded-lg border border-border bg-background p-4">
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-info" />
        <span className="font-mono text-[10px] text-muted-foreground">open</span>
        <LuArrowRight className="h-3 w-3 text-muted-foreground/50" />
        <span className="h-2 w-2 rounded-full bg-warning" />
        <span className="font-mono text-[10px] text-muted-foreground">in-progress</span>
        <LuArrowRight className="h-3 w-3 text-muted-foreground/50" />
        <span className="h-2 w-2 rounded-full bg-success" />
        <span className="font-mono text-[10px] text-muted-foreground">resolved</span>
      </div>
      <Badge variant="success" className="font-mono text-[10px] uppercase">
        Resolved
      </Badge>
    </div>
    <p className="mt-3 font-mono text-[11px] text-muted-foreground">
      <span className="text-foreground">resolvedAt</span> 09/18/2026 2:12 p.m.
    </p>
  </div>
);

const WORKFLOW_STEPS = [
  {
    title: 'Capture',
    tagline: 'Customer reports a problem',
    icon: <LuMail className="h-4 w-4" />,
    description:
      'Messages arrive from email, chat, or a web form and land straight in the queue — nothing gets lost in an inbox.',
    visual: <CaptureVisual />,
  },
  {
    title: 'AI triage',
    tagline: 'AI reads, classifies, prioritizes',
    icon: <LuZap className="h-4 w-4" />,
    description:
      'The pipeline turns the raw message into a clean ticket — subject, type, and priority decided before a human lifts a finger.',
    visual: <TriageVisual />,
  },
  {
    title: 'Assign',
    tagline: 'Route to the right person',
    icon: <LuUsers className="h-4 w-4" />,
    description:
      'Send it to a person, a support team group, or keep it on the requester — with suggestions when they are useful.',
    visual: <AssignVisual />,
  },
  {
    title: 'Collaborate',
    tagline: 'Comments and context in one thread',
    icon: <LuMessageSquare className="h-4 w-4" />,
    description:
      'Every note and decision stays attached to the ticket, so the back-and-forth never scatters across channels.',
    visual: <CollaborateVisual />,
  },
  {
    title: 'Resolve',
    tagline: 'Track it to done',
    icon: <LuCheckCircle2 className="h-4 w-4" />,
    description:
      'Move through Open → In Progress → Resolved with lifecycle timestamps tracked automatically as status changes.',
    visual: <ResolveVisual />,
  },
];

const Workflow = () => {
  const [activeStep, setActiveStep] = useState(0);

  return (
    <section id="how-it-works" className="mx-auto max-w-6xl px-4 pb-24 pt-6 sm:px-6">
      <div className="mx-auto mb-14 max-w-2xl text-center">
        <Eyebrow>Workflow</Eyebrow>
        <h2 className="mt-4 font-serif text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Every ticket has a lifecycle.
        </h2>
        <p className="mt-4 text-muted-foreground">
          From the first inbound message to a marked-as-done ticket — the whole story stays in one place.
        </p>
      </div>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-16">
        <div className="flex flex-col justify-center">
          {WORKFLOW_STEPS.map((step, i) => {
            const isActive = i === activeStep;
            return (
              <Fragment key={step.title}>
                {i > 0 && (
                  <div className="flex justify-center py-0.5">
                    <LuArrowDown className="h-3.5 w-3.5 text-muted-foreground/30" />
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setActiveStep(i)}
                  onMouseEnter={() => setActiveStep(i)}
                  onFocus={() => setActiveStep(i)}
                  className={cn(
                    'group relative flex w-full items-center gap-4 rounded-lg px-3 py-3.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    isActive ? 'bg-card shadow-sm' : 'hover:bg-muted/40'
                  )}
                >
                  <span
                    className={cn(
                      'font-mono text-sm tabular-nums',
                      isActive ? 'text-primary' : 'text-muted-foreground/60'
                    )}
                  >
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span
                    className={cn(
                      'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors',
                      isActive ? 'bg-primary/10 text-primary' : 'bg-muted/60 text-muted-foreground'
                    )}
                  >
                    {step.icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        'block text-sm font-semibold',
                        isActive ? 'text-foreground' : 'text-foreground/70'
                      )}
                    >
                      {step.title}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">{step.tagline}</span>
                  </span>
                  <LuChevronRight
                    className={cn(
                      'h-4 w-4 shrink-0 transition-all',
                      isActive ? 'translate-x-0 text-primary' : '-translate-x-1 text-muted-foreground/40'
                    )}
                  />
                </button>
              </Fragment>
            );
          })}
        </div>

        <div key={activeStep}>
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                Step {String(activeStep + 1).padStart(2, '0')} — {WORKFLOW_STEPS[activeStep].title}
              </span>
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                {WORKFLOW_STEPS[activeStep].icon}
              </span>
            </div>
            <h3 className="mt-3 font-sans text-2xl font-bold tracking-tight text-foreground">
              {WORKFLOW_STEPS[activeStep].title}
            </h3>
            <p className="mt-2 text-muted-foreground">{WORKFLOW_STEPS[activeStep].description}</p>
            <div className="mt-6">{WORKFLOW_STEPS[activeStep].visual}</div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Workflow;