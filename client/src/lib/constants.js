// Set REACT_APP_API_BASE_URL to point the client at a deployed API. When it is
// unset (local dev), fall back to the server directory's port (see server/.env).
export const API_BASE_URL = (
  process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000'
).replace(/\/+$/, '');

const CONFIGURED_PUBLIC_URL = (process.env.REACT_APP_PUBLIC_URL || '').replace(/\/+$/, '');

export const getPublicBaseUrl = () => {
  if (CONFIGURED_PUBLIC_URL) return CONFIGURED_PUBLIC_URL;
  return typeof window !== 'undefined' ? window.location.origin : '';
};

export const buildFormUrl = (publicId) => `${getPublicBaseUrl()}/f/${publicId}`;

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

export const KB_ACCEPTED_EXTENSIONS = ['txt', 'md', 'pdf', 'docx'];

export const KB_UPLOAD_ACCEPT = KB_ACCEPTED_EXTENSIONS.map((extension) => `.${extension}`).join(',');

export const KB_MAX_UPLOAD_BYTES = 10 * 1024 * 1024;