// Set REACT_APP_API_BASE_URL to point the client at a deployed API. When it is
// unset (local dev), fall back to the server directory's port (see server/.env).
export const API_BASE_URL = (
  process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000'
).replace(/\/+$/, '');

export const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

export const TICKET_TYPE_OPTIONS = [
  { value: 'task', label: 'Task' },
  { value: 'request', label: 'Request' },
  { value: 'bug', label: 'Bug' },
  { value: 'incident', label: 'Incident' },
];

export const TICKET_STATUS_OPTIONS = [
  { value: 'open', label: 'Open' },
  { value: 'in-progress', label: 'In Progress' },
  { value: 'on-hold', label: 'On Hold' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
];

export const toApiEnumValue = (value) => String(value ?? '').toUpperCase().replace(/[- ]/g, '_');