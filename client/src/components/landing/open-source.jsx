import { LuAtom, LuBox, LuBrain, LuDatabase, LuServer } from 'react-icons/lu';
import { FaGithub } from 'react-icons/fa';
import Logo from '../logo';
import { GITHUB_URL } from './constants';
import { Eyebrow, GitHubLink } from './primitives';

const STACK = [
  { label: 'React', icon: <LuAtom className="h-4 w-4" />, color: 'text-secondary' },
  { label: 'Node', icon: <LuServer className="h-4 w-4" />, color: 'text-info' },
  { label: 'PostgreSQL', icon: <LuDatabase className="h-4 w-4" />, color: 'text-primary' },
  { label: 'Docker', icon: <LuBox className="h-4 w-4" />, color: 'text-warning' },
  { label: 'AI triage', icon: <LuBrain className="h-4 w-4" />, color: 'text-accent' },
];

const OpenSource = () => (
  <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
    <div className="mx-auto max-w-2xl text-center">
      <Eyebrow>Open source</Eyebrow>
      <h2 className="mt-4 font-serif text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
        Your support stack. Your infrastructure.
      </h2>
      <p className="mt-4 text-muted-foreground">
        tickiit is open source and built to run on your infrastructure — MIT licensed, Postgres-backed,
        containerized, and self-hostable in one command.
      </p>
    </div>

    <div className="mx-auto mt-12 max-w-sm rounded-xl border border-border bg-background p-6 shadow-sm">
      <div className="flex items-center gap-2.5 pb-3">
        <Logo className="h-4 w-auto" />
        <span className="font-serif text-base font-bold tracking-tight text-foreground">tickiit</span>
      </div>
      <div>
        <p className="pl-1.5 font-mono text-sm text-muted-foreground">│</p>
        {STACK.map((tech, i) => (
          <div
            key={tech.label}
            className="flex items-center gap-2.5 py-1 font-mono text-sm text-foreground/90"
          >
            <span className="text-muted-foreground">{i === STACK.length - 1 ? '└──' : '├──'}</span>
            <span className={tech.color}>{tech.icon}</span>
            <span>{tech.label}</span>
          </div>
        ))}
      </div>
    </div>

    <div className="mt-10 flex flex-col items-center gap-4">
      <GitHubLink href={GITHUB_URL} target="_blank" rel="noreferrer noopener">
        <FaGithub className="h-4 w-4" />
        View on GitHub
      </GitHubLink>
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        MIT · PostgreSQL · Docker · AI triage
      </p>
    </div>
  </section>
);

export default OpenSource;