import { Fragment, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@clerk/react';
import {
  Badge,
  Button,
  Checkbox,
  Input,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui';
import { LuClock, LuPlus, LuTicket } from 'react-icons/lu';
import { PRIORITY_OPTIONS, TICKET_TYPE_OPTIONS } from '../../lib/constants';
import { formatTicketDateTime } from '../../lib/format-date';
import { cn } from '../../lib/utils';
import { usePersonResolver } from '../../lib/person-name';
import { getLabel } from './ticket-details/utils';

const statusBadgeVariant = {
  open: 'info',
  'in-progress': 'warning',
  'on-hold': 'muted',
  resolved: 'success',
  closed: 'muted',
};

const CATEGORY_ORDER = { urgent: 0, high: 1, medium: 2, low: 3 };

const TicketList = ({ tickets, onOpenCreate }) => {
  const { orgId } = useAuth();
  const { resolvePerson } = usePersonResolver();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());

  const activeTicketId = searchParams.get('ticketId');

  const groupedTickets = useMemo(() => {
    const categories = Object.keys(tickets)
      .filter((key) => Array.isArray(tickets[key]))
      .sort((a, b) => {
        const rankA = CATEGORY_ORDER[a] ?? Number.MAX_SAFE_INTEGER;
        const rankB = CATEGORY_ORDER[b] ?? Number.MAX_SAFE_INTEGER;
        return rankA - rankB;
      });

    const query = search.trim().toLowerCase();
    return categories
      .map((key) => ({
        key,
        label: getLabel(PRIORITY_OPTIONS, key),
        tickets: tickets[key].filter((ticket) => {
          const matchesSearch =
            !query ||
            String(ticket.subject ?? '')
              .toLowerCase()
              .includes(query);
          const matchesType = !typeFilter || ticket.type === typeFilter;
          return matchesSearch && matchesType;
        }),
      }))
      .filter((group) => group.tickets.length > 0);
  }, [tickets, search, typeFilter]);

  const filteredIds = useMemo(
    () => groupedTickets.flatMap((group) => group.tickets.map((t) => t.id)),
    [groupedTickets]
  );

  const allSelected = filteredIds.length > 0 && filteredIds.every((id) => selectedIds.has(id));

  const handleSelectTicket = (ticketId) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('ticketId', ticketId);
      return next;
    });
  };

  const handleToggleSelect = (ticketId) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(ticketId)) {
        next.delete(ticketId);
      } else {
        next.add(ticketId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    setSelectedIds((prev) => {
      if (allSelected) {
        const next = new Set(prev);
        filteredIds.forEach((id) => next.delete(id));
        return next;
      }
      const next = new Set(prev);
      filteredIds.forEach((id) => next.add(id));
      return next;
    });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">Tickets</h2>
          <Button size="sm" onClick={onOpenCreate}>
            <LuPlus className="h-4 w-4" />
            New ticket
          </Button>
        </div>
        <div className="mt-3 flex gap-2">
          <Input
            id="search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by subject..."
            className="h-8 flex-1"
          />
          <Select
            id="type-filter"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="h-8 w-36"
          >
            <option value="">All types</option>
            {TICKET_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>
        {selectedIds.size > 0 && (
          <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
            <span>{selectedIds.size} selected</span>
            <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
              Clear selection
            </Button>
          </div>
        )}
      </div>
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {groupedTickets.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <LuTicket className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">
              {search || typeFilter
                ? 'No tickets match your search. Try adjusting the filters.'
                : 'No tickets yet. Create one to get started.'}
            </p>
          </div>
        ) : (
          <div className="w-full overflow-x-auto px-2">
            <Table className={orgId ? 'min-w-[960px] table-fixed' : 'min-w-[820px] table-fixed'}>
              <TableHeader className="sticky top-0 z-10">
                <TableRow className="bg-background hover:bg-background">
                  <TableHead className="w-10 pl-4">
                    <Checkbox
                      id="select-all"
                      checked={allSelected}
                      onChange={handleSelectAll}
                      aria-label="Select all tickets"
                    />
                  </TableHead>
                  <TableHead className="w-24">Status</TableHead>
                  <TableHead>ID</TableHead>
                  <TableHead>Subject</TableHead>
                  {orgId && <TableHead>Requester</TableHead>}
                  <TableHead>Assignee / Group</TableHead>
                  <TableHead>Last activity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groupedTickets.map((group) => (
                  <Fragment key={group.key}>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableCell
                        colSpan={orgId ? 7 : 6}
                        className="px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                      >
                        {group.label}
                        <span className="ml-2 rounded-full bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                          {group.tickets.length}
                        </span>
                      </TableCell>
                    </TableRow>
                    {group.tickets.map((ticket) => {
                      const active = activeTicketId === ticket.id;
                      const status = String(ticket.status ?? 'open').toLowerCase().replace(/[_\s]+/g, '-');
                      let assignee = null;
                      const groupValue = ticket?.group;
                      if (groupValue) {
                        assignee = { name: resolvePerson(groupValue), id: '', muted: false };
                      } else {
                        const assigneeValue = ticket?.assigneeId ?? ticket?.assignee;
                        if (assigneeValue) {
                          const id =
                            typeof assigneeValue === 'string'
                              ? assigneeValue
                              : assigneeValue.id || assigneeValue.userId || '';
                          assignee = { name: resolvePerson(assigneeValue), id, muted: false };
                        }
                      }
                      const requesterName = orgId
                        ? resolvePerson(
                            ticket.requesterId ?? ticket.requester ?? ticket.createdBy ?? ticket.creator ?? ticket.user
                          )
                        : '';
                      const mutedText = active ? 'text-background/70' : 'text-muted-foreground';
                      return (
                        <TableRow
                          key={ticket.id}
                          onClick={() => handleSelectTicket(ticket.id)}
                          className={cn(
                            'cursor-pointer',
                            active && 'bg-primary text-background hover:bg-primary'
                          )}
                        >
                          <TableCell className="pl-4">
                            <Checkbox
                              id={`select-${ticket.id}`}
                              checked={selectedIds.has(ticket.id)}
                              onClick={(e) => e.stopPropagation()}
                              onChange={() => handleToggleSelect(ticket.id)}
                              aria-label={`Select ticket ${ticket.ticketNumber}`}
                            />
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={statusBadgeVariant[status] || 'outline'}
                              className="text-[10px] font-mono uppercase"
                            >
                              {status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span
                              className="block truncate font-mono text-xs"
                              title={ticket.ticketNumber}
                            >
                              {ticket.ticketNumber}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="flex min-w-0 items-center gap-2">
                              <p className="truncate text-sm font-medium">
                                {ticket.subject}
                              </p>
                            </div>
                          </TableCell>
                          {orgId && (
                            <TableCell>
                              <span className="block truncate text-xs">{requesterName || 'Unknown'}</span>
                            </TableCell>
                          )}
                          <TableCell>
                            {assignee ? (
                              <span className="block truncate text-xs">
                                {assignee.name && assignee.name !== assignee.id
                                  ? assignee.name
                                  : `#${assignee.id}`}
                              </span>
                            ) : (
                              <span className={cn('block truncate text-xs', mutedText)}>Unassigned</span>
                            )}
                          </TableCell>
                          <TableCell className="pr-4">
                            <span className={cn('flex items-center gap-1.5 truncate text-xs', mutedText)}>
                              <LuClock className="h-3.5 w-3.5 shrink-0" />
                              {formatTicketDateTime(ticket.updatedAt || ticket.createdAt)}
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </Fragment>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
};

export default TicketList;
