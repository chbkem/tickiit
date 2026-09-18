import { FaGithub } from 'react-icons/fa';
import { cn } from '../../lib/utils';
import { Button } from '../ui';
import { GITHUB_URL } from './constants';
import { GitHubLink } from './primitives';
import HeroMock from './hero-mock';

const PILLS = [
  { label: 'Open source', dot: 'bg-primary' },
  { label: 'AI triage', dot: 'bg-accent' },
  { label: 'Team roles', dot: 'bg-secondary' },
  { label: 'Ticket lifecycle', dot: 'bg-info' },
];

const Hero = ({ isLoaded, isSignedIn, onPrimaryAction }) => (
  <section className="relative overflow-x-clip bg-gradient-to-b from-background via-primary/5 to-background px-4 pb-0 pt-20 sm:px-6 sm:pt-28">
    <div className="mx-auto max-w-3xl text-center">
      <span className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        <span className="h-1.5 w-1.5 rounded-full bg-primary" />
        Open source · AI-powered support
      </span>
      <h1 className="mt-7 font-sans text-4xl font-bold leading-[1.08] tracking-tight sm:text-6xl">
        Turn <span className="font-serif italic text-primary">messy</span> support requests into resolved tickets.
      </h1>
      <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
        Capture, triage, assign, and resolve support requests in one focused workspace.
      </p>
      <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <Button size="lg" loading={!isLoaded} onClick={onPrimaryAction}>
          {isSignedIn ? 'Go to dashboard' : 'Get started'}
        </Button>
        <GitHubLink href={GITHUB_URL} target="_blank" rel="noreferrer noopener">
          <FaGithub className="h-4 w-4" />
          View on GitHub
        </GitHubLink>
      </div>
      <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 font-mono text-xs text-muted-foreground">
        {PILLS.map((pill) => (
          <span key={pill.label} className="flex items-center gap-2">
            <span className={cn('h-1.5 w-1.5 rounded-full', pill.dot)} />
            {pill.label}
          </span>
        ))}
      </div>
    </div>

    <HeroMock />
  </section>
);

export default Hero;