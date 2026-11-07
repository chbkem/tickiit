import { API_BASE_URL } from '../lib/constants';

// Channel CRUD errors are user actionable (duplicate identifier, not found, not
// admin, Telegram rejected a token), so read the server's message like the
// upload action does.
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

// Email channels are created by identifier; Telegram channels are created by
// pasting a bot token, and the server asks Telegram who the bot is itself.
export async function createChannel(input, token) {
  const response = await fetch(`${API_BASE_URL}/api/channels`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw await readError(response, 'Failed to create channel');
  }

  return response.json();
}

// Replaces the token on an existing bot. The recovery path for a revoked token.
export async function rotateChannelToken(id, botToken, token) {
  const response = await fetch(`${API_BASE_URL}/api/channels/${id}/telegram/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ botToken }),
  });

  if (!response.ok) {
    throw await readError(response, 'Failed to replace the bot token');
  }

  return response.json();
}

// Sends one message through the bot to a chat id the admin supplies.
export async function sendChannelTest(id, chatId, token) {
  const response = await fetch(`${API_BASE_URL}/api/channels/${id}/test`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ chatId }),
  });

  if (!response.ok) {
    throw await readError(response, 'Failed to send the test message');
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