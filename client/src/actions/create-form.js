import { API_BASE_URL } from '../lib/constants';

export async function createForm(token, data = {}) {
  const response = await fetch(`${API_BASE_URL}/api/forms`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || 'Failed to create form');
  }

  return response.json();
}
