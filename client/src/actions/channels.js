import { API_BASE_URL } from '../lib/constants';

// Channel CRUD errors are user actionable (duplicate identifier, not found, not
// admin), so read the server's message like the upload action does.
const readError = async (response, fallback) => {
  const payload = await response.json().catch(() => ({}));
  return new Error(payload.error || fallback);
};

export async function getChannels(token) {
  const response = await fetch(`${API_BASE_URL}/api/channels`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw await readError(response, 'Failed to load channels');
  }

  return response.json();
}

export async function createChannel({ channel, identifier }, token) {
  const response = await fetch(`${API_BASE_URL}/api/channels`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ channel, identifier }),
  });

  if (!response.ok) {
    throw await readError(response, 'Failed to create channel');
  }

  return response.json();
}

export async function updateChannel(id, { isActive }, token) {
  const response = await fetch(`${API_BASE_URL}/api/channels/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ isActive }),
  });

  if (!response.ok) {
    throw await readError(response, 'Failed to update channel');
  }

  return response.json();
}

export async function deleteChannel(id, token) {
  const response = await fetch(`${API_BASE_URL}/api/channels/${id}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw await readError(response, 'Failed to delete channel');
  }
}
