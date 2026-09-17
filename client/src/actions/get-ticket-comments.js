import { API_BASE_URL } from '../lib/constants';

export async function getTicketComments(ticketId, token) {
  const response = await fetch(`${API_BASE_URL}/api/tickets/${ticketId}/comments`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch comments');
  }

  return response.json();
}