import { LuSave } from 'react-icons/lu';
import { Button, Input, Textarea } from '../../ui';
import { cn } from '../../../lib/utils';

const DescriptionSection = ({
  ticket,
  editing,
  draft,
  onDraftChange,
  onCancelEdit,
  onSave,
  isSavingDraft,
}) => (
  <section className="px-6 pb-6 pt-5">
    {editing ? (
      <div className="space-y-3">
        <Input
          id="edit-subject"
          label="Subject"
          value={draft.subject}
          onChange={(e) => onDraftChange('subject', e.target.value)}
        />
        <Textarea
          id="edit-description"
          label="Description"
          rows={4}
          value={draft.description}
          onChange={(e) => onDraftChange('description', e.target.value)}
        />
        <div className="flex items-center justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={onCancelEdit}>
            Cancel
          </Button>
          <Button size="sm" onClick={onSave} loading={isSavingDraft}>
            <LuSave className="h-4 w-4" />
            Save changes
          </Button>
        </div>
      </div>
    ) : (
      <p
        className={cn(
          'whitespace-pre-wrap text-sm leading-relaxed',
          ticket.description ? 'text-foreground' : 'text-muted-foreground'
        )}
      >
        {ticket.description || 'No description provided for this ticket.'}
      </p>
    )}
  </section>
);

export default DescriptionSection;