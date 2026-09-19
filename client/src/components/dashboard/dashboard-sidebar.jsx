import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { OrganizationSwitcher, UserButton } from '@clerk/react';
import {
  LuLayoutDashboard,
  LuTicket,
  LuBell,
  LuSettings,
  LuChevronLeft,
  LuChevronRight,
} from 'react-icons/lu';
import Logo from '../logo';
import { cn } from '../../lib/utils';

const NAV_ITEMS = [
  { label: 'Dashboard', to: '/dashboard', icon: LuLayoutDashboard },
  { label: 'Tickets', to: '/dashboard/tickets', icon: LuTicket },
  { label: 'Notifications', to: '/dashboard/notifications', icon: LuBell },
  { label: 'Settings', to: '/dashboard/settings', icon: LuSettings },
];

const DashboardSidebar = () => {
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 768;
  });

  return (
    <aside
      className={cn(
        'flex h-screen shrink-0 flex-col border-r border-sidebar-border bg-[#f0f0f0] text-sidebar-foreground transition-[width] duration-300',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      <div className={cn('flex py-4', collapsed ? 'flex-col items-center gap-3' : 'items-center justify-between px-4')}>
        <div className={cn('flex items-center gap-2', collapsed && 'flex-col gap-3')}>
          <Logo className="h-8 w-auto shrink-0" />
          {!collapsed && <span className="truncate font-serif text-lg font-bold">tickiit</span>}
        </div>
        <button
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          className="rounded-md p-1.5 text-sidebar-foreground/70 transition-colors hover:bg-black/10 hover:text-foreground"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <LuChevronRight className="h-5 w-5" /> : <LuChevronLeft className="h-5 w-5" />}
        </button>
      </div>

      {!collapsed && (
        <div className="px-3">
          <OrganizationSwitcher
            createOrganizationMode="modal"
            appearance={{
              elements: {
                rootBox: 'block w-full',
                organizationSwitcherTrigger:
                  'flex min-h-10 w-full items-center justify-between gap-3 rounded-md border border-sidebar-border bg-background px-3 py-2.5 text-sm font-normal text-foreground shadow-sm transition-colors hover:bg-muted/50',
                organizationSwitcherTriggerIcon: 'ml-auto flex-none text-muted-foreground',
                'organizationPreview__organizationSwitcherTrigger': 'flex min-w-0 flex-1 items-center gap-2',
                'organizationPreviewTextContainer__organizationSwitcherTrigger':
                  'flex min-w-0 flex-1 flex-col items-start justify-center',
                'organizationPreviewAvatarContainer__organizationSwitcherTrigger': 'flex-none',
                'organizationPreviewName__organizationSwitcherTrigger': 'truncate text-sm font-medium',
              },
            }}
          />
        </div>
      )}

      <nav className={cn('flex flex-col gap-1 pt-6', collapsed ? 'px-2' : 'px-3')}>
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/dashboard'}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-sidebar-foreground/80 hover:bg-black/10 hover:text-foreground',
                collapsed && 'justify-center px-0'
              )
            }
          >
            <item.icon className="h-5 w-5 shrink-0" />
            {!collapsed && <span className="truncate">{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      <div className="flex-1" />

      <div className={cn('pb-4', collapsed ? 'px-2' : 'px-3')}>
        <div
          className={cn(
            'rounded-lg border-t border-sidebar-border pt-4',
            'flex',
            collapsed ? 'justify-center [&_.cl-userButtonTrigger]:w-10 [&_.cl-userButtonTrigger]:justify-center' : 'px-2'
          )}
        >
          <UserButton showName={!collapsed} />
        </div>
      </div>
    </aside>
  );
};

export default DashboardSidebar;