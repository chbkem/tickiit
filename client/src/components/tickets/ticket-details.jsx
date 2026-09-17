import { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '@clerk/react';
import { LuTicket } from 'react-icons/lu';
import { getTicketComments } from '../../actions/get-ticket-comments';
import { addComment } from '../../actions/add-comment';
import { updateTicket } from '../../actions/update-ticket';
import { formatTicketDate } from '../../lib/format-date';
import { EmptyState, Tabs, TabsList, TabsTrigger, TabsContent } from '../ui';
import { usePersonResolver } from '../../lib/person-name';
import Header from './ticket-details/header';
import MetadataChips from './ticket-details/metadata';
import DescriptionSection from './ticket-details/description';
import CommentsSection from './ticket-details/comments';

const TicketDetails = ({ ticket, onTicketUpdated, onClose }) => {
  const { getToken, userId, orgId, orgRole } = useAuth();
  const { resolvePerson, orgMembers } = usePersonResolver();
  const [comments, setComments] = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentBody, setCommentBody] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [savingField, setSavingField] = useState(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ subject: '', description: '' });
  const [isSavingDraft, setIsSavingDraft] = useState(false);

  const ticketId = ticket?.id;
  const latestTicketRef = useRef(ticket);
  latestTicketRef.current = ticket;

  const isAdmin =
    !orgId || orgRole === 'admin' || orgRole === 'org:admin' || orgRole === 'owner';

  useEffect(() => {
    setDraft({ subject: ticket?.subject, description: ticket?.description });
    setEditing(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId]);

  useEffect(() => {
    let cancelled = false;
    setComments([]);
    setCommentsLoading(!!ticketId);
    if (!ticketId) {
      setCommentsLoading(false);
      return undefined;
    }
    (async () => {
      try {
        const token = await getToken();
        const list = await getTicketComments(ticketId, token);
        if (!cancelled) {
          setComments(Array.isArray(list) ? list : []);
        }
      } catch {
        if (!cancelled) {
          const embedded = Array.isArray(latestTicketRef.current?.comments)
            ? latestTicketRef.current.comments
            : [];
          setComments(embedded);
        }
      } finally {
        if (!cancelled) setCommentsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId, getToken]);

  const presentAssignee = useMemo(() => {
    const assignee = ticket?.assigneeId;
    if (!assignee) return null;
    const id = assignee;
    const name = resolvePerson(assignee) || id || '';
    const isMe = id === userId;
    return { id, name, isMe, displayName: isMe ? 'Me' : name };
  }, [ticket, resolvePerson, userId]);

  const assigneeOptions = useMemo(() => {
    const byId = new Map();
    orgMembers.forEach((member) => byId.set(member.id, member.name));
    if (userId) byId.set(userId, 'Me');
    if (presentAssignee?.id && presentAssignee.name) {
      byId.set(presentAssignee.id, presentAssignee.isMe ? 'Me' : presentAssignee.name);
    }
    return [...byId.entries()].map(([id, name]) => ({ id, name }));
  }, [orgMembers, userId, presentAssignee]);

  const handleMetadataUpdate = async (field, value) => {
    if (!ticket) return;
    setSavingField(field);
    try {
      const token = await getToken();
      const res = await updateTicket(ticket.id, { [field]: value }, token);
      const updated = res?.ticket || res;
      const next =
        updated && typeof updated === 'object' && updated.id
          ? updated
          : { ...ticket, [field]: value };
      onTicketUpdated?.(next);
      toast.success('Ticket updated');
    } catch (err) {
      toast.error(err.message || 'Failed to update ticket');
    } finally {
      setSavingField(null);
    }
  };

  const handleSaveDraft = async () => {
    if (!ticket) return;
    setIsSavingDraft(true);
    try {
      const token = await getToken();
      const res = await updateTicket(
        ticket.id,
        { subject: draft.subject, description: draft.description },
        token
      );
      const updated = res?.ticket || res;
      const next =
        updated && typeof updated === 'object' && updated.id
          ? updated
          : { ...ticket, subject: draft.subject, description: draft.description };
      setEditing(false);
      onTicketUpdated?.(next);
      toast.success('Ticket updated');
    } catch (err) {
      toast.error(err.message || 'Failed to update ticket');
    } finally {
      setIsSavingDraft(false);
    }
  };

  const handleAddComment = async (event) => {
    event.preventDefault();
    const body = commentBody.trim();
    if (!body) return;
    setIsSubmittingComment(true);
    try {
      const token = await getToken();
      const created = await addComment(ticket.id, { body }, token);
      setComments((prev) => [...prev, created]);
      setCommentBody('');
      toast.success('Comment added');
    } catch (err) {
      toast.error(err.message || 'Failed to add comment');
    } finally {
      setIsSubmittingComment(false);
    }
  };

  if (!ticket) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8">
        <EmptyState
          icon={<LuTicket className="h-5 w-5" />}
          title="Nothing selected"
          description="Pick a ticket from the list to open it here."
        />
      </div>
    );
  }

  const rawId = String(ticket.ticketNumber ?? ticket.id ?? '').trim();
  const idLabel = `${rawId.length > 16 ? `${rawId.slice(0, 8)}…` : rawId}`;

  return (
    <div className="flex h-full flex-col w-full">
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="flex min-h-full flex-col">
          <Header
            subject={ticket.subject}
            editing={editing}
            isAdmin={isAdmin}
            onToggleEdit={() => setEditing((value) => !value)}
            onClose={onClose}
            createdAt={ticket.createdAt}
            creatorName={resolvePerson(ticket.requesterId)}
            ticketId={ticket.id}
            idLabel={idLabel}
          />
          <MetadataChips
            ticket={ticket}
            isAdmin={isAdmin}
            savingField={savingField}
            onSaveField={handleMetadataUpdate}
            presentAssignee={presentAssignee}
            assigneeOptions={assigneeOptions}
            dueText={ticket.dueAt ? formatTicketDate(ticket.dueAt) : 'No due date'}
          />
          <Tabs defaultValue="details" className="flex flex-col flex-1">
            <TabsList variant="line" className="border-b border-border px-4" style={{ '--tabs-indicator-color': 'hsl(var(--primary))' }}>
              <TabsTrigger value="details" className="px-3 py-2">
                Details
              </TabsTrigger>
              <TabsTrigger value="conversation" className="px-3 py-2">
                Conversation
              </TabsTrigger>
            </TabsList>
            <TabsContent value="details" className="flex-1 p-0">
              <DescriptionSection
                ticket={ticket}
                editing={editing}
                draft={draft}
                onDraftChange={(field, value) => setDraft((prev) => ({ ...prev, [field]: value }))}
                onCancelEdit={() => setEditing(false)}
                onSave={handleSaveDraft}
                isSavingDraft={isSavingDraft}
              />
            </TabsContent>
            <TabsContent value="conversation" className="flex-1 p-0">
              <CommentsSection
                comments={comments}
                loading={commentsLoading}
                body={commentBody}
                onBodyChange={setCommentBody}
                isSubmitting={isSubmittingComment}
                onSubmit={handleAddComment}
                resolvePerson={resolvePerson}
                userId={userId}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default TicketDetails;