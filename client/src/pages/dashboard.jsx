import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, useOrganization } from '@clerk/react';
import { LuArrowRight, LuFlame, LuGauge, LuInbox, LuPlus, LuTicket, LuUserX } from 'react-icons/lu';
import { Button, EmptyState, Spinner } from '../components/ui';
import { useTickets } from '../hooks/use-tickets';
import { usePersonResolver } from '../lib/person-name';
import { normalizeValue } from '../components/tickets/ticket-details/utils';
import { PRIORITY_OPTIONS } from '../lib/constants';
import { cn } from '../lib/utils';
import StatCard from '../components/dashboard/stat-card';
import PriorityStrip from '../components/dashboard/priority-strip';
import AttentionList from '../components/dashboard/attention-list';
import CreateTicketModal from '../components/tickets/create-ticket-modal';

const priorityRank = { urgent: 0, high: 1, medium: 2, low: 3 };

const Dashboard = () => {
  const navigate = useNavigate();
  const { orgId, orgRole } = useAuth();
  const { organization } = useOrganization();
  const { tickets, setTickets, loading, error, refetch } = useTickets();
  const { resolvePerson } = usePersonResolver();
  const [showCreate, setShowCreate] = useState(false);

  const isAdmin = orgRole === 'admin' || orgRole === 'org:admin' || orgRole === 'owner';
  const showUnassigned = !!orgId && isAdmin;

  const allTickets = Object.values(tickets)
    .filter(Array.isArray)
    .flat()
    .filter(Boolean);

  const nowMs = Date.now();

  const isActive = (ticket) => {
    const status = normalizeValue(ticket.status);
    return status !== 'resolved' && status !== 'closed';
  };

  const hasAssignee = (ticket) => Boolean(ticket.group ?? ticket.assigneeId ?? ticket.assignee);

  const isOverdue = (ticket) => {
    const due = ticket.dueAt ? new Date(ticket.dueAt).getTime() : 0;
    return !!due && due < nowMs;
  };

  const activeTickets = allTickets.filter(isActive);

  const counts = { open: 0, 'in-progress': 0, urgent: 0 };
  activeTickets.forEach((ticket) => {
    const status = normalizeValue(ticket.status);
    if (status === 'open') counts.open += 1;
    if (status === 'in-progress') counts['in-progress'] += 1;
    if (normalizeValue(ticket.priority) === 'urgent') counts.urgent += 1;
  });

  const unassigned = showUnassigned ? activeTickets.filter((t) => !hasAssignee(t)).length : 0;

  const priorityCounts = {};
  PRIORITY_OPTIONS.forEach((option) => {
    priorityCounts[option.value] = activeTickets.filter(
      (ticket) => normalizeValue(ticket.priority) === option.value
    ).length;
  });

  const attentionTickets = activeTickets
    .filter((ticket) => {
      const priority = normalizeValue(ticket.priority);
      const unassignedTicket = !hasAssignee(ticket);
      return priority === 'urgent' || isOverdue(ticket) || (unassignedTicket && showUnassigned);
    })
    .sort((a, b) => {
      const key = (ticket) => {
        let score = 0;
        if (normalizeValue(ticket.priority) !== 'urgent') score += 2;
        if (!isOverdue(ticket)) score += 1;
        return score;
      };
      const byKey = key(a) - key(b);
      if (byKey !== 0) return byKey;
      const byPriority =
        (priorityRank[normalizeValue(a.priority)] ?? 9) - (priorityRank[normalizeValue(b.priority)] ?? 9);
      if (byPriority !== 0) return byPriority;
      return new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt);
    });

  const handleTicketCreated = (newTicket) => {
    setTickets((prev) => {
      const category = normalizeValue(newTicket.priority) || 'uncategorized';
      const group = Array.isArray(prev[category]) ? prev[category] : [];
      return { ...prev, [category]: [...group, newTicket] };
    });
  };

  const goToTickets = () => navigate('/dashboard/tickets');
  const openTicket = (id) => navigate(`/dashboard/tickets?ticketId=${id}`);

  const contextLine = orgId
    ? `Team queue for ${organization?.name ?? 'your organization'}`
    : 'Your personal ticket queue';

  return (
    <div className="mx-auto flex min-h-full w-full max-w-6xl flex-col gap-8 overflow-y-auto px-6 py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold tracking-tight text-foreground">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">{contextLine}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={goToTickets}>
            View all tickets
            <LuArrowRight className="h-4 w-4" />
          </Button>
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <LuPlus className="h-4 w-4" />
            New ticket
          </Button>
        </div>
      </header>

      {loading ? (
        <div className="flex flex-1 items-center justify-center py-24">
          <Spinner />
        </div>
      ) : error ? (
        <section className="flex flex-1 flex-col items-center justify-center gap-3 py-24 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <LuTicket className="h-5 w-5" />
          </div>
          <p className="text-sm font-semibold text-foreground">Could not load your tickets</p>
          <p className="text-sm text-muted-foreground">{error.message || 'Something went wrong. Try again.'}</p>
          <Button variant="outline" size="sm" onClick={refetch}>
            Retry
          </Button>
        </section>
      ) : allTickets.length === 0 ? (
        <section className="flex flex-1 items-center justify-center rounded-lg border border-border bg-card shadow-sm">
          <EmptyState
            icon={<LuTicket className="h-6 w-6" />}
            title="Welcome to your dashboard"
            description="Your support tickets will appear here once you create them. Create your first ticket to start tracking."
            action={
              <Button className="mt-4" onClick={() => setShowCreate(true)}>
                <LuPlus className="h-4 w-4" />
                Create ticket
              </Button>
            }
          />
        </section>
      ) : (
        <>
          <section aria-label="Current ticket load">
            <div
              className={cn(
                'grid grid-cols-1 gap-4 sm:grid-cols-2',
                showUnassigned ? 'lg:grid-cols-4' : 'lg:grid-cols-3'
              )}
            >
              <StatCard
                icon={LuInbox}
                label="Open"
                value={counts.open}
                caption="Waiting to be picked up"
                accent="bg-info/10 text-info"
                onClick={goToTickets}
              />
              <StatCard
                icon={LuGauge}
                label="In progress"
                value={counts['in-progress']}
                caption="Being worked right now"
                accent="bg-warning/10 text-warning"
                onClick={goToTickets}
              />
              <StatCard
                icon={LuFlame}
                label="Urgent"
                value={counts.urgent}
                caption="Needs eyes on it"
                accent="bg-destructive/10 text-destructive"
                onClick={goToTickets}
              />
              {showUnassigned && (
                <StatCard
                  icon={LuUserX}
                  label="Unassigned"
                  value={unassigned}
                  caption="Nobody owns them yet"
                  accent="bg-muted text-muted-foreground"
                  onClick={goToTickets}
                />
              )}
            </div>
          </section>

          <section aria-label="Queue by priority">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-serif text-lg font-bold text-foreground">Queue by priority</h2>
                <p className="text-sm text-muted-foreground">Active tickets in each priority band.</p>
              </div>
              <PriorityStrip counts={priorityCounts} onSelect={goToTickets} />
            </div>
          </section>

          <AttentionList
            tickets={attentionTickets}
            showUnassigned={showUnassigned}
            onSelect={openTicket}
            resolvePerson={resolvePerson}
          />
        </>
      )}

      <CreateTicketModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onTicketCreated={handleTicketCreated}
      />
    </div>
  );
};

export default Dashboard;