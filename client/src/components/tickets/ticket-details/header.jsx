import { LuCalendar, LuPencil, LuX } from 'react-icons/lu';
import { Button } from '../../ui';
import { formatTicketDate } from '../../../lib/format-date';

const Header = ({
  subject,
  editing,
  isAdmin,
  onToggleEdit,
  onClose,
  createdAt,
  creatorName,
  ticketId,
  idLabel,
}) => (
  <header className="px-6 pt-5">
    <div className="flex items-start justify-between gap-4">
      <h2 className="min-w-0 font-serif text-xl font-semibold leading-snug tracking-tight text-foreground">
        {subject || 'Untitled ticket'}
      </h2>
      <div className="flex shrink-0 items-center gap-1">
        {isAdmin && (
          <Button
            size="sm"
            variant="ghost"
            className="h-8 px-2.5"
            onClick={onToggleEdit}
          >
            {editing ? <LuX className="h-4 w-4" /> : <LuPencil className="h-4 w-4" />}
            <span className="hidden md:inline">{editing ? 'Cancel' : 'Edit'}</span>
          </Button>
        )}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close ticket details"
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <LuX className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
    <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
      <LuCalendar className="h-3.5 w-3.5 shrink-0" />
      <span>Opened {formatTicketDate(createdAt)}</span>
      {creatorName ? ` by ${creatorName}` : ''}
      <span className="ml-2 font-mono text-[11px] text-muted-foreground/60" title={ticketId}>
        {idLabel}
      </span>
    </p>
  </header>
);

export default Header;