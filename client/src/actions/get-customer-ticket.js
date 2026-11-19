import { API_BASE_URL } from '../lib/constants';
import { errorCodeForStatus } from '../lib/error-message';

export async function getCustomerTicket(token) {
  const response = await fetch(
    `${API_BASE_URL}/api/public/tickets/${encodeURIComponent(token)}`,
    { method: 'GET' }
  );

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const error = new Error(payload.error || 'This link is invalid or has expired.');
    error.code = errorCodeForStatus(response.status);
    throw error;
  }

  return response.json();
}
