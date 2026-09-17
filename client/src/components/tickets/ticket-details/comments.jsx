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
}) => {
  const getAuthor = (authorId) => {
    const resolved = resolvePerson(authorId) || authorId?.id || 'Unknown';
    return authorId === userId ? 'Me' : resolved;
  };

  const avatarName = (authorId) => resolvePerson(authorId) || authorId?.id || 'Unknown';

  return (
    <section className="border-t border-border px-6 py-6">
      <div className="flex items-baseline justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <LuMessageSquare className="h-4 w-4 text-muted-foreground" />
          Comments
        </h3>
        <span className="text-xs text-muted-foreground">{comments.length} total</span>
      </div>

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

      <ul className="mt-5 space-y-4">
        {loading && comments.length === 0 ? (
          <li className="flex items-center gap-2 text-sm text-muted-foreground">
            <LuLoader className="h-4 w-4 animate-spin" />
            Loading comments...
          </li>
        ) : comments.length === 0 ? (
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
    </section>
  );
};

export default CommentsSection;