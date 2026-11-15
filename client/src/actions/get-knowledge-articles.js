import { API_BASE_URL } from '../lib/constants';

export async function getKnowledgeArticles(token) {
  const response = await fetch(`${API_BASE_URL}/api/kb/articles`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch knowledge base');
  }

  return response.json();
}
