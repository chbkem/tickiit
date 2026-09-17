import { API_BASE_URL, toApiEnumValue } from '../lib/constants';

export async function updateTicket(id, updates, token) {
  const body = { ...updates };
  ['status', 'priority', 'type'].forEach((field) => {
    if (body[field] !== undefined && body[field] !== null) {
      body[field] = toApiEnumValue(body[field]);
    }
  });

  const response = await fetch(`${API_BASE_URL}/api/tickets/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error('Failed to update ticket');
  }

  return response.json();
}