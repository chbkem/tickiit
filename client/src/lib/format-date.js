import { format } from 'date-fns';

const DATE_FORMAT = 'MM/dd/yyyy';
const DATE_TIME_FORMAT = 'MM/dd/yyyy h:mm a';

function toValidDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  return isNaN(date.getTime()) ? null : date;
}

export function formatTicketDate(value) {
  const date = toValidDate(value);
  return date ? format(date, DATE_FORMAT) : '';
}

export function formatTicketDateTime(value) {
  const date = toValidDate(value);
  return date ? format(date, DATE_TIME_FORMAT) : '';
}