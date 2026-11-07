import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@clerk/react';
import {
  getChannels,
  createChannel,
  rotateChannelToken,
  sendChannelTest,
  updateChannel,
  deleteChannel,
} from '../actions/channels';

export function useChannels() {
  const { getToken, orgId } = useAuth();
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const requestKeyRef = useRef(0);

  const refetch = useCallback(async () => {
    const requestKey = ++requestKeyRef.current;
    try {
      setLoading(true);
      setError(null);
      const token = await getToken();
      const data = await getChannels(token);
      if (requestKey === requestKeyRef.current) {
        setChannels(Array.isArray(data) ? data : []);
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

  const addChannel = useCallback(
    async (input) => {
      const token = await getToken();
      const channel = await createChannel(input, token);
      await refetch();
      return channel;
    },
    [getToken, refetch]
  );

  const rotateToken = useCallback(
    async (id, botToken) => {
      const token = await getToken();
      const channel = await rotateChannelToken(id, botToken, token);
      await refetch();
      return channel;
    },
    [getToken, refetch]
  );

  const sendTest = useCallback(
    async (id, chatId) => {
      const token = await getToken();
      const result = await sendChannelTest(id, chatId, token);
      await refetch();
      return result;
    },
    [getToken, refetch]
  );

  const editChannel = useCallback(
    async (id, input) => {
      const token = await getToken();
      const channel = await updateChannel(id, input, token);
      await refetch();
      return channel;
    },
    [getToken, refetch]
  );

  const removeChannel = useCallback(
    async (id) => {
      const token = await getToken();
      await deleteChannel(id, token);
      await refetch();
    },
    [getToken, refetch]
  );

  return {
    channels,
    loading,
    error,
    refetch,
    addChannel,
    rotateToken,
    sendTest,
    editChannel,
    removeChannel,
  };
}