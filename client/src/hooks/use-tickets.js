import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@clerk/react';
import { getAllTickets } from '../actions/get-all-tickets';

export function useTickets() {
  const { getToken, orgId } = useAuth();
  const [tickets, setTickets] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const requestKeyRef = useRef(0);

  const refetch = useCallback(async () => {
    const requestKey = ++requestKeyRef.current;
    try {
      setLoading(true);
      setError(null);
      const token = await getToken();
      const data = await getAllTickets(token);
      if (requestKey === requestKeyRef.current) {
        setTickets(data);
      }
    } catch (err) {
      if (requestKey === requestKeyRef.current) {
        setError(err);
      }
    } finally {
      if (requestKey === requestKeyRef.current) {
        setLoading(false);
      }
    }
  }, [getToken]);

  useEffect(() => {
    refetch();
  }, [refetch, orgId]);

  return { tickets, setTickets, loading, error, refetch };
}