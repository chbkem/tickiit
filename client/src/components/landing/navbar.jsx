import { useState } from 'react';
import { Link } from 'react-router-dom';
import { UserButton } from '@clerk/react';
import { LuMenu, LuX } from 'react-icons/lu';
import Logo from '../logo';
import { Button } from '../ui';
import { GITHUB_URL } from './constants';

const NAV_LINKS = [
  { label: 'Features', href: '#features' },
  { label: 'AI triage', href: '#ai-triage' },
  { label: 'How it works', href: '#how-it-works' },
];

const Header = ({ isLoaded, isSignedIn, onSignIn, onPrimaryAction, onDashboard }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2">
          <Logo className="h-9 w-auto" />
          <span className="font-serif text-xl font-bold tracking-tight">tickiit</span>
        </Link>

        <nav className="hidden items-center gap-7 md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-foreground/80 transition-colors hover:text-foreground"
            >
              {link.label}
            </a>
          ))}
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer noopener"
            className="text-sm font-medium text-foreground/80 transition-colors hover:text-foreground"
          >
            GitHub
          </a>
        </nav>

        <div className="hidden items-center gap-2.5 md:flex">
          {isSignedIn ? (
            <>
              <Button variant="outline" onClick={onDashboard}>
                Dashboard
              </Button>
              <UserButton />
            </>
          ) : (
            <>
              <Button loading={!isLoaded} variant="ghost" onClick={onSignIn}>
                Sign in
              </Button>
              <Button loading={!isLoaded} onClick={onPrimaryAction}>
                Get started
              </Button>
            </>
          )}
        </div>

        <button
          type="button"
          className="rounded-md p-2 text-foreground md:hidden"
          aria-label="Toggle menu"
          onClick={() => setMobileMenuOpen((v) => !v)}
        >
          {mobileMenuOpen ? <LuX className="h-5 w-5" /> : <LuMenu className="h-5 w-5" />}
        </button>
      </div>

      {mobileMenuOpen && (
        <div className="border-t border-border bg-background px-4 py-4 md:hidden">
          <div className="flex flex-col gap-4">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-foreground/80"
                onClick={() => setMobileMenuOpen(false)}
              >
                {link.label}
              </a>
            ))}
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer noopener"
              className="text-sm font-medium text-foreground/80"
              onClick={() => setMobileMenuOpen(false)}
            >
              GitHub
            </a>
            <div className="flex flex-col gap-2.5 border-t border-border pt-4">
              {isSignedIn ? (
                <div className="flex items-center gap-3">
                  <Button variant="outline" onClick={onDashboard}>
                    Dashboard
                  </Button>
                  <UserButton />
                </div>
              ) : (
                <>
                  <Button loading={!isLoaded} variant="ghost" onClick={onSignIn}>
                    Sign in
                  </Button>
                  <Button loading={!isLoaded} onClick={onPrimaryAction}>
                    Get started
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;