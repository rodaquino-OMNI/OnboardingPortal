/**
 * FeatureFlagGuard Tests - Tests for feature flag routing protection
 */

import { render, screen } from '@testing-library/react';
import { FeatureFlagGuard } from '@/components/FeatureFlagGuard';
import { FeatureFlagProvider } from '@/providers/FeatureFlagProvider';
import { useRouter } from 'next/navigation';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

describe('FeatureFlagGuard', () => {
  const mockPush = jest.fn();

  beforeEach(() => {
    (useRouter as jest.Mock).mockReturnValue({
      push: mockPush,
    });
  });

  it('renders children when flag is enabled', () => {
    const mockFlags = { sliceC_health: true };

    render(
      <FeatureFlagProvider>
        <FeatureFlagGuard flag="sliceC_health">
          <div>Protected Content</div>
        </FeatureFlagGuard>
      </FeatureFlagProvider>
    );

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('shows fallback when flag is disabled', () => {
    const mockFlags = { sliceC_health: false };

    render(
      <FeatureFlagProvider>
        <FeatureFlagGuard
          flag="sliceC_health"
          fallback={<div>Feature Disabled</div>}
        >
          <div>Protected Content</div>
        </FeatureFlagGuard>
      </FeatureFlagProvider>
    );

    expect(screen.getByText('Feature Disabled')).toBeInTheDocument();
  });
});
