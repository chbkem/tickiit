import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { z } from 'zod';
import { LuCheckCircle, LuMail } from 'react-icons/lu';
import Logo from '../components/logo';
import { Button, Card, CardContent, CardHeader, Input, Spinner, Textarea } from '../components/ui';
import { getPublicForm } from '../actions/get-public-form';
import { submitTicketForm } from '../actions/submit-ticket-form';

const ticketRequestSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Please enter your name.')
    .max(100, 'Name must be 100 characters or fewer.'),
  email: z
    .string()
    .trim()
    .min(1, 'Please enter your email address.')
    .email('Enter a valid email address.')
    .max(254, 'Email must be 254 characters or fewer.'),
  subject: z
    .string()
    .trim()
    .min(1, 'Please enter a subject.')
    .max(200, 'Subject must be 200 characters or fewer.'),
  message: z
    .string()
    .trim()
    .min(1, 'Please describe your issue.')
    .max(5000, 'Message must be 5000 characters or fewer.'),
});

const EMPTY_VALUES = { name: '', email: '', subject: '', message: '' };

const PublicForm = () => {
  const { publicId } = useParams();
  const startedAt = useRef(Date.now());

  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [values, setValues] = useState(EMPTY_VALUES);
  const [errors, setErrors] = useState({});
  const [website, setWebsite] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [result, setResult] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError('');

    getPublicForm(publicId)
      .then((data) => {
        if (!cancelled) setForm(data);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err.message || 'This form is no longer available.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [publicId]);

  const handleChange = (field) => (event) => {
    const { value } = event.target;
    setValues((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitError('');

    const parsed = ticketRequestSchema.safeParse(values);
    if (!parsed.success) {
      const fieldErrors = {};
      parsed.error.issues.forEach((issue) => {
        fieldErrors[issue.path[0]] = issue.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setSubmitting(true);
    try {
      const response = await submitTicketForm(publicId, {
        ...parsed.data,
        website,
        elapsedMs: Date.now() - startedAt.current,
      });
      setResult(response);
    } catch (err) {
      setSubmitError(err.message || 'Failed to submit your request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const frame = (children) => (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/40 p-4">
      <div className="mb-6 flex items-center gap-2">
        <Logo className="h-9 w-auto" alt="tickiit" />
        <span className="font-serif text-xl font-bold tracking-tight">tickiit</span>
      </div>
      {children}
      <p className="mt-6 text-xs text-muted-foreground">Powered by tickiit</p>
    </div>
  );

  if (loading) {
    return frame(<Spinner />);
  }

  if (loadError || !form) {
    return frame(
      <Card className="w-full max-w-lg">
        <CardHeader>
          <h1 className="text-xl font-semibold text-foreground">Form unavailable</h1>
          <p className="text-sm text-muted-foreground">
            {loadError || 'This form is no longer available.'}
          </p>
        </CardHeader>
      </Card>
    );
  }

  if (result) {
    return frame(
      <Card className="w-full max-w-lg">
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-success/10 text-success">
            <LuCheckCircle className="h-7 w-7" />
          </div>
          <h1 className="text-xl font-semibold text-foreground">Request received</h1>
          <p className="max-w-sm text-sm text-muted-foreground">
            Your ticket <span className="font-mono font-semibold text-foreground">{result.ticketNumber}</span>{' '}
            has been created. Keep this number for reference.
          </p>
          {result.confirmationSent ? (
            <p className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
              <LuMail className="h-4 w-4" />
              A confirmation email has been sent to your inbox.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              A member of our team will follow up as soon as possible.
            </p>
          )}
          <Button
            className="mt-2"
            variant="outline"
            onClick={() => {
              setValues(EMPTY_VALUES);
              setErrors({});
              setSubmitError('');
              setResult(null);
              startedAt.current = Date.now();
            }}
          >
            Submit another request
          </Button>
        </CardContent>
      </Card>
    );
  }

  return frame(
    <Card className="w-full max-w-xl">
      <CardHeader className="space-y-1.5">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {form.orgName}
        </p>
        <h1 className="text-2xl font-bold text-foreground">{form.name}</h1>
        <p className="text-sm text-muted-foreground">
          {form.description || 'Tell us what you need help with and our team will get back to you.'}
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <Input
            id="name"
            label="Your name"
            value={values.name}
            onChange={handleChange('name')}
            error={errors.name}
            autoComplete="name"
            maxLength={100}
            required
          />
          <Input
            id="email"
            type="email"
            label="Email address"
            value={values.email}
            onChange={handleChange('email')}
            error={errors.email}
            autoComplete="email"
            maxLength={254}
            required
          />
          <Input
            id="subject"
            label="Subject"
            value={values.subject}
            onChange={handleChange('subject')}
            error={errors.subject}
            maxLength={200}
            placeholder="A short summary of the issue"
            required
          />
          <Textarea
            id="message"
            label="Message"
            value={values.message}
            onChange={handleChange('message')}
            error={errors.message}
            rows={6}
            maxLength={5000}
            placeholder="Describe what happened, including any error messages or steps to reproduce."
            required
          />

          <div
            className="absolute -left-[9999px] top-auto h-px w-px overflow-hidden"
            aria-hidden="true"
          >
            <label htmlFor="website">Website</label>
            <input
              id="website"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              value={website}
              onChange={(event) => setWebsite(event.target.value)}
            />
          </div>

          {submitError && (
            <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive" role="alert">
              {submitError}
            </p>
          )}

          <Button type="submit" className="w-full" loading={submitting}>
            {submitting ? 'Submitting...' : 'Submit request'}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            We only use your email address to reply to this request.
          </p>
        </form>
      </CardContent>
    </Card>
  );
};

export default PublicForm;
