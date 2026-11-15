import { API_BASE_URL } from '../lib/constants';

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
    throw new Error(await readError(response, 'Failed to fetch forms'));
  }

  return response.json();
}
