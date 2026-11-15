import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@clerk/react';
import { getKnowledgeArticles } from '../actions/get-knowledge-articles';
import { uploadKnowledgeDocument } from '../actions/upload-knowledge-document';

export function useKnowledgeArticles() {
  const { getToken, orgId } = useAuth();
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const requestKeyRef = useRef(0);

  const refetch = useCallback(async () => {
    const requestKey = ++requestKeyRef.current;
    try {
      setLoading(true);
      setError(null);
      const token = await getToken();
      const data = await getKnowledgeArticles(token);
      if (requestKey === requestKeyRef.current) {
        setArticles(Array.isArray(data) ? data : []);
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

  const uploadDocument = useCallback(
    async (file) => {
      setUploading(true);
      setUploadError(null);
      try {
        const token = await getToken();
        const article = await uploadKnowledgeDocument(file, token);
        await refetch();
        return article;
      } catch (err) {
        setUploadError(err);
        return null;
      } finally {
        setUploading(false);
      }
    },
    [getToken, refetch]
  );

  return { articles, loading, error, refetch, uploadDocument, uploading, uploadError };
}
