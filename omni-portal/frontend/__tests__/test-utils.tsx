import { render, RenderResult } from '@testing-library/react';
import { ReactElement } from 'react';

// Mock providers for testing
export const MockProviders = ({ children }: { children: ReactElement }) => {
  return <div data-testid="mock-providers">{children}</div>;
};

// Custom render function
export const renderWithProviders = (ui: ReactElement): RenderResult => {
  return render(ui, {
    wrapper: MockProviders
  });
};

// Common test utilities
export const waitForLoadingToFinish = () => new Promise(resolve => setTimeout(resolve, 0));

export const createMockProps = (overrides: any = {}) => ({
  onComplete: jest.fn(),
  onError: jest.fn(),
  ...overrides
});