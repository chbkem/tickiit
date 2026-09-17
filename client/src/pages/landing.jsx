import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth, useClerk, UserButton } from '@clerk/react';
import { LuHeadphones, LuZap, LuBarChart3, LuShield, LuMenu, LuX } from 'react-icons/lu';
import Logo from '../components/logo';
import { Button, Card, Badge } from '../components/ui';

const FEATURES = [
  {
    icon: <LuHeadphones className="h-6 w-6" />,
    title: 'Assign & track tickets',
    description:
      'Create, assign, and follow every support request from a single, organised dashboard your whole team can see.',
  },
  {
    icon: <LuZap className="h-6 w-6" />,
    title: 'Resolve faster',
    description:
      'Prioritise what matters and move high-impact issues to the front of the queue with clear statuses and triage.',
  },
  {
    icon: <LuBarChart3 className="h-6 w-6" />,
    title: 'Know your workload',
    description:
      'A clear overview of categories, priorities, and statuses so nothing slips through the cracks.',
  },
  {
    icon: <LuShield className="h-6 w-6" />,
    title: 'Secure by default',
    description:
      'Every account is protected with secure, passwordless-first authentication built into the platform.',
  },
];

const STEPS = [
  { title: 'Create an account', description: 'Sign up in seconds — no lengthy onboarding.' },
  { title: 'Raise or assign a ticket', description: 'Add context, pick a category, and set priority.' },
  { title: 'Track it to done', description: 'Update status and keep everyone in the loop.' },
];

const Landing = () => {
  const { openSignIn, openSignUp } = useClerk();
  const signInOptions = { redirectUrl: '/dashboard' };
  const { isLoaded, isSignedIn } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handlePrimaryAction = () => {
    if (isSignedIn) {
      navigate('/dashboard');
    } else {
      openSignUp(signInOptions);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2">
            <Logo className="h-9 w-auto" />
            <span className="font-serif text-xl font-bold tracking-tight">tickiit</span>
          </Link>

          <nav className="hidden items-center gap-8 md:flex">
            <Link href="#features" className="text-sm font-medium text-foreground/80 hover:text-foreground">
              Features
            </Link>
            <Link href="#how-it-works" className="text-sm font-medium text-foreground/80 hover:text-foreground">
              How it works
            </Link>
            <Link href="#pricing" className="text-sm font-medium text-foreground/80 hover:text-foreground">
              Pricing
            </Link>
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            {isSignedIn ? (
              <div className="flex items-center gap-3">
                <Button variant="outline" onClick={() => navigate('/dashboard')}>
                  Dashboard
                </Button>
                <UserButton />
              </div>
            ) : (
              <>
                <Button variant="ghost" loading={!isLoaded} onClick={() => openSignIn(signInOptions)}>
                  Sign in
                </Button>
                <Button loading={!isLoaded} onClick={() => openSignUp(signInOptions)}>
                  Sign up
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
              <Link href="#features" onClick={() => setMobileMenuOpen(false)} className="text-sm font-medium">
                Features
              </Link>
              <Link href="#how-it-works" onClick={() => setMobileMenuOpen(false)} className="text-sm font-medium">
                How it works
              </Link>
              <Link href="#pricing" onClick={() => setMobileMenuOpen(false)} className="text-sm font-medium">
                Pricing
              </Link>
              <div className="flex flex-col gap-3 pt-2">
                {isSignedIn ? (
                  <div className="flex items-center gap-3">
                    <Button variant="outline" onClick={() => navigate('/dashboard')}>
                      Dashboard
                    </Button>
                    <UserButton />
                  </div>
                ) : (
                  <>
                    <Button variant="ghost" loading={!isLoaded} onClick={() => openSignIn(signInOptions)}>
                      Sign in
                    </Button>
                    <Button loading={!isLoaded} onClick={() => openSignUp(signInOptions)}>
                      Sign up
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-4 pb-16 pt-20 sm:px-6 sm:pt-28">
          <div className="mx-auto max-w-3xl text-center">
            <Badge variant="default" className="mb-6">
              Modern support, beautifully simple
            </Badge>
            <h1 className="font-sans text-4xl font-bold leading-tight tracking-tight sm:text-6xl">
              Support tickets,
              <span className="text-primary"> sorted.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
              tickiit is the friendly ticketing platform that helps your team capture, assign, and close every
              support request — without the clutter.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button size="lg" loading={!isLoaded} onClick={handlePrimaryAction}>
                {isSignedIn ? 'Go to dashboard' : 'Get started free'}
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
              >
                Explore features
              </Button>
            </div>
          </div>
        </section>

        <section id="features" className="border-y border-border bg-card/40">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <div className="mx-auto mb-12 max-w-2xl text-center">
              <h2 className="font-sans text-3xl font-bold tracking-tight sm:text-4xl">Everything you need to stay on top</h2>
              <p className="mt-4 text-muted-foreground">
                Built to keep your support workflow clear, collaborative, and under control.
              </p>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {FEATURES.map((feature) => (
                <Card key={feature.title} className="p-6">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    {feature.icon}
                  </div>
                  <h3 className="mb-2 font-sans text-base font-semibold">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section id="how-it-works" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <h2 className="font-sans text-3xl font-bold tracking-tight sm:text-4xl">Up and running in minutes</h2>
            <p className="mt-4 text-muted-foreground">A simple flow your whole team can pick up right away.</p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {STEPS.map((step, index) => (
              <Card key={step.title} className="p-6 text-center">
                <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                  {index + 1}
                </div>
                <h3 className="mb-2 font-sans text-base font-semibold">{step.title}</h3>
                <p className="text-sm text-muted-foreground">{step.description}</p>
              </Card>
            ))}
          </div>
        </section>

        <section id="pricing" className="border-y border-border bg-card/40">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <div className="mx-auto mb-12 max-w-2xl text-center">
              <h2 className="font-sans text-3xl font-bold tracking-tight sm:text-4xl">Simple, transparent pricing</h2>
              <p className="mt-4 text-muted-foreground">Start free, upgrade when your team grows.</p>
            </div>
            <div className="mx-auto max-w-md">
              <Card className="p-8 text-center">
                <span className="text-sm font-medium text-muted-foreground">Everything plan</span>
                <div className="mt-4 font-sans text-5xl font-bold tracking-tight">
                  $0<span className="text-lg font-normal text-muted-foreground">/mo</span>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">
                  All the essentials to get your support flow running today. No credit card required.
                </p>
                <Button size="lg" className="mt-6 w-full" loading={!isLoaded} onClick={handlePrimaryAction}>
                  {isSignedIn ? 'Go to dashboard' : 'Start for free'}
                </Button>
              </Card>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row sm:px-6">
          <div className="flex items-center gap-2">
            <Logo className="h-8 w-auto" />
            <span className="font-serif text-lg font-bold tracking-tight">tickiit</span>
          </div>
          <p className="text-sm text-muted-foreground">© {new Date().getFullYear()} tickiit. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;