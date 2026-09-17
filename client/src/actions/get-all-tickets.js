import { API_BASE_URL } from '../lib/constants';

export async function getAllTickets(token) {
  const response = await fetch(`${API_BASE_URL}/api/tickets`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch tickets');
  }

  return response.json();
}
