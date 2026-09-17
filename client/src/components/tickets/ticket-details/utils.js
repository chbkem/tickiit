import { AVATAR_COLORS } from './constants';
import { TICKET_STATUS_OPTIONS } from '../../../lib/constants';

export const normalizeValue = (value) => String(value ?? '').toLowerCase().replace(/[_\s]+/g, '-');

export const getLabel = (options, value) => {
  const option = options.find((o) => o.value === normalizeValue(value));
  return option ? option.label : value || 'N/A';
};

export function toDatetimeLocal(value) {
  if (!value) return '';
  const date = new Date(value);
  if (isNaN(date.getTime())) return String(value).slice(0, 16);
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

export function initialsFor(name, fallback = '?') {
  const clean = String(name || '').trim();
  if (!clean) return fallback;
  return clean
    .split(/\s+/)
    .map((part) => part.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export function colorFor(name) {
  const clean = String(name || '');
  const sum = clean.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return AVATAR_COLORS[sum % AVATAR_COLORS.length];
}

export const statusLabel = (value) => getLabel(TICKET_STATUS_OPTIONS, value);

export const buildItems = (options, dots) =>
  options.map((option) => ({ value: option.value, label: option.label, dot: dots?.[option.value] }));
