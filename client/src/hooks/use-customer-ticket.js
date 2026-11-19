import { useCallback, useEffect, useRef, useState } from 'react';
import { getCustomerTicket } from '../actions/get-customer-ticket';
import { postCustomerReply } from '../actions/post-customer-reply';

export function useCustomerTicket(token) {
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [replying, setReplying] = useState(false);
  const [replyError, setReplyError] = useState(null);
  const requestKeyRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const requestKey = requestKeyRef.current + 1;
    requestKeyRef.current = requestKey;
    setLoading(true);
    setError(null);
    setTicket(null);

    getCustomerTicket(token)
      .then((data) => {
        if (!cancelled && requestKey === requestKeyRef.current) setTicket(data);
      })
      .catch((err) => {
        if (!cancelled && requestKey === requestKeyRef.current) setError(err);
      })
      .finally(() => {
        if (!cancelled && requestKey === requestKeyRef.current) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const submitReply = useCallback(
    async (body) => {
      setReplying(true);
      setReplyError(null);
      try {
        const comment = await postCustomerReply(token, body);
        setTicket((current) =>
          current
            ? { ...current, comments: [...current.comments, comment] }
            : current
        );
        return true;
      } catch (err) {
        setReplyError(err);
        return false;
      } finally {
        setReplying(false);
      }
    },
    [token]
  );

  return { ticket, loading, error, replying, replyError, submitReply };
}
