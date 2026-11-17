import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useAuth } from '@clerk/react';
import { useNavigate, useParams } from 'react-router-dom';
import { getTicketById } from '../actions/get-ticket-by-id';
import EditTicket from './edit-ticket';

jest.mock('@clerk/react', () => ({ useAuth: jest.fn() }));
jest.mock('react-router-dom', () => ({
  useParams: jest.fn(),
  useNavigate: jest.fn(),
  Link: ({ children, ...props }) => <a {...props}>{children}</a>,
}));
jest.mock('../actions/get-ticket-by-id', () => ({ getTicketById: jest.fn() }));

const ticket = {
  id: 'ticket-1',
  title: 'Printer offline',
  category: 'hardware',
  description: 'The printer on floor two will not connect.',
};

beforeEach(() => {
  useAuth.mockReturnValue({ getToken: jest.fn().mockResolvedValue('token') });
  useParams.mockReturnValue({ id: 'ticket-1' });
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

describe('EditTicket data states', () => {
  it('shows a tailored skeleton while the ticket is loading', () => {
    getTicketById.mockReturnValue(new Promise(() => {}));
    render(<EditTicket />);

    expect(screen.getByRole('status')).toHaveTextContent('Loading');
    expect(screen.queryByLabelText('Title')).not.toBeInTheDocument();
  });

  it('shows a friendly error and retries only when asked', async () => {
    getTicketById
      .mockRejectedValueOnce(new Error('Failed to fetch'))
      .mockResolvedValueOnce(ticket);
    render(<EditTicket />);

    await screen.findByRole('alert');
    expect(screen.getByRole('alert')).toHaveTextContent(/could not reach the server/i);
    expect(getTicketById).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    await screen.findByLabelText('Title');
    await waitFor(() => expect(getTicketById).toHaveBeenCalledTimes(2));
    expect(screen.getByLabelText('Title')).toHaveValue('Printer offline');
  });

  it('shows a not found empty state when there is no ticket', async () => {
    getTicketById.mockResolvedValueOnce(null);
    render(<EditTicket />);

    expect(await screen.findByText('Ticket not found')).toBeInTheDocument();
    expect(screen.queryByLabelText('Title')).not.toBeInTheDocument();
  });

  it('shows the form when the ticket is ready', async () => {
    getTicketById.mockResolvedValueOnce(ticket);
    render(<EditTicket />);

    expect(await screen.findByLabelText('Title')).toHaveValue('Printer offline');
    expect(screen.getByLabelText('Category')).toHaveValue('hardware');
    expect(screen.getByLabelText('Description')).toHaveValue(ticket.description);
  });
});
