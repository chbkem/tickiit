export const API_BASE_URL =
  process.env.REACT_APP_API_BASE_URL ?? 'https://tickiit-production.up.railway.app';

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