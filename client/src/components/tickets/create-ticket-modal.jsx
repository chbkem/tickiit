import { useRef, useState } from 'react';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { OrganizationSwitcher, useAuth } from '@clerk/react';
import { createTicket } from '../../actions/create-ticket';
import { PRIORITY_OPTIONS, TICKET_TYPE_OPTIONS } from '../../lib/constants';
import { Button, Input, Label, Select, Textarea } from '../ui';
import Modal from '../ui/modal';

const ticketSchema = z.object({
  subject: z.string().min(1, 'Subject is required'),
  description: z.string().min(1, 'Description is required'),
  priority: z.string().min(1, 'Priority is required'),
  type: z.string().min(1, 'Type is required'),
  dueAt: z.string().optional(),
});

const CreateTicketModal = ({ open, onClose, onTicketCreated }) => {
  const { getToken, userId, orgId } = useAuth();
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [type, setType] = useState('task');
  const [dueAt, setDueAt] = useState('');
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const formRef = useRef(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const values = { subject, description, priority, type, dueAt };
    const result = ticketSchema.safeParse(values);
    if (!result.success) {
      const fieldErrors = {};
      result.error.issues.forEach((issue) => {
        fieldErrors[issue.path[0]] = issue.message;
      });
      setErrors(fieldErrors);
      return;
    }
    setIsSubmitting(true);
    try {
      const token = await getToken();
      const createdTicket = await createTicket(
        {
          ...result.data,
          ...(orgId ? { orgId } : {}),
          ...(orgId ? {} : { assigneeId: userId }),
        },
        token
      );
      onTicketCreated(createdTicket);
      toast.success('Ticket created successfully');
      setSubject('');
      setDescription('');
      setPriority('');
      setType('');
      setDueAt('');
      setErrors({});
      onClose();
    } catch (err) {
      toast.error(err.message || 'Failed to create ticket');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create a new ticket"
      description="Fill in the details below to open a support ticket."
      size="lg"
    >
      <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label>Organization (optional)</Label>
          <OrganizationSwitcher
            hidePersonal
            createOrganizationMode="modal"
            appearance={{
              elements: {
                rootBox: 'block w-full',
                organizationSwitcherTrigger:
                  'flex min-h-10 w-full items-center justify-between gap-3 rounded-md border border-input bg-background px-3 py-2.5 text-sm font-normal text-foreground shadow-sm transition-colors',
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
        <Input
          id="subject"
          label="Subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="e.g. Email not received"
          error={errors.subject}
          required
        />
        <Textarea
          id="description"
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe the issue in detail"
          error={errors.description}
          required
        />
        <div className="grid grid-cols-2 gap-4">
          <Select
            id="priority"
            label="Priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            error={errors.priority}
          >
            {PRIORITY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
          <Select
            id="type"
            label="Type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            error={errors.type}
          >
            {TICKET_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>
        <Input
          id="dueAt"
          label="Due date (optional)"
          type="datetime-local"
          value={dueAt}
          onChange={(e) => setDueAt(e.target.value)}
          error={errors.dueAt}
        />
        <div className="flex items-center justify-end gap-2 pt-2">
          <Button variant="ghost" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Creating...' : 'Create ticket'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default CreateTicketModal;
