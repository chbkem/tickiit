import { API_BASE_URL } from '../lib/constants';

export async function deleteForm(token, formId) {
  const response = await fetch(`${API_BASE_URL}/api/forms/${formId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || 'Failed to delete form');
  }

  return response.json();
}
