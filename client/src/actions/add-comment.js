import { API_BASE_URL } from '../lib/constants';

export async function addComment(ticketId, { body, visibility }, token) {
  const response = await fetch(`${API_BASE_URL}/api/tickets/${ticketId}/comments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ body, ...(visibility ? { visibility } : {}) }),
  });

  if (!response.ok) {
    throw new Error('Failed to add comment');
  }

  return response.json();
}