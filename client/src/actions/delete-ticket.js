import { API_BASE_URL } from '../lib/constants';

export async function deleteTicket(id, token) {
  if (!id) {
    throw new Error('Ticket ID is required');
  }

  const response = await fetch(`${API_BASE_URL}/api/tickets/${id}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to delete ticket');
  }

  return response.json();
}