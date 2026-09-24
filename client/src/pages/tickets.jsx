import { useState, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '../components/ui/resizable';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '../components/ui/drawer';
import TicketList from '../components/tickets/ticket-list';
import TicketDetails from '../components/tickets/ticket-details';
import CreateTicketModal from '../components/tickets/create-ticket-modal';
import useMediaQuery from '../hooks/use-media-query';
import { useTickets } from '../hooks/use-tickets';
import { normalizeValue } from '../components/tickets/ticket-details/utils';

const Tickets = () => {
  const { tickets, setTickets, loading, error, refetch } = useTickets();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const isMobile = useMediaQuery('(max-width: 767px)');

  const activeTicketId = searchParams.get('ticketId');

  const handleTicketCreated = useCallback((newTicket) => {
    setTickets((prev) => {
      const category = normalizeValue(newTicket.priority) || 'uncategorized';
      const group = Array.isArray(prev[category]) ? prev[category] : [];
      return { ...prev, [category]: [...group, newTicket] };
    });
  }, [setTickets]);

  const handleTicketUpdated = useCallback((updatedTicket) => {
    setTickets((prev) => {
      const category = normalizeValue(updatedTicket.priority) || 'uncategorized';
      const next = {};
      for (const [key, group] of Object.entries(prev)) {
        next[key] = Array.isArray(group) ? group.filter((t) => t.id !== updatedTicket.id) : group;
      }
      next[category] = [...(Array.isArray(next[category]) ? next[category] : []), updatedTicket];
      return next;
    });
  }, [setTickets]);

  const handleTicketDeleted = useCallback(
    (ticketId) => {
      setTickets((prev) => {
        const next = {};
        for (const [key, group] of Object.entries(prev)) {
          next[key] = Array.isArray(group) ? group.filter((t) => t.id !== ticketId) : group;
        }
        return next;
      });
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (next.get('ticketId') === ticketId) {
          next.delete('ticketId');
        }
        return next;
      });
    },
    [setSearchParams, setTickets]
  );

  const handleCloseDetails = useCallback(() => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('ticketId');
      return next;
    });
  }, [setSearchParams]);

  const activeTicket = useMemo(() => {
    if (!activeTicketId) return null;
    for (const group of Object.values(tickets)) {
      if (!Array.isArray(group)) continue;
      const found = group.find((ticket) => ticket.id === activeTicketId);
      if (found) return found;
    }
    return null;
  }, [tickets, activeTicketId]);

  return (
    <div className="h-[calc(100vh-3rem)]">
      <div className="hidden h-full md:flex">
        <ResizablePanelGroup
          direction="horizontal"
          className="min-w-0 h-full"
        >
          <ResizablePanel
            id="list-panel"
            defaultSize="35"
            minSize="20"
            maxSize="65"
            className="overflow-hidden"
          >
            <TicketList
              tickets={tickets}
              loading={loading}
              error={error}
              onRetry={refetch}
              onOpenCreate={() => setShowCreateModal(true)}
              onTicketDeleted={handleTicketDeleted}
            />
          </ResizablePanel>
          {activeTicket && (
            <>
              <ResizableHandle />
              <ResizablePanel
                id="details-panel"
                defaultSize="50"
                minSize="30"
                maxSize="50"
                className="overflow-hidden"
              >
                <TicketDetails
                  ticket={activeTicket}
                  onTicketUpdated={handleTicketUpdated}
                  onTicketDeleted={handleTicketDeleted}
                  onClose={handleCloseDetails}
                />
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>
      </div>

      <div className="flex h-full flex-col md:hidden">
        <TicketList
          tickets={tickets}
          loading={loading}
          error={error}
          onRetry={refetch}
          onOpenCreate={() => setShowCreateModal(true)}
          onTicketDeleted={handleTicketDeleted}
        />
        {isMobile && (
          <Drawer open={!!activeTicket} onOpenChange={(open) => !open && setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            next.delete('ticketId');
            return next;
          })}>
            <DrawerContent className="[--drawer-height:calc(100dvh-4rem)]">
              <DrawerHeader>
                <DrawerTitle>Details</DrawerTitle>
              </DrawerHeader>
              <TicketDetails
                ticket={activeTicket}
                onTicketUpdated={handleTicketUpdated}
                onTicketDeleted={handleTicketDeleted}
                onClose={handleCloseDetails}
              />
            </DrawerContent>
          </Drawer>
        )}
      </div>

      <CreateTicketModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onTicketCreated={handleTicketCreated}
      />
    </div>
  );
};

export default Tickets;
