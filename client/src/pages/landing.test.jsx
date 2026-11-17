import { render, screen } from '@testing-library/react';
import { useAuth, useClerk } from '@clerk/react';
import Landing from './landing';
import Header from '../components/landing/navbar';

jest.mock('@clerk/react', () => ({
  useAuth: jest.fn(),
  useClerk: jest.fn(),
  UserButton: () => <div data-testid="user-button" />,
}));
jest.mock('react-router-dom', () => ({
  useNavigate: () => jest.fn(),
  Link: ({ children, ...props }) => <a {...props}>{children}</a>,
}));
jest.mock('../components/landing/ai-triage', () => () => <div />);
jest.mock('../components/landing/workflow', () => () => <div />);
jest.mock('../components/landing/features', () => () => <div />);
jest.mock('../components/landing/open-source', () => () => <div />);
jest.mock('../components/landing/footer', () => () => <div />);
jest.mock('../components/landing/hero-mock', () => () => <div />);
jest.mock('../components/logo', () => () => <div />);

const authButtons = () =>
  screen.getAllByRole('button').filter((button) => button.getAttribute('aria-label') !== 'Toggle menu');

beforeEach(() => {
  useClerk.mockReturnValue({ openSignIn: jest.fn(), openSignUp: jest.fn() });
});

describe('landing Clerk gate', () => {
  it('shows spinners with no visible labels while Clerk is loading', () => {
    useAuth.mockReturnValue({ isLoaded: false, isSignedIn: undefined });
    render(<Landing />);

    const buttons = authButtons();
    expect(buttons.length).toBeGreaterThan(0);
    buttons.forEach((button) => {
      expect(button).toBeDisabled();
      expect(button.querySelector('.sr-only')).toBeTruthy();
      expect(button.querySelector('[role="status"]')).toBeTruthy();
    });
    expect(screen.getAllByRole('link', { name: /github/i }).length).toBeGreaterThan(0);
  });

  it('shows the signed out labels and clickable controls once Clerk is loaded', () => {
    useAuth.mockReturnValue({ isLoaded: true, isSignedIn: false });
    render(<Landing />);

    expect(screen.getAllByRole('button', { name: 'Sign in' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: 'Get started' }).length).toBeGreaterThan(0);
    authButtons().forEach((button) => expect(button).not.toBeDisabled());
  });

  it('shows the signed in labels and the account control once Clerk reports a session', () => {
    useAuth.mockReturnValue({ isLoaded: true, isSignedIn: true });
    render(<Landing />);

    expect(screen.getAllByRole('button', { name: 'Dashboard' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: 'Go to dashboard' })).toHaveLength(2);
    expect(screen.getByTestId('user-button')).toBeInTheDocument();
  });

  it('spins the header Dashboard button and UserButton while a session is resolving', () => {
    render(
      <Header
        isLoaded={false}
        isSignedIn
        onSignIn={() => {}}
        onPrimaryAction={() => {}}
        onDashboard={() => {}}
      />
    );

    const dashboard = screen.getByRole('button', { name: 'Dashboard' });
    expect(dashboard).toBeDisabled();
    expect(dashboard.querySelector('[role="status"]')).toBeTruthy();
    expect(screen.getByLabelText('Loading account menu')).toBeInTheDocument();
    expect(screen.queryByTestId('user-button')).not.toBeInTheDocument();
  });
});
