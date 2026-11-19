import { useState } from 'react';
import { z } from 'zod';
import { LuCheckCircle, LuLock, LuSend } from 'react-icons/lu';
import { Button, Card, CardContent, CardHeader, Textarea } from '../ui';
import { friendlyError } from '../../lib/error-message';

const replySchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, 'Please write your reply before sending.')
    .max(5000, 'Your reply must be 5000 characters or fewer.'),
});

const CustomerReplyForm = ({ onSubmit, submitting, error, closed }) => {
  const [body, setBody] = useState('');
  const [validationError, setValidationError] = useState('');
  const [sent, setSent] = useState(false);

  if (closed) {
    return (
      <Card className="mt-4">
        <CardContent className="flex items-center gap-3 py-5 text-sm text-muted-foreground">
          <LuLock className="h-4 w-4 shrink-0" />
          This ticket is closed. Reply to your email thread if you need more help.
        </CardContent>
      </Card>
    );
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    setValidationError('');
    setSent(false);

    const parsed = replySchema.safeParse({ body });
    if (!parsed.success) {
      setValidationError(parsed.error.issues[0].message);
      return;
    }

    const ok = await onSubmit(parsed.data.body);
    if (ok) {
      setBody('');
      setSent(true);
    }
  };

  return (
    <Card className="mt-4">
      <CardHeader className="space-y-1">
        <h2 className="text-sm font-semibold text-foreground">Add a reply</h2>
        <p className="text-xs text-muted-foreground">
          Tell us anything else that might help. Your reply goes straight to the team.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-3" noValidate>
          <Textarea
            id="customer-reply-body"
            label="Your reply"
            rows={5}
            maxLength={5000}
            value={body}
            onChange={(event) => {
              setBody(event.target.value);
              setValidationError('');
              setSent(false);
            }}
            error={validationError || (error ? friendlyError(error, 'Failed to send your reply.') : '')}
            placeholder="Add more detail, error messages, or steps to reproduce."
          />
          {(error || sent) && !validationError && (
            <p
              role={error ? 'alert' : 'status'}
              className={`flex items-center gap-2 text-sm ${error ? 'text-destructive' : 'text-success'}`}
            >
              {sent && <LuCheckCircle className="h-4 w-4" />}
              {sent ? 'Your reply has been sent.' : ''}
            </p>
          )}
          <div className="flex justify-end">
            <Button type="submit" loading={submitting} disabled={!body.trim()}>
              <LuSend className="h-4 w-4" />
              Send reply
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default CustomerReplyForm;
