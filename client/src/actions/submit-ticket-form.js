import { API_BASE_URL } from '../lib/constants';

export async function submitTicketForm(publicId, data) {
  const response = await fetch(`${API_BASE_URL}/api/public/forms/${publicId}/submit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || 'Failed to submit your request');
  }

  return response.json();
}
