import { API_BASE_URL } from '../lib/constants';
import { errorCodeForStatus } from '../lib/error-message';

const readError = async (response, fallback) => {
  const data = await response.json().catch(() => ({}));
  return data.error || fallback;
};

export async function getAllForms(token) {
  const response = await fetch(`${API_BASE_URL}/api/forms`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = new Error(await readError(response, 'Failed to fetch forms'));
    error.code = errorCodeForStatus(response.status);
    throw error;
  }

  return response.json();
}
