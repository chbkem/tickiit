import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import Logo from '../components/logo';
import CustomerReplyForm from '../components/customer/customer-reply-form';
import CustomerTicketView from '../components/customer/customer-ticket-view';
import InvalidLink from '../components/customer/invalid-link';
import { useCustomerTicket } from '../hooks/use-customer-ticket';

const CustomerTicketSkeleton = () => (
  <div aria-hidden="true" className="space-y-4">
    <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
      <div className="h-4 w-24 animate-pulse rounded bg-muted" />
      <div className="mt-3 h-7 w-2/3 animate-pulse rounded bg-muted" />
      <div className="mt-4 flex gap-2">
        <div className="h-5 w-16 animate-pulse rounded bg-muted" />
        <div className="h-5 w-24 animate-pulse rounded bg-muted" />
      </div>
      <div className="mt-6 h-4 w-full animate-pulse rounded bg-muted" />
      <div className="mt-2 h-4 w-4/5 animate-pulse rounded bg-muted" />
    </div>
    <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
      <div className="h-4 w-32 animate-pulse rounded bg-muted" />
      <div className="mt-5 h-16 w-full animate-pulse rounded bg-muted" />
    </div>
  </div>
);

const CLOSED_STATUSES = ['RESOLVED', 'CLOSED'];

const CustomerTicket = () => {
  const { token } = useParams();
  const { ticket, loading, error, replying, replyError, submitReply } =
    useCustomerTicket(token);

  useEffect(() => {
    const robots = document.createElement('meta');
    robots.setAttribute('name', 'robots');
    robots.setAttribute('content', 'noindex, nofollow');
    document.head.appendChild(robots);

    const previousTitle = document.title;
    document.title = 'Your support ticket | tickiit';

    return () => {
      if (robots.parentNode) robots.parentNode.removeChild(robots);
      document.title = previousTitle;
    };
  }, []);

  const frame = (children) => (
    <div className="min-h-screen bg-muted/40 px-4 py-10">
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-8 flex items-center gap-2">
          <Logo className="h-8 w-auto" alt="tickiit" />
          <span className="font-serif text-lg font-bold tracking-tight">tickiit</span>
        </div>
        {children}
        <p className="mt-8 text-center text-xs text-muted-foreground">
          Powered by tickiit
        </p>
      </div>
    </div>
  );

  if (loading) return frame(<CustomerTicketSkeleton />);
  if (error || !ticket) return frame(<InvalidLink />);

  return frame(
    <>
      <CustomerTicketView ticket={ticket} />
      <CustomerReplyForm
        onSubmit={submitReply}
        submitting={replying}
        error={replyError}
        closed={CLOSED_STATUSES.includes(ticket.status)}
      />
    </>
  );
};

export default CustomerTicket;
