import { API_BASE_URL } from '../lib/constants';
import { errorCodeForStatus } from '../lib/error-message';

export async function postCustomerReply(token, body) {
  const response = await fetch(
    `${API_BASE_URL}/api/public/tickets/${encodeURIComponent(token)}/replies`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body }),
    }
  );

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const error = new Error(payload.error || 'Failed to send your reply');
    error.code = errorCodeForStatus(response.status);
    error.details = payload.details;
    throw error;
  }

  return response.json();
}
