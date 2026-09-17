import { API_BASE_URL, toApiEnumValue } from '../lib/constants';

export async function createTicket(ticket, token) {
  const { date, ...payload } = ticket;

  ['status', 'priority', 'type'].forEach((field) => {
    if (payload[field] !== undefined && payload[field] !== null) {
      payload[field] = toApiEnumValue(payload[field]);
    }
  });

  const response = await fetch(`${API_BASE_URL}/api/tickets`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error('Failed to create ticket');
  }

  return response.json();
}