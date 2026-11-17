import { API_BASE_URL } from '../lib/constants';
import { errorCodeForStatus } from '../lib/error-message';

export async function getTicketById(id, token) {
  const response = await fetch(`${API_BASE_URL}/api/tickets/${id}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = new Error('Failed to fetch ticket');
    error.code = errorCodeForStatus(response.status);
    throw error;
  }

  return response.json();
}
