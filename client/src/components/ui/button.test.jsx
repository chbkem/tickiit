import { render, screen } from '@testing-library/react';
import Button from './button';

describe('Button loading state', () => {
  it('keeps the accessible name while hiding the label visually', () => {
    render(<Button loading>Save changes</Button>);

    const button = screen.getByRole('button', { name: 'Save changes' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button.querySelector('.sr-only')).toHaveTextContent('Save changes');
    expect(button.querySelector('[role="status"]')).toBeInTheDocument();
  });

  it('shows the label normally when not loading', () => {
    render(<Button>Save changes</Button>);

    const button = screen.getByRole('button', { name: 'Save changes' });
    expect(button).not.toBeDisabled();
    expect(button).not.toHaveAttribute('aria-busy');
    expect(button.querySelector('.sr-only')).not.toBeInTheDocument();
  });
});
