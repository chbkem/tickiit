import { fireEvent, render, screen } from '@testing-library/react';
import ViewState from './view-state';

const Skeleton = () => <div data-testid="skeleton" aria-hidden="true" />;

describe('ViewState', () => {
  it('shows a polite skeleton on first load', () => {
    render(
      <ViewState state="loading" skeleton={<Skeleton />}>
        <p>content</p>
      </ViewState>
    );

    expect(screen.getByTestId('skeleton')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Loading');
    expect(screen.queryByText('content')).not.toBeInTheDocument();
  });

  it('shows a friendly error with a manual retry', () => {
    const onRetry = jest.fn();
    render(<ViewState state="error" error={new Error('Failed to fetch')} onRetry={onRetry} />);

    expect(screen.getByRole('alert')).toHaveTextContent(/could not reach the server/i);
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('shows the empty copy and its action', () => {
    const onClear = jest.fn();
    render(
      <ViewState
        state="empty"
        empty={{
          title: 'No matches',
          description: 'No tickets match these filters.',
          action: <button type="button" onClick={onClear}>Clear all filters</button>,
        }}
      />
    );

    expect(screen.getByText('No matches')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clear all filters' }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('keeps content mounted and shows a small busy indicator while refreshing', () => {
    const { rerender } = render(
      <ViewState state="ready">
        <p>content</p>
      </ViewState>
    );
    expect(screen.getByText('content')).toBeInTheDocument();

    rerender(
      <ViewState state="ready" refreshing>
        <p>content</p>
      </ViewState>
    );
    expect(screen.getByText('content')).toBeInTheDocument();
    expect(screen.getByText('Refreshing')).toBeInTheDocument();
  });
});
