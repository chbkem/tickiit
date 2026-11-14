import { API_BASE_URL } from '../lib/constants';

export async function getPublicForm(publicId) {
  const response = await fetch(`${API_BASE_URL}/api/public/forms/${publicId}`, {
    method: 'GET',
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || 'This form is no longer available.');
  }

  return response.json();
}
