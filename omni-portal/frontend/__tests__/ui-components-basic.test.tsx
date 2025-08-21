import React from 'react';
import { render, screen } from '@testing-library/react';
import { Button } from '@/components/ui/button';

// Mock lucide-react completely for now
jest.mock('lucide-react', () => ({
  Loader2: () => <span data-testid="loader">Loading...</span>,
}));

describe('UI Components - Basic Tests', () => {
  it('should render a button component', () => {
    render(<Button>Test Button</Button>);
    expect(screen.getByRole('button', { name: 'Test Button' })).toBeInTheDocument();
  });

  it('should render button with different variants', () => {
    render(<Button variant="secondary">Secondary Button</Button>);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('should handle disabled state', () => {
    render(<Button disabled>Disabled Button</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });
});