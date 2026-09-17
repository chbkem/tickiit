import { API_BASE_URL } from '../lib/constants';

export async function getTicketById(id, token) {
  const response = await fetch(`${API_BASE_URL}/api/tickets/${id}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch ticket');
  }

  return response.json();
}
