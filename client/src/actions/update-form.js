import { API_BASE_URL } from '../lib/constants';

export async function updateForm(token, formId, data) {
  const response = await fetch(`${API_BASE_URL}/api/forms/${formId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || 'Failed to update form');
  }

  return response.json();
}
