import { Outlet } from 'react-router-dom';
import DashboardSidebar from './dashboard-sidebar';

const DashboardShell = () => {
  return (
    <div className="flex min-h-screen">
      <DashboardSidebar />
      <main className="min-w-0 flex-1">
        <Outlet />
      </main>
    </div>
  );
};

export default DashboardShell;
