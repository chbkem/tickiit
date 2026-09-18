import { useNavigate } from 'react-router-dom';
import { useAuth, useClerk } from '@clerk/react';
import Header from '../components/landing/navbar';
import Hero from '../components/landing/hero';
import AiTriage from '../components/landing/ai-triage';
import Workflow from '../components/landing/workflow';
import Features from '../components/landing/features';
import OpenSource from '../components/landing/open-source';
import FinalCta from '../components/landing/final-cta';
import Footer from '../components/landing/footer';
import { SIGN_IN_REDIRECT } from '../components/landing/constants';

const Landing = () => {
  const { openSignIn, openSignUp } = useClerk();
  const signInOptions = { redirectUrl: SIGN_IN_REDIRECT };
  const { isLoaded, isSignedIn } = useAuth();
  const navigate = useNavigate();

  const handlePrimaryAction = () => {
    if (isSignedIn) {
      navigate('/dashboard');
    } else {
      openSignUp(signInOptions);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header
        isLoaded={isLoaded}
        isSignedIn={isSignedIn}
        onSignIn={() => openSignIn(signInOptions)}
        onPrimaryAction={handlePrimaryAction}
        onDashboard={() => navigate('/dashboard')}
      />
      <main>
        <Hero isLoaded={isLoaded} isSignedIn={isSignedIn} onPrimaryAction={handlePrimaryAction} />
        <AiTriage />
        <Workflow />
        <Features />
        <OpenSource />
        <FinalCta isLoaded={isLoaded} isSignedIn={isSignedIn} onPrimaryAction={handlePrimaryAction} />
      </main>
      <Footer />
    </div>
  );
};

export default Landing;