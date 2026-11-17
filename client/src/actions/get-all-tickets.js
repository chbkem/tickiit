import { API_BASE_URL } from '../lib/constants';
import { errorCodeForStatus } from '../lib/error-message';

export async function getAllTickets(token) {
  const response = await fetch(`${API_BASE_URL}/api/tickets`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = new Error('Failed to fetch tickets');
    error.code = errorCodeForStatus(response.status);
    throw error;
  }

  return response.json();
}
