import { LuCalendar, LuLoader, LuMessageSquare, LuSend } from 'react-icons/lu';
import { Button, Textarea } from '../../ui';
import { formatTicketDate } from '../../../lib/format-date';
import Avatar from './avatar';

const CommentsSection = ({
  comments,
  loading,
  body,
  onBodyChange,
  isSubmitting,
  onSubmit,
  resolvePerson,
  userId,
  description,
  descriptionAuthorId,
  descriptionCreatedAt,
}) => {
  const getAuthor = (authorId) => {
    const resolved = resolvePerson(authorId) || authorId?.id || 'Unknown';
    return authorId === userId ? 'Me' : resolved;
  };

  const avatarName = (authorId) => resolvePerson(authorId) || authorId?.id || 'Unknown';

  const hasDescription = Boolean(description && String(description).trim());
  const totalCount = comments.length + (hasDescription ? 1 : 0);

  return (
    <section className="border-t border-border px-6 py-6">
      <div className="flex items-baseline justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <LuMessageSquare className="h-4 w-4 text-muted-foreground" />
          Comments
        </h3>
        <span className="text-xs text-muted-foreground">{totalCount} total</span>
      </div>

      

      <ul className="mt-5 space-y-4">
        {hasDescription && (
          <li key="ticket-description" className="flex gap-3">
            <Avatar name={avatarName(descriptionAuthorId)} className="h-8 w-8 text-xs" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="text-sm font-medium text-foreground">
                  {getAuthor(descriptionAuthorId)}
                </span>
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <LuCalendar className="h-3 w-3 shrink-0" />
                  {formatTicketDate(descriptionCreatedAt)}
                </span>
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary">
                  Description
                </span>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                {description}
              </p>
            </div>
          </li>
        )}
        {loading && comments.length === 0 ? (
          <li className="flex items-center gap-2 text-sm text-muted-foreground">
            <LuLoader className="h-4 w-4 animate-spin" />
            Loading comments...
          </li>
        ) : comments.length === 0 && !hasDescription ? (
          <p className="text-sm text-muted-foreground">
            No comments yet. Start the discussion.
          </p>
        ) : (
          comments.map((comment, index) => {
            const authorName = getAuthor(comment.authorId);
            return (
              <li key={comment.id || index} className="flex gap-3">
                <Avatar name={avatarName(comment.authorId)} className="h-8 w-8 text-xs" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span className="text-sm font-medium text-foreground">
                      {authorName}
                    </span>
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <LuCalendar className="h-3 w-3 shrink-0" />
                      {formatTicketDate(comment.createdAt)}
                    </span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                    {comment.body || comment.content || ''}
                  </p>
                </div>
              </li>
            );
          })
        )}
      </ul>
      
      <form onSubmit={onSubmit} className="mt-3 space-y-2">
        <Textarea
          id="comment-body"
          rows={3}
          value={body}
          onChange={(e) => onBodyChange(e.target.value)}
          placeholder="Write a comment..."
        />
        <div className="flex items-center justify-end">
          <Button size="sm" type="submit" loading={isSubmitting}>
            <LuSend className="h-4 w-4" />
            Post comment
          </Button>
        </div>
      </form>
    </section>
  );
};

export default CommentsSection;