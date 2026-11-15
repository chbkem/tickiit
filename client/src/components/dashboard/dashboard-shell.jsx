import { Outlet } from 'react-router-dom';
import DashboardSidebar from './dashboard-sidebar';

const DashboardShell = () => {
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
