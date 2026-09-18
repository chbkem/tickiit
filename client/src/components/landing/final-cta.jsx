import { FaGithub } from 'react-icons/fa';
import { Button } from '../ui';
import { GITHUB_URL } from './constants';
import { GitHubLink } from './primitives';

const FinalCta = ({ isLoaded, isSignedIn, onPrimaryAction }) => (
  <section className="border-t border-border bg-card/40">
    <div className="mx-auto max-w-3xl px-4 py-24 text-center sm:px-6">
      <h2 className="font-serif text-3xl font-semibold leading-tight tracking-tight text-foreground sm:text-5xl">
        Support tickets, without the support-suite bloat.
      </h2>
      <p className="mx-auto mt-5 max-w-xl text-muted-foreground">
        Self-hosted, open source, and free. One focused workspace for capture, triage, assignment, and resolution.
      </p>
      <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <Button size="lg" loading={!isLoaded} onClick={onPrimaryAction}>
          {isSignedIn ? 'Go to dashboard' : 'Get started'}
        </Button>
        <GitHubLink href={GITHUB_URL} target="_blank" rel="noreferrer noopener">
          <FaGithub className="h-4 w-4" />
          Star on GitHub
        </GitHubLink>
      </div>
    </div>
  </section>
);

export default FinalCta;