import { ERROR_MESSAGES, errorCodeForStatus, friendlyError } from './error-message';

describe('friendlyError', () => {
  it('maps a network failure to connection guidance', () => {
    expect(friendlyError(new Error('Failed to fetch'))).toBe(ERROR_MESSAGES.network);
  });

  it('maps an access failure to access guidance', () => {
    expect(friendlyError(new Error('Forbidden'))).toBe(ERROR_MESSAGES.access);
  });

  it('maps a missing resource to a not found message', () => {
    expect(friendlyError(new Error('404 not found'))).toBe(ERROR_MESSAGES.missing);
  });

  it('prefers a supplied code and adds a customer facing detail', () => {
    const error = { code: 'MISSING', detail: 'Ticket ABC-123.' };
    expect(friendlyError(error)).toBe(`${ERROR_MESSAGES.missing} Ticket ABC-123.`);
  });

  it('uses the fallback for an unknown message', () => {
    expect(friendlyError(new Error('wat'), 'Could not save your changes')).toBe(
      'Could not save your changes'
    );
  });

  it('uses the generic fallback when nothing is supplied', () => {
    expect(friendlyError(null)).toBe(ERROR_MESSAGES.fallback);
  });
});

describe('errorCodeForStatus', () => {
  it('maps 401 and 403 to ACCESS', () => {
    expect(errorCodeForStatus(401)).toBe('ACCESS');
    expect(errorCodeForStatus(403)).toBe('ACCESS');
  });

  it('maps 404 to MISSING', () => {
    expect(errorCodeForStatus(404)).toBe('MISSING');
  });

  it('leaves other statuses without a code', () => {
    expect(errorCodeForStatus(500)).toBe('');
  });
});
