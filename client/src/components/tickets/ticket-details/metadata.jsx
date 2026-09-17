import { LuCalendar, LuChevronDown, LuUser } from 'react-icons/lu';
import { cn } from '../../../lib/utils';
import {
  PRIORITY_OPTIONS,
  TICKET_TYPE_OPTIONS,
  TICKET_STATUS_OPTIONS,
} from '../../../lib/constants';
import {
  STATUS_DOT,
  PRIORITY_DOT,
  TYPE_DOT,
  chipClasses,
  chevronClass,
} from './constants';
import {
  normalizeValue,
  getLabel,
  toDatetimeLocal,
  statusLabel,
  buildItems,
} from './utils';
import MenuSelect from './menu-select';
import Avatar from './avatar';

const MetadataChips = ({
  ticket,
  isAdmin,
  savingField,
  onSaveField,
  presentAssignee,
  assigneeOptions,
  dueText,
}) => {
  const statusValue = normalizeValue(ticket.status);
  const priorityValue = normalizeValue(ticket.priority);
  const typeValue = normalizeValue(ticket.type);

  const statusContent = (
    <>
      <span className={cn('h-2 w-2 shrink-0 rounded-full', STATUS_DOT[statusValue] || 'bg-muted')} />
      <span className="truncate font-medium">{statusLabel(statusValue)}</span>
      {isAdmin && <LuChevronDown className={chevronClass} />}
    </>
  );

  const priorityContent = (
    <>
      <span
        className={cn('h-2 w-2 shrink-0 rounded-full', PRIORITY_DOT[priorityValue] || 'bg-muted')}
      />
      <span className="truncate font-medium">{getLabel(PRIORITY_OPTIONS, priorityValue)}</span>
      {isAdmin && <LuChevronDown className={chevronClass} />}
    </>
  );

  const typeContent = (
    <>
      <span className={cn('h-2 w-2 shrink-0 rounded-full', TYPE_DOT[typeValue] || 'bg-muted')} />
      <span className="truncate font-medium">{getLabel(TICKET_TYPE_OPTIONS, typeValue)}</span>
      {isAdmin && <LuChevronDown className={chevronClass} />}
    </>
  );

  const assigneeContent = (
    <>
      {presentAssignee ? (
        <Avatar name={presentAssignee.name} className="h-5 w-5 text-[9px]" fallback="?" />
      ) : (
        <LuUser className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      )}
      <span
        className={cn(
          'truncate font-medium',
          presentAssignee ? 'text-foreground' : 'text-muted-foreground'
        )}
      >
        {presentAssignee?.displayName || 'Unassigned'}
      </span>
      {isAdmin && <LuChevronDown className={chevronClass} />}
    </>
  );

  const dueContent = (
    <>
      <LuCalendar className="h-3 w-3 shrink-0 text-muted-foreground" />
      <span className="truncate font-medium">{dueText}</span>
    </>
  );

  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1.5 px-6">
      {isAdmin ? (
        <MenuSelect
          value={statusValue}
          onChange={(next) => onSaveField('status', next)}
          ariaLabel="Status"
          disabled={savingField !== null}
          saving={savingField === 'status'}
          items={buildItems(TICKET_STATUS_OPTIONS, STATUS_DOT)}
        >
          {statusContent}
        </MenuSelect>
      ) : (
        <span className={chipClasses}>{statusContent}</span>
      )}

      {isAdmin ? (
        <MenuSelect
          value={priorityValue}
          onChange={(next) => onSaveField('priority', next)}
          ariaLabel="Priority"
          disabled={savingField !== null}
          saving={savingField === 'priority'}
          items={buildItems(PRIORITY_OPTIONS, PRIORITY_DOT)}
        >
          {priorityContent}
        </MenuSelect>
      ) : (
        <span className={chipClasses}>{priorityContent}</span>
      )}

      {(typeValue || isAdmin) &&
        (isAdmin ? (
          <MenuSelect
            value={typeValue}
            onChange={(next) => onSaveField('type', next)}
            ariaLabel="Type"
            disabled={savingField !== null}
            saving={savingField === 'type'}
            items={buildItems(TICKET_TYPE_OPTIONS, TYPE_DOT)}
          >
            {typeContent}
          </MenuSelect>
        ) : (
          <span className={chipClasses}>{typeContent}</span>
        ))}

      {isAdmin ? (
        <MenuSelect
          value={presentAssignee?.id || ''}
          onChange={(next) => onSaveField('assigneeId', next || null)}
          ariaLabel="Assignee"
          disabled={savingField !== null}
          saving={savingField === 'assigneeId'}
          items={[
            { value: '', label: 'Unassigned', icon: <LuUser className="h-3 w-3" /> },
            ...assigneeOptions.map((member) => ({
              value: member.id,
              label: member.name || member.id,
            })),
          ]}
        >
          {assigneeContent}
        </MenuSelect>
      ) : (
        <span className={chipClasses}>{assigneeContent}</span>
      )}

      {isAdmin ? (
        <input
          type="datetime-local"
          aria-label="Due date"
          value={toDatetimeLocal(ticket.dueAt)}
          onChange={(e) => onSaveField('dueAt', e.target.value || null)}
          disabled={savingField !== null}
          className="h-8 rounded-md border border-border bg-background px-2.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        />
      ) : (
        ticket.dueAt && <span className={chipClasses}>{dueContent}</span>
      )}
    </div>
  );
};

export default MetadataChips;