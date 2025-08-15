/**
 * User Accessibility Tests
 * Verifies that new architectural features are actually accessible to end users
 * and not just created but unused
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Providers } from '@/app/providers';
import HomePage from '@/app/page';
import ProfilePage from '@/app/(dashboard)/profile/page';
import RewardsPage from '@/app/(dashboard)/rewards/page';
import HealthQuestionnairePage from '@/app/(onboarding)/health-questionnaire/page';
import { featureFlags } from '@/lib/feature-flags';
import { integrationManager } from '@/lib/integration-manager';

describe('User Accessibility - Features Actually Work', () => {
  beforeEach(() => {
    // Reset state
    featureFlags.reset();
    integrationManager.reset();
  });

  describe('New Architecture is Actually Used', () => {
    it('should wrap app with Providers integration layer', () => {
      const { container } = render(
        <Providers>
          <div data-testid="child">Test Content</div>
        </Providers>
      );
      
      // Verify Providers wrapper is active
      expect(container.querySelector('[data-integration-active]')).toBeTruthy();
      expect(screen.getByTestId('child')).toBeInTheDocument();
    });

    it('should initialize integration manager on app start', () => {
      const initSpy = jest.spyOn(integrationManager, 'initialize');
      
      render(
        <Providers>
          <HomePage />
        </Providers>
      );
      
      expect(initSpy).toHaveBeenCalled();
      expect(integrationManager.isInitialized()).toBe(true);
    });

    it('should use new auth hooks in actual components', async () => {
      // Enable new auth
      featureFlags.set('USE_MODULAR_AUTH', true);
      
      const { container } = render(
        <Providers>
          <HomePage />
        </Providers>
      );
      
      // Login form should use new auth
      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const loginButton = screen.getByRole('button', { name: /sign in/i });
      
      await userEvent.type(emailInput, 'user@example.com');
      await userEvent.type(passwordInput, 'password123');
      await userEvent.click(loginButton);
      
      // Verify new auth was triggered
      await waitFor(() => {
        const authMetrics = container.querySelector('[data-auth-implementation]');
        expect(authMetrics?.getAttribute('data-auth-implementation')).toBe('modular');
      });
    });
  });

  describe('Gamification Integration Works', () => {
    it('should display gamification data from new system', async () => {
      featureFlags.set('USE_UNIFIED_STATE', true);
      
      render(
        <Providers>
          <RewardsPage />
        </Providers>
      );
      
      // Verify gamification elements are rendered
      await waitFor(() => {
        expect(screen.getByText(/points/i)).toBeInTheDocument();
        expect(screen.getByText(/level/i)).toBeInTheDocument();
        expect(screen.getByText(/achievements/i)).toBeInTheDocument();
      });
    });

    it('should update points when actions are completed', async () => {
      featureFlags.set('USE_UNIFIED_STATE', true);
      
      render(
        <Providers>
          <ProfilePage />
        </Providers>
      );
      
      // Complete profile action
      const saveButton = screen.getByRole('button', { name: /save profile/i });
      await userEvent.click(saveButton);
      
      // Points should update
      await waitFor(() => {
        const pointsDisplay = screen.getByTestId('user-points');
        expect(pointsDisplay.textContent).toContain('50'); // Profile completion points
      });
    });

    it('should track health questionnaire completion', async () => {
      featureFlags.set('USE_UNIFIED_STATE', true);
      
      render(
        <Providers>
          <HealthQuestionnairePage />
        </Providers>
      );
      
      // Complete questionnaire
      const submitButton = screen.getByRole('button', { name: /submit/i });
      await userEvent.click(submitButton);
      
      // Should award achievement
      await waitFor(() => {
        const achievements = screen.getByTestId('achievements-list');
        expect(achievements.textContent).toContain('health_questionnaire_complete');
      });
    });
  });

  describe('No Code Duplication in UI', () => {
    it('should not render duplicate auth forms', () => {
      render(
        <Providers>
          <HomePage />
        </Providers>
      );
      
      const loginForms = screen.getAllByRole('form', { name: /login/i });
      expect(loginForms.length).toBe(1);
    });

    it('should not show duplicate loading states', async () => {
      render(
        <Providers>
          <ProfilePage />
        </Providers>
      );
      
      const loadingSpinners = screen.queryAllByTestId('loading-spinner');
      expect(loadingSpinners.length).toBeLessThanOrEqual(1);
    });

    it('should not duplicate API status indicators', () => {
      render(
        <Providers>
          <HomePage />
        </Providers>
      );
      
      const apiIndicators = screen.queryAllByTestId('api-status');
      expect(apiIndicators.length).toBeLessThanOrEqual(1);
    });
  });

  describe('Backend Integration Preserved', () => {
    it('should maintain Laravel Sanctum authentication', async () => {
      const fetchSpy = jest.spyOn(global, 'fetch');
      
      render(
        <Providers>
          <HomePage />
        </Providers>
      );
      
      // Trigger CSRF token fetch
      await waitFor(() => {
        const csrfCall = fetchSpy.mock.calls.find(
          call => call[0].includes('/sanctum/csrf-cookie')
        );
        expect(csrfCall).toBeDefined();
      });
    });

    it('should handle backend validation errors correctly', async () => {
      // Mock validation error
      jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 422,
        json: async () => ({
          errors: {
            email: ['Email is required'],
            password: ['Password must be at least 8 characters']
          }
        })
      } as Response);
      
      render(
        <Providers>
          <HomePage />
        </Providers>
      );
      
      const loginButton = screen.getByRole('button', { name: /sign in/i });
      await userEvent.click(loginButton);
      
      // Should display validation errors
      await waitFor(() => {
        expect(screen.getByText(/email is required/i)).toBeInTheDocument();
        expect(screen.getByText(/password must be at least 8 characters/i)).toBeInTheDocument();
      });
    });
  });

  describe('Performance Impact on Users', () => {
    it('should not increase initial page load time', async () => {
      const startTime = performance.now();
      
      render(
        <Providers>
          <HomePage />
        </Providers>
      );
      
      await waitFor(() => {
        expect(screen.getByRole('main')).toBeInTheDocument();
      });
      
      const loadTime = performance.now() - startTime;
      expect(loadTime).toBeLessThan(200); // Max 200ms
    });

    it('should not cause UI jank during state updates', async () => {
      const { rerender } = render(
        <Providers>
          <ProfilePage />
        </Providers>
      );
      
      // Measure frame time during rapid updates
      const frameTimings: number[] = [];
      let lastFrameTime = performance.now();
      
      for (let i = 0; i < 10; i++) {
        rerender(
          <Providers>
            <ProfilePage />
          </Providers>
        );
        
        const currentTime = performance.now();
        frameTimings.push(currentTime - lastFrameTime);
        lastFrameTime = currentTime;
      }
      
      // No frame should take more than 16ms (60fps)
      const slowFrames = frameTimings.filter(time => time > 16);
      expect(slowFrames.length).toBeLessThan(2); // Allow max 1 slow frame
    });
  });

  describe('Migration Safety for Users', () => {
    it('should preserve user session during migration', async () => {
      // Start with legacy auth
      featureFlags.set('USE_MODULAR_AUTH', false);
      
      const { rerender } = render(
        <Providers>
          <ProfilePage />
        </Providers>
      );
      
      // User is logged in
      expect(screen.getByText(/welcome/i)).toBeInTheDocument();
      
      // Switch to new auth
      featureFlags.set('USE_MODULAR_AUTH', true);
      
      rerender(
        <Providers>
          <ProfilePage />
        </Providers>
      );
      
      // User should still be logged in
      expect(screen.getByText(/welcome/i)).toBeInTheDocument();
    });

    it('should not lose form data during feature flag change', async () => {
      const { rerender } = render(
        <Providers>
          <ProfilePage />
        </Providers>
      );
      
      // Enter form data
      const nameInput = screen.getByLabelText(/name/i);
      await userEvent.type(nameInput, 'John Doe');
      
      // Toggle feature flag
      featureFlags.toggle('USE_MODULAR_AUTH');
      
      rerender(
        <Providers>
          <ProfilePage />
        </Providers>
      );
      
      // Form data should be preserved
      expect(nameInput).toHaveValue('John Doe');
    });
  });

  describe('Error Recovery for Users', () => {
    it('should show user-friendly errors on integration failure', async () => {
      // Force integration error
      jest.spyOn(integrationManager, 'initialize').mockRejectedValueOnce(
        new Error('Integration failed')
      );
      
      render(
        <Providers>
          <HomePage />
        </Providers>
      );
      
      // Should show fallback UI, not error screen
      await waitFor(() => {
        expect(screen.queryByText(/error/i)).not.toBeInTheDocument();
        expect(screen.getByRole('main')).toBeInTheDocument();
      });
    });

    it('should auto-recover from temporary failures', async () => {
      let callCount = 0;
      jest.spyOn(global, 'fetch').mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          throw new Error('Network error');
        }
        return {
          ok: true,
          json: async () => ({ success: true })
        } as Response;
      });
      
      render(
        <Providers>
          <HomePage />
        </Providers>
      );
      
      // Should retry and succeed
      await waitFor(() => {
        expect(screen.getByRole('main')).toBeInTheDocument();
      });
      
      expect(callCount).toBeGreaterThan(1); // Verify retry happened
    });
  });
});