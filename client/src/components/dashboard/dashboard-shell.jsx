import { Outlet } from 'react-router-dom';
import { RedirectToSignIn, useAuth } from '@clerk/react';
import { Spinner } from '../ui';
import DashboardSidebar from './dashboard-sidebar';

const DashboardShell = () => {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return (
      <div className="flex h-[100dvh] overflow-hidden">
        <DashboardSidebar />
        <main className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
          <div role="status" className="flex h-full items-center justify-center gap-3">
            <Spinner />
            <span className="sr-only">Loading your workspace</span>
          </div>
        </main>
      </div>
    );
  }

  if (!isSignedIn) {
    return <RedirectToSignIn />;
  }

  return (
    <div className="flex h-[100dvh] overflow-hidden">
      <DashboardSidebar />
      <main className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
        <Outlet />
      </main>
    </div>
  );
};

export default DashboardShell;
