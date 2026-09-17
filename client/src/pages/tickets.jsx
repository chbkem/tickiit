import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@clerk/react';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '../components/ui/resizable';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '../components/ui/drawer';
import TicketList from '../components/tickets/ticket-list';
import TicketDetails from '../components/tickets/ticket-details';
import CreateTicketModal from '../components/tickets/create-ticket-modal';
import useMediaQuery from '../hooks/use-media-query';
import { getAllTickets } from '../actions/get-all-tickets';
import { normalizeValue } from '../components/tickets/ticket-details/utils';

const Tickets = () => {
  const { getToken } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tickets, setTickets] = useState({});
  const [showCreateModal, setShowCreateModal] = useState(false);
  const isMobile = useMediaQuery('(max-width: 767px)');

  const activeTicketId = searchParams.get('ticketId');

  useEffect(() => {
    const fetchTickets = async () => {
      try {
        const token = await getToken();
        const data = await getAllTickets(token);
        setTickets(data);
      } catch (err) {
        console.error('Failed to fetch tickets:', err);
      }
    };
    fetchTickets();
  }, [getToken]);

  const handleTicketCreated = useCallback((newTicket) => {
    setTickets((prev) => {
      const category = normalizeValue(newTicket.priority) || 'uncategorized';
      const group = Array.isArray(prev[category]) ? prev[category] : [];
      return { ...prev, [category]: [...group, newTicket] };
    });
  }, []);

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
  }, []);

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
              onOpenCreate={() => setShowCreateModal(true)}
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
          onOpenCreate={() => setShowCreateModal(true)}
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
