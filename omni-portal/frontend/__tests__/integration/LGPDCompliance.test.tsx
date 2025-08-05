import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import '@testing-library/jest-dom';

// Components
import PrivacySettings from '../../components/privacy/PrivacySettings';
import DataExport from '../../components/privacy/DataExport';
import ConsentManager from '../../components/privacy/ConsentManager';
import AccountDeletion from '../../components/privacy/AccountDeletion';
import ActivityLog from '../../components/privacy/ActivityLog';

// Types
interface PrivacyConsent {
  id: string;
  type: 'marketing' | 'analytics' | 'essential' | 'functional';
  granted: boolean;
  granted_at?: string;
  withdrawn_at?: string;
  version: string;
}

interface DataExportRequest {
  id: string;
  requested_at: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  download_url?: string;
  expires_at?: string;
  data_categories: string[];
}

interface ProcessingActivity {
  id: string;
  activity: string;
  purpose: string;
  legal_basis: string;
  data_categories: string[];
  timestamp: string;
  retention_period: string;
}

// MSW Server
const server = setupServer(
  // Consent management
  http.get('/api/privacy/consents', ({ request }) => {
    return HttpResponse.json({
        consents: [
          {
            id: 'consent-1',
            type: 'essential',
            granted: true,
            granted_at: '2024-01-01T00:00:00Z',
            version: '1.0',
          },
          {
            id: 'consent-2',
            type: 'marketing',
            granted: false,
            version: '1.0',
          },
          {
            id: 'consent-3',
            type: 'analytics',
            granted: true,
            granted_at: '2024-01-01T00:00:00Z',
            version: '1.0',
          },
        ],
      });
  }),

  http.put('/api/privacy/consents/:consentId', async ({ request }) => {
    const { consentId } = params;
    const { granted } = await request.json();
    
    return HttpResponse.json(
      {
        success: true,
        consent: {
          id: consentId,
          granted,
          updated_at: new Date().toISOString()
        }
      }
    );
  }),

  http.post('/api/privacy/consents/withdraw-all', ({ request }) => {
    return HttpResponse.json({
        success: true,
        withdrawn_count: 2,
        remaining_essential: ['essential'],
      });
  }),

  // Data export
  http.post('/api/privacy/export/request', async ({ request }) => {
    const { categories, format } = await request.json();
    
    return HttpResponse.json(
{
        id: 'export-123',
        requested_at: new Date().toISOString(),
        status: 'pending',
        data_categories: categories
      }
    );
  }),

  http.get('/api/privacy/export/:exportId/status', ({ request }) => {
    const { exportId } = params;
    
    // Simulate processing stages
    const stage = sessionStorage.getItem(`export-${exportId}-stage`) || 'processing';
    
    if (stage === 'completed') {
      return HttpResponse.json(
        {
          id: exportId,
          status: 'completed',
          download_url: `https://secure-download.example.com/${exportId}`,
          expires_at: new Date(Date.now() + 86400000).toISOString(),
          file_size: '25.4 MB',
          checksum: 'sha256:abcdef123456'
        }
      );
    }
    
    return HttpResponse.json(
      {
        id: exportId,
        status: stage,
        progress: stage === 'processing' ? 45 : 0,
        estimated_completion: new Date(Date.now() + 300000).toISOString()
      }
    );
  }),

  http.get('/api/privacy/export/history', ({ request }) => {
    return HttpResponse.json({
        exports: [
          {
            id: 'export-old-1',
            requested_at: '2024-11-01T10:00:00Z',
            status: 'completed',
            download_url: 'https://secure-download.example.com/old-1',
            expires_at: '2024-11-08T10:00:00Z',
          },
          {
            id: 'export-old-2',
            requested_at: '2024-10-15T14:30:00Z',
            status: 'expired',
          },
        ],
      });
  }),

  // Account deletion
  http.post('/api/privacy/account/deletion-request', async ({ request }) => {
    const { reason, confirm_understanding } = await request.json();
    
    if (!confirm_understanding) {
      return HttpResponse.json({ error: 'Must confirm understanding of consequences' }, { status: 400 });
    }
    
    return HttpResponse.json(
      {
        success: true,
        deletion_scheduled: new Date(Date.now() + 30 * 86400000).toISOString(),
        grace_period_days: 30,
        cancellation_token: 'cancel-token-123'
      }
    );
  }),

  http.post('/api/privacy/account/deletion-cancel', async ({ request }) => {
    const { cancellation_token } = await request.json();
    
    if (cancellation_token === 'cancel-token-123') {
      return HttpResponse.json({
          success: true,
          message: 'Account deletion cancelled',
        });
    }
    
    return HttpResponse.json({ error: 'Invalid cancellation token' }, { status: 400 });
  }),

  http.get('/api/privacy/account/deletion-impact', ({ request }) => {
    return HttpResponse.json(
      {
        impact: {
          data_to_be_deleted: [
            'Personal information',
            'Health assessments',
            'Uploaded documents',
            'Interview history',
            'Gamification progress',
          ],
          data_to_be_retained: [
            'Anonymized analytics',
            'Legal compliance records (7 years)',
            'Financial transactions (as required by law)',
          ],
          services_affected: [
            'Cannot access platform',
            'Cannot recover account',
            'Lose all progress and history',
          ],
          associated_accounts: [
            { service: 'Health Portal', status: 'Will be deleted' },
            { service: 'Document Vault', status: 'Will be deleted' },
          ],
        }
      }
    );
  }),

  // Privacy settings
  http.get('/api/privacy/settings', ({ request }) => {
    return HttpResponse.json({
        privacy_mode: 'standard',
        data_sharing: {
          analytics: true,
          improvement: true,
          marketing: false,
        },
        retention_preferences: {
          health_data: '2_years',
          documents: '5_years',
          activity_logs: '1_year',
        },
        communication_preferences: {
          email: true,
          sms: false,
          push: true,
        },
      });
  }),

  http.put('/api/privacy/settings', async ({ request }) => {
    const settings = await request.json();
    
    return HttpResponse.json(
      {
        success: true,
        settings,
        applied_at: new Date().toISOString()
      }
    );
  }),

  // Activity logs
  http.get('/api/privacy/activity-logs', ({ request }) => {
    const page = parseInt(request.url.searchParams.get('page') || '1');
    const category = request.url.searchParams.get('category');
    
    const activities: ProcessingActivity[] = [
      {
        id: 'act-1',
        activity: 'Profile Update',
        purpose: 'User requested update',
        legal_basis: 'Consent',
        data_categories: ['Personal Information'],
        timestamp: new Date().toISOString(),
        retention_period: '7 years',
      },
      {
        id: 'act-2',
        activity: 'Health Assessment Analysis',
        purpose: 'Provide health insights',
        legal_basis: 'Legitimate Interest',
        data_categories: ['Health Data', 'Behavioral Data'],
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        retention_period: '2 years',
      },
      {
        id: 'act-3',
        activity: 'Document OCR Processing',
        purpose: 'Extract document information',
        legal_basis: 'Contract Performance',
        data_categories: ['Documents', 'Personal Information'],
        timestamp: new Date(Date.now() - 7200000).toISOString(),
        retention_period: '5 years',
      },
    ];
    
    return HttpResponse.json({
        activities: category 
          ? activities.filter(a => a.data_categories.includes(category))
          : activities,
        total: activities.length,
        page,
        pages: Math.ceil(activities.length / 10)
      });
  }),

  // Cross-service data consistency
  http.get('/api/privacy/data-map', ({ request }) => {
    return HttpResponse.json(
      {
        services: [
          {
            name: 'Authentication Service',
            data_held: ['Email', 'Password Hash', 'Session Tokens'],
            last_accessed: new Date().toISOString()
          },
          {
            name: 'Health Service',
            data_held: ['Health Assessments', 'Medical History', 'Risk Scores'],
            last_accessed: new Date(Date.now() - 86400000).toISOString()
          },
          {
            name: 'Document Service',
            data_held: ['Uploaded Documents', 'OCR Results', 'Metadata'],
            last_accessed: new Date(Date.now() - 172800000).toISOString()
          },
          {
            name: 'Gamification Service',
            data_held: ['Points', 'Badges', 'Activity History'],
            last_accessed: new Date(Date.now() - 3600000).toISOString()
          },
        ],
      }
    );
  }),
);

beforeAll(() => server.listen());
afterEach(() => {
  server.resetHandlers();
  sessionStorage.clear();
});
afterAll(() => server.close());

// Test utilities
const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

const renderWithProviders = (ui: React.ReactElement) => {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
};

describe('LGPD Compliance Integration', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
  });

  describe('Data Export Functionality', () => {
    it('should export user data across all modules', async () => {
      renderWithProviders(<DataExport />);

      // Select data categories
      await user.click(screen.getByRole('checkbox', { name: /personal information/i }));
      await user.click(screen.getByRole('checkbox', { name: /health data/i }));
      await user.click(screen.getByRole('checkbox', { name: /documents/i }));
      await user.click(screen.getByRole('checkbox', { name: /activity history/i }));

      // Select format
      const formatSelect = screen.getByLabelText(/export format/i);
      await user.selectOptions(formatSelect, 'json');

      // Request export
      await user.click(screen.getByRole('button', { name: /request export/i }));

      // Verify request submitted
      await waitFor(() => {
        expect(screen.getByText(/export requested/i)).toBeInTheDocument();
        expect(screen.getByTestId('export-id')).toHaveTextContent('export-123');
      });

      // Simulate processing completion
      sessionStorage.setItem('export-export-123-stage', 'completed');

      // Check status
      await user.click(screen.getByRole('button', { name: /check status/i }));

      await waitFor(() => {
        expect(screen.getByText(/export completed/i)).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /download/i })).toHaveAttribute(
          'href',
          'https://secure-download.example.com/export-123'
        );
        expect(screen.getByText(/expires in/i)).toBeInTheDocument();
        expect(screen.getByText(/25.4 MB/i)).toBeInTheDocument();
      });
    });

    it('should show export history and allow re-download', async () => {
      renderWithProviders(<DataExport showHistory />);

      await waitFor(() => {
        expect(screen.getByText(/export history/i)).toBeInTheDocument();
      });

      // Verify past exports
      const historyItems = screen.getAllByTestId(/export-history-item/);
      expect(historyItems).toHaveLength(2);

      // Check expired export
      const expiredExport = screen.getByTestId('export-old-2');
      expect(within(expiredExport).getByText(/expired/i)).toBeInTheDocument();
      expect(within(expiredExport).queryByRole('link', { name: /download/i })).not.toBeInTheDocument();

      // Check valid export
      const validExport = screen.getByTestId('export-old-1');
      expect(within(validExport).getByRole('link', { name: /download/i })).toBeInTheDocument();
    });

    it('should handle export errors and retry', async () => {
      server.use(
        http.post('/api/privacy/export/request', ({ request }) => {
          return HttpResponse.json({ error: 'Export service temporarily unavailable' }, { status: 500 });
        })
      );

      renderWithProviders(<DataExport />);

      await user.click(screen.getByRole('checkbox', { name: /personal information/i }));
      await user.click(screen.getByRole('button', { name: /request export/i }));

      await waitFor(() => {
        expect(screen.getByText(/export.*failed/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      });

      // Reset to success handler and retry
      server.resetHandlers();
      await user.click(screen.getByRole('button', { name: /retry/i }));

      await waitFor(() => {
        expect(screen.getByText(/export requested/i)).toBeInTheDocument();
      });
    });
  });

  describe('Consent Management', () => {
    it('should display and manage consent preferences', async () => {
      renderWithProviders(<ConsentManager />);

      await waitFor(() => {
        expect(screen.getByText(/consent preferences/i)).toBeInTheDocument();
      });

      // Verify consent states
      expect(screen.getByRole('checkbox', { name: /essential services/i })).toBeChecked();
      expect(screen.getByRole('checkbox', { name: /essential services/i })).toBeDisabled(); // Cannot disable
      expect(screen.getByRole('checkbox', { name: /marketing/i })).not.toBeChecked();
      expect(screen.getByRole('checkbox', { name: /analytics/i })).toBeChecked();

      // Toggle marketing consent
      await user.click(screen.getByRole('checkbox', { name: /marketing/i }));

      await waitFor(() => {
        expect(screen.getByText(/consent updated/i)).toBeInTheDocument();
      });

      // Withdraw analytics consent
      await user.click(screen.getByRole('checkbox', { name: /analytics/i }));

      await waitFor(() => {
        expect(screen.getByText(/consent withdrawn/i)).toBeInTheDocument();
      });
    });

    it('should handle bulk consent withdrawal', async () => {
      renderWithProviders(<ConsentManager />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /withdraw all optional/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /withdraw all optional/i }));

      // Confirm action
      await waitFor(() => {
        expect(screen.getByText(/confirm withdrawal/i)).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /yes.*withdraw/i }));

      await waitFor(() => {
        expect(screen.getByText(/2 consents withdrawn/i)).toBeInTheDocument();
        expect(screen.getByRole('checkbox', { name: /marketing/i })).not.toBeChecked();
        expect(screen.getByRole('checkbox', { name: /analytics/i })).not.toBeChecked();
        expect(screen.getByRole('checkbox', { name: /essential/i })).toBeChecked();
      });
    });

    it('should track consent history and versions', async () => {
      renderWithProviders(<ConsentManager showHistory />);

      await user.click(screen.getByRole('tab', { name: /consent history/i }));

      await waitFor(() => {
        expect(screen.getByText(/consent timeline/i)).toBeInTheDocument();
        expect(screen.getByText(/version 1.0/i)).toBeInTheDocument();
        expect(screen.getByText(/granted.*january 1/i)).toBeInTheDocument();
      });

      // View consent details
      await user.click(screen.getByRole('button', { name: /view details.*analytics/i }));

      await waitFor(() => {
        expect(screen.getByText(/purpose.*improve services/i)).toBeInTheDocument();
        expect(screen.getByText(/data used.*usage patterns/i)).toBeInTheDocument();
        expect(screen.getByText(/retention.*2 years/i)).toBeInTheDocument();
      });
    });
  });

  describe('Account Deletion Process', () => {
    it('should complete account deletion request with grace period', async () => {
      renderWithProviders(<AccountDeletion />);

      // View impact analysis first
      await user.click(screen.getByRole('button', { name: /view deletion impact/i }));

      await waitFor(() => {
        expect(screen.getByText(/data to be deleted/i)).toBeInTheDocument();
        expect(screen.getByText(/personal information/i)).toBeInTheDocument();
        expect(screen.getByText(/health assessments/i)).toBeInTheDocument();
        expect(screen.getByText(/data to be retained/i)).toBeInTheDocument();
        expect(screen.getByText(/legal compliance records/i)).toBeInTheDocument();
      });

      // Proceed with deletion
      await user.click(screen.getByRole('button', { name: /proceed with deletion/i }));

      // Fill deletion form
      const reasonSelect = screen.getByLabelText(/reason for deletion/i);
      await user.selectOptions(reasonSelect, 'privacy_concerns');

      const feedbackTextarea = screen.getByLabelText(/additional feedback/i);
      await user.type(feedbackTextarea, 'Want better control over my data');

      // Confirm understanding
      await user.click(screen.getByRole('checkbox', { name: /understand.*permanent/i }));
      await user.click(screen.getByRole('checkbox', { name: /acknowledge.*30 days/i }));

      // Submit request
      await user.click(screen.getByRole('button', { name: /request account deletion/i }));

      await waitFor(() => {
        expect(screen.getByText(/deletion scheduled/i)).toBeInTheDocument();
        expect(screen.getByText(/30 days.*cancel/i)).toBeInTheDocument();
        expect(screen.getByTestId('cancellation-token')).toHaveTextContent('cancel-token-123');
      });

      // Save cancellation token shown
      expect(screen.getByText(/save.*cancellation token/i)).toBeInTheDocument();
    });

    it('should allow cancellation within grace period', async () => {
      renderWithProviders(<AccountDeletion pendingDeletion />);

      await waitFor(() => {
        expect(screen.getByText(/account deletion pending/i)).toBeInTheDocument();
        expect(screen.getByText(/days remaining/i)).toBeInTheDocument();
      });

      // Cancel deletion
      await user.click(screen.getByRole('button', { name: /cancel deletion/i }));

      // Enter cancellation token
      const tokenInput = screen.getByLabelText(/cancellation token/i);
      await user.type(tokenInput, 'cancel-token-123');

      await user.click(screen.getByRole('button', { name: /confirm cancellation/i }));

      await waitFor(() => {
        expect(screen.getByText(/deletion cancelled/i)).toBeInTheDocument();
        expect(screen.getByText(/account.*active/i)).toBeInTheDocument();
      });
    });

    it('should verify cascade deletion effects', async () => {
      renderWithProviders(<AccountDeletion />);

      await user.click(screen.getByRole('button', { name: /check associated services/i }));

      await waitFor(() => {
        expect(screen.getByText(/associated accounts/i)).toBeInTheDocument();
        
        const healthPortal = screen.getByTestId('service-health-portal');
        expect(within(healthPortal).getByText(/will be deleted/i)).toBeInTheDocument();
        
        const documentVault = screen.getByTestId('service-document-vault');
        expect(within(documentVault).getByText(/will be deleted/i)).toBeInTheDocument();
      });

      // Show warning about irreversibility
      expect(screen.getByRole('alert')).toHaveTextContent(/cannot be undone/i);
    });
  });

  describe('Privacy Settings Enforcement', () => {
    it('should enforce privacy settings across features', async () => {
      renderWithProviders(<PrivacySettings />);

      await waitFor(() => {
        expect(screen.getByText(/privacy settings/i)).toBeInTheDocument();
      });

      // Enable strict privacy mode
      await user.click(screen.getByRole('radio', { name: /strict privacy/i }));

      await waitFor(() => {
        expect(screen.getByText(/strict mode enabled/i)).toBeInTheDocument();
        
        // Verify automatic changes
        expect(screen.getByRole('checkbox', { name: /analytics sharing/i })).not.toBeChecked();
        expect(screen.getByRole('checkbox', { name: /improvement program/i })).not.toBeChecked();
        expect(screen.getByRole('checkbox', { name: /marketing/i })).not.toBeChecked();
      });

      // Verify retention period changes
      const healthRetention = screen.getByLabelText(/health data retention/i);
      expect(healthRetention).toHaveValue('minimum_required');
    });

    it('should sync privacy settings across services', async () => {
      renderWithProviders(<PrivacySettings />);

      // Change communication preferences
      await user.click(screen.getByRole('checkbox', { name: /email notifications/i }));
      await user.click(screen.getByRole('checkbox', { name: /sms notifications/i }));

      await user.click(screen.getByRole('button', { name: /save preferences/i }));

      await waitFor(() => {
        expect(screen.getByText(/settings updated/i)).toBeInTheDocument();
        expect(screen.getByText(/syncing across services/i)).toBeInTheDocument();
      });

      // Verify sync completion
      await waitFor(() => {
        expect(screen.getByText(/sync complete/i)).toBeInTheDocument();
      }, { timeout: 3000 });
    });

    it('should provide granular data retention controls', async () => {
      renderWithProviders(<PrivacySettings />);

      await user.click(screen.getByRole('tab', { name: /data retention/i }));

      // Set custom retention periods
      const documentRetention = screen.getByLabelText(/document retention/i);
      await user.selectOptions(documentRetention, '1_year');

      const activityLogRetention = screen.getByLabelText(/activity log retention/i);
      await user.selectOptions(activityLogRetention, '6_months');

      await user.click(screen.getByRole('button', { name: /apply retention settings/i }));

      await waitFor(() => {
        expect(screen.getByText(/retention settings updated/i)).toBeInTheDocument();
        expect(screen.getByText(/automatic deletion scheduled/i)).toBeInTheDocument();
      });
    });
  });

  describe('Data Processing Activity Logs', () => {
    it('should display comprehensive activity logs', async () => {
      renderWithProviders(<ActivityLog />);

      await waitFor(() => {
        expect(screen.getByText(/data processing activities/i)).toBeInTheDocument();
      });

      // Verify activities displayed
      const activities = screen.getAllByTestId(/activity-item/);
      expect(activities).toHaveLength(3);

      // Check activity details
      const firstActivity = activities[0];
      expect(within(firstActivity).getByText(/profile update/i)).toBeInTheDocument();
      expect(within(firstActivity).getByText(/consent/i)).toBeInTheDocument();
      expect(within(firstActivity).getByText(/personal information/i)).toBeInTheDocument();
    });

    it('should filter activities by category and export logs', async () => {
      renderWithProviders(<ActivityLog />);

      // Filter by health data
      const categoryFilter = screen.getByLabelText(/filter by category/i);
      await user.selectOptions(categoryFilter, 'Health Data');

      await waitFor(() => {
        const activities = screen.getAllByTestId(/activity-item/);
        expect(activities).toHaveLength(1);
        expect(activities[0]).toHaveTextContent(/health assessment/i);
      });

      // Export filtered logs
      await user.click(screen.getByRole('button', { name: /export logs/i }));

      await waitFor(() => {
        expect(screen.getByText(/logs exported/i)).toBeInTheDocument();
      });
    });

    it('should show real-time processing notifications', async () => {
      renderWithProviders(<ActivityLog realtime />);

      // Simulate new processing activity
      act(() => {
        window.dispatchEvent(new CustomEvent('privacy:processing', {
          detail: {
            activity: 'Emergency Contact Update',
            purpose: 'User requested update',
            legal_basis: 'Consent',
            data_categories: ['Personal Information'],
          },
        }));
      });

      await waitFor(() => {
        expect(screen.getByText(/new processing activity/i)).toBeInTheDocument();
        expect(screen.getByText(/emergency contact update/i)).toBeInTheDocument();
      });
    });
  });

  describe('Cross-Service Data Consistency', () => {
    it('should show data distribution across services', async () => {
      renderWithProviders(<DataExport showDataMap />);

      await user.click(screen.getByRole('tab', { name: /data map/i }));

      await waitFor(() => {
        expect(screen.getByText(/your data across services/i)).toBeInTheDocument();
      });

      // Verify all services listed
      expect(screen.getByText(/authentication service/i)).toBeInTheDocument();
      expect(screen.getByText(/health service/i)).toBeInTheDocument();
      expect(screen.getByText(/document service/i)).toBeInTheDocument();
      expect(screen.getByText(/gamification service/i)).toBeInTheDocument();

      // Check data categories
      const authService = screen.getByTestId('service-authentication');
      expect(within(authService).getByText(/email.*password.*session/i)).toBeInTheDocument();
    });

    it('should verify consent enforcement across services', async () => {
      renderWithProviders(<ConsentManager />);

      // Withdraw analytics consent
      await user.click(screen.getByRole('checkbox', { name: /analytics/i }));

      await waitFor(() => {
        expect(screen.getByText(/verifying consent propagation/i)).toBeInTheDocument();
      });

      // Check service compliance
      await waitFor(() => {
        const complianceChecks = screen.getAllByTestId(/compliance-check/);
        complianceChecks.forEach(check => {
          expect(within(check).getByText(/✓/)).toBeInTheDocument();
        });
      });
    });
  });
});