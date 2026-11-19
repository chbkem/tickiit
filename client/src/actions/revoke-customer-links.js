import { API_BASE_URL } from '../lib/constants';

export async function revokeCustomerLinks(ticketId, token) {
  const response = await fetch(
    `${API_BASE_URL}/api/tickets/${ticketId}/customer-links`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || 'Failed to revoke customer links');
  }

  return response.json();
}
