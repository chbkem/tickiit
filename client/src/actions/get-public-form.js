import { API_BASE_URL } from '../lib/constants';
import { errorCodeForStatus } from '../lib/error-message';

export async function getPublicForm(publicId) {
  const response = await fetch(`${API_BASE_URL}/api/public/forms/${publicId}`, {
    method: 'GET',
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const error = new Error(payload.error || 'This form is no longer available.');
    error.code = errorCodeForStatus(response.status);
    throw error;
  }

  return response.json();
}
