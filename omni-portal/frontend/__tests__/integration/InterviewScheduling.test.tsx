import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { format, addDays, setHours, setMinutes } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import '@testing-library/jest-dom';

// Component under test - Updated to use new InterviewUnlockCard
import InterviewUnlockCard from '../../components/dashboard/InterviewUnlockCard';
// Note: InterviewScheduler component has been replaced with InterviewUnlockCard + telemedicine-schedule flow

// Types
interface InterviewSlot {
  id: string;
  date: string;
  time: string;
  available: boolean;
  timezone: string;
  interviewer?: {
    id: string;
    name: string;
    role: string;
  };
}

interface ScheduledInterview {
  id: string;
  slot_id: string;
  user_id: string;
  scheduled_at: string;
  meeting_url: string;
  status: 'scheduled' | 'confirmed' | 'cancelled' | 'completed';
  reminder_sent: boolean;
}

// MSW Server Setup
const server = setupServer(
  // Get available slots
  http.get('/api/interviews/slots', ({ request }) => {
    const date = request.url.searchParams.get('date');
    const timezone = request.url.searchParams.get('timezone') || 'America/Sao_Paulo';
    
    const slots: InterviewSlot[] = [];
    const baseDate = date ? new Date(date) : new Date();
    
    // Generate slots for the next 7 days
    for (let day = 0; day < 7; day++) {
      const currentDate = addDays(baseDate, day);
      const dateStr = format(currentDate, 'yyyy-MM-dd');
      
      // Morning slots (9-12)
      for (let hour = 9; hour < 12; hour++) {
        slots.push({
          id: `slot-${dateStr}-${hour}00`,
          date: dateStr,
          time: `${hour.toString().padStart(2, '0')}:00`,
          available: Math.random() > 0.3, // 70% availability
          timezone,
          interviewer: {
            id: `interviewer-${hour}`,
            name: `Interviewer ${hour}`,
            role: 'HR Specialist',
          },
        });
      }
      
      // Afternoon slots (14-17)
      for (let hour = 14; hour < 17; hour++) {
        slots.push({
          id: `slot-${dateStr}-${hour}00`,
          date: dateStr,
          time: `${hour.toString().padStart(2, '0')}:00`,
          available: Math.random() > 0.4, // 60% availability
          timezone,
          interviewer: {
            id: `interviewer-${hour}`,
            name: `Interviewer ${hour}`,
            role: 'Technical Lead',
          },
        });
      }
    }
    
    return HttpResponse.json({ slots });
  }),

  // Check slot availability (real-time)
  http.get('/api/interviews/slots/:slotId/availability', ({ request }) => {
    const { slotId } = req.params;
    
    // Simulate real-time availability check
    return res(
      ctx.json({
        slot_id: slotId,
        available: Math.random() > 0.1, // 90% still available
        last_checked: new Date().toISOString(),
      })
    );
  }),

  // Schedule interview
  http.post('/api/interviews/schedule', async ({ request }) => {
    const { slot_id, user_preferences } = await request.json();
    
    // Simulate conflict detection
    if (slot_id === 'slot-conflict') {
      return HttpResponse.json({
          error: 'SLOT_UNAVAILABLE',
          message: 'This slot was just booked by another user',
          alternative_slots: [
            'slot-2024-12-20-1100',
            'slot-2024-12-20-1500',
          ],
        }, { status: 409 });
    }
    
    return res(
      ctx.json<ScheduledInterview>({
        id: 'interview-123',
        slot_id,
        user_id: 'user-123',
        scheduled_at: new Date().toISOString(),
        meeting_url: 'https://meet.example.com/interview-123',
        status: 'scheduled',
        reminder_sent: false,
      })
    );
  }),

  // Reschedule interview
  http.put('/api/interviews/:interviewId/reschedule', async ({ request }) => {
    const { interviewId } = req.params;
    const { new_slot_id, reason } = await request.json();
    
    return HttpResponse.json({
        success: true,
        interview: {
          id: interviewId,
          slot_id: new_slot_id,
          status: 'scheduled',
          rescheduled: true,
          reschedule_count: 1,
          reschedule_reason: reason,
        },
      });
  }),

  // Cancel interview
  http.delete('/api/interviews/:interviewId', async ({ request }) => {
    const { interviewId } = req.params;
    const { reason } = await request.json();
    
    return res(
      ctx.json({
        success: true,
        interview: {
          id: interviewId,
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          cancellation_reason: reason,
        },
      })
    );
  }),

  // Get AI slot recommendations
  http.get('/api/interviews/recommendations', ({ request }) => {
    const user_id = request.url.searchParams.get('user_id');
    
    return HttpResponse.json({
        recommendations: [
          {
            slot_id: 'slot-2024-12-20-1000',
            score: 0.95,
            reasons: [
              'Morning slots have higher attendance rates',
              'This interviewer has expertise matching your profile',
              'Minimal conflicts with typical work schedules',
            ],
          },
          {
            slot_id: 'slot-2024-12-21-1400',
            score: 0.85,
            reasons: [
              'Good availability for follow-up questions',
              'Interviewer specializes in your area',
            ],
          },
        ],
      });
  }),

  // Send notifications
  http.post('/api/interviews/:interviewId/notify', async ({ request }) => {
    const { interviewId } = req.params;
    const { type, channels } = await request.json();
    
    return res(
      ctx.json({
        success: true,
        notifications: {
          email: channels.includes('email'),
          sms: channels.includes('sms'),
          push: channels.includes('push'),
        },
        sent_at: new Date().toISOString(),
      })
    );
  })
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
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

describe('Interview Scheduling System Integration', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
    jest.clearAllMocks();
  });

  describe('Slot Availability', () => {
    it('should display available interview slots across multiple timezones', async () => {
      renderWithProviders(<InterviewScheduler />);

      // Wait for slots to load
      await waitFor(() => {
        expect(screen.getByText(/available interview slots/i)).toBeInTheDocument();
      });

      // Verify slots are displayed
      const slots = await screen.findAllByRole('button', { name: /book.*slot/i });
      expect(slots.length).toBeGreaterThan(0);

      // Change timezone
      const timezoneSelect = screen.getByLabelText(/timezone/i);
      await user.selectOptions(timezoneSelect, 'America/New_York');

      // Verify slots refresh with new timezone
      await waitFor(() => {
        expect(screen.getByText(/eastern time/i)).toBeInTheDocument();
      });
    });

    it('should show real-time slot availability updates', async () => {
      renderWithProviders(<InterviewScheduler />);

      await waitFor(() => {
        expect(screen.getByText(/available interview slots/i)).toBeInTheDocument();
      });

      // Select a slot
      const availableSlot = screen.getAllByRole('button', { name: /book.*slot/i })[0];
      await user.click(availableSlot);

      // Verify real-time availability check
      await waitFor(() => {
        expect(screen.getByText(/checking availability/i)).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(screen.getByText(/slot confirmed available/i)).toBeInTheDocument();
      });
    });

    it('should filter slots by date range and availability', async () => {
      renderWithProviders(<InterviewCalendar />);

      // Select date range
      const startDateInput = screen.getByLabelText(/start date/i);
      const endDateInput = screen.getByLabelText(/end date/i);
      
      const today = new Date();
      const nextWeek = addDays(today, 7);
      
      await user.type(startDateInput, format(today, 'dd/MM/yyyy'));
      await user.type(endDateInput, format(nextWeek, 'dd/MM/yyyy'));

      // Apply filters
      await user.click(screen.getByRole('button', { name: /apply filters/i }));

      // Verify filtered results
      await waitFor(() => {
        const slots = screen.getAllByTestId('interview-slot');
        slots.forEach(slot => {
          const slotDate = slot.getAttribute('data-date');
          expect(new Date(slotDate!)).toBeGreaterThanOrEqual(today);
          expect(new Date(slotDate!)).toBeLessThanOrEqual(nextWeek);
        });
      });
    });
  });

  describe('Conflict Detection and Resolution', () => {
    it('should detect and handle scheduling conflicts', async () => {
      server.use(
        http.post('/api/interviews/schedule', ({ request }) => {
          return HttpResponse.json({
              error: 'SLOT_UNAVAILABLE',
              message: 'This slot was just booked',
              alternative_slots: [
                'slot-2024-12-20-1100',
                'slot-2024-12-20-1500',
              ],
            }, { status: 409 });
        })
      );

      renderWithProviders(<InterviewScheduler />);

      // Try to book a slot
      await waitFor(() => {
        expect(screen.getByText(/available interview slots/i)).toBeInTheDocument();
      });

      const slot = screen.getAllByRole('button', { name: /book.*slot/i })[0];
      await user.click(slot);
      await user.click(screen.getByRole('button', { name: /confirm booking/i }));

      // Verify conflict message
      await waitFor(() => {
        expect(screen.getByText(/slot.*just booked/i)).toBeInTheDocument();
        expect(screen.getByText(/alternative slots available/i)).toBeInTheDocument();
      });

      // Select alternative slot
      const alternativeSlot = screen.getByRole('button', { name: /11:00/i });
      await user.click(alternativeSlot);
      
      server.resetHandlers(); // Reset to normal behavior
      
      await user.click(screen.getByRole('button', { name: /book alternative/i }));

      await waitFor(() => {
        expect(screen.getByText(/interview scheduled successfully/i)).toBeInTheDocument();
      });
    });

    it('should prevent double-booking for the same user', async () => {
      renderWithProviders(<InterviewScheduler hasExistingInterview />);

      await waitFor(() => {
        expect(screen.getByText(/you already have an interview scheduled/i)).toBeInTheDocument();
      });

      // Verify reschedule option is available
      expect(screen.getByRole('button', { name: /reschedule/i })).toBeInTheDocument();
    });
  });

  describe('Notification Delivery', () => {
    it('should send multi-channel notifications after scheduling', async () => {
      renderWithProviders(<InterviewScheduler />);

      // Schedule interview
      await waitFor(() => {
        expect(screen.getByText(/available interview slots/i)).toBeInTheDocument();
      });

      const slot = screen.getAllByRole('button', { name: /book.*slot/i })[0];
      await user.click(slot);

      // Configure notifications
      const emailCheckbox = screen.getByRole('checkbox', { name: /email notification/i });
      const smsCheckbox = screen.getByRole('checkbox', { name: /sms notification/i });
      const pushCheckbox = screen.getByRole('checkbox', { name: /push notification/i });

      expect(emailCheckbox).toBeChecked(); // Default
      await user.click(smsCheckbox);
      await user.click(pushCheckbox);

      await user.click(screen.getByRole('button', { name: /confirm booking/i }));

      // Verify notifications sent
      await waitFor(() => {
        expect(screen.getByText(/notifications sent/i)).toBeInTheDocument();
        expect(screen.getByText(/email.*sent/i)).toBeInTheDocument();
        expect(screen.getByText(/sms.*sent/i)).toBeInTheDocument();
        expect(screen.getByText(/push.*sent/i)).toBeInTheDocument();
      });
    });

    it('should handle notification delivery failures gracefully', async () => {
      server.use(
        http.post('/api/interviews/:interviewId/notify', ({ request }) => {
          return HttpResponse.json({ error: 'SMS_SERVICE_DOWN' }, { status: 500 });
        })
      );

      renderWithProviders(<InterviewConfirmation interviewId="123" />);

      await user.click(screen.getByRole('button', { name: /send reminders/i }));

      await waitFor(() => {
        expect(screen.getByText(/some notifications failed/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /retry failed/i })).toBeInTheDocument();
      });
    });
  });

  describe('Rescheduling Impact', () => {
    it('should handle interview rescheduling with proper notifications', async () => {
      renderWithProviders(
        <InterviewConfirmation 
          interviewId="existing-123"
          scheduled={{
            date: '2024-12-20',
            time: '10:00',
            interviewer: 'John Doe',
          }}
        />
      );

      // Initiate reschedule
      await user.click(screen.getByRole('button', { name: /reschedule/i }));

      // Select reason
      const reasonSelect = screen.getByLabelText(/reason for rescheduling/i);
      await user.selectOptions(reasonSelect, 'conflict');

      // Select new slot
      await waitFor(() => {
        expect(screen.getByText(/select new time/i)).toBeInTheDocument();
      });

      const newSlot = screen.getByRole('button', { name: /december 21.*14:00/i });
      await user.click(newSlot);

      await user.click(screen.getByRole('button', { name: /confirm reschedule/i }));

      // Verify rescheduling success
      await waitFor(() => {
        expect(screen.getByText(/interview rescheduled/i)).toBeInTheDocument();
        expect(screen.getByText(/all parties notified/i)).toBeInTheDocument();
      });
    });

    it('should enforce rescheduling limits', async () => {
      renderWithProviders(
        <InterviewConfirmation 
          interviewId="max-resched-123"
          rescheduleCount={2} // Already rescheduled twice
        />
      );

      await user.click(screen.getByRole('button', { name: /reschedule/i }));

      await waitFor(() => {
        expect(screen.getByText(/maximum reschedules reached/i)).toBeInTheDocument();
        expect(screen.getByText(/please contact support/i)).toBeInTheDocument();
      });
    });
  });

  describe('AI-Powered Slot Recommendations', () => {
    it('should show personalized slot recommendations', async () => {
      renderWithProviders(<InterviewScheduler userId="user-123" />);

      await waitFor(() => {
        expect(screen.getByText(/recommended for you/i)).toBeInTheDocument();
      });

      // Verify recommendations are shown
      const recommendedSlots = screen.getAllByTestId('recommended-slot');
      expect(recommendedSlots).toHaveLength(2);

      // Verify recommendation reasons
      const firstRecommendation = recommendedSlots[0];
      within(firstRecommendation).getByText(/morning slots.*higher attendance/i);
      within(firstRecommendation).getByText(/95% match/i);
    });

    it('should update recommendations based on user preferences', async () => {
      renderWithProviders(<InterviewScheduler userId="user-123" />);

      // Set preference for afternoon
      const preferenceSelect = screen.getByLabelText(/preferred time/i);
      await user.selectOptions(preferenceSelect, 'afternoon');

      // Trigger recommendation update
      await user.click(screen.getByRole('button', { name: /update recommendations/i }));

      await waitFor(() => {
        const recommendations = screen.getAllByTestId('recommended-slot');
        recommendations.forEach(rec => {
          const time = within(rec).getByText(/\d{2}:\d{2}/);
          const hour = parseInt(time.textContent!.split(':')[0]);
          expect(hour).toBeGreaterThanOrEqual(12);
        });
      });
    });
  });

  describe('Calendar Synchronization', () => {
    it('should export scheduled interview to calendar', async () => {
      renderWithProviders(
        <InterviewConfirmation 
          interviewId="export-123"
          scheduled={{
            date: '2024-12-20',
            time: '10:00',
            meeting_url: 'https://meet.example.com/123',
          }}
        />
      );

      // Export to calendar
      await user.click(screen.getByRole('button', { name: /add to calendar/i }));

      // Verify calendar options
      expect(screen.getByRole('link', { name: /google calendar/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /outlook/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /download ics/i })).toBeInTheDocument();

      // Download ICS file
      const downloadButton = screen.getByRole('button', { name: /download ics/i });
      await user.click(downloadButton);

      // Verify download initiated (would need to mock window.URL.createObjectURL)
      await waitFor(() => {
        expect(screen.getByText(/calendar file downloaded/i)).toBeInTheDocument();
      });
    });

    it('should handle timezone conversions for calendar export', async () => {
      renderWithProviders(
        <InterviewConfirmation 
          interviewId="tz-123"
          scheduled={{
            date: '2024-12-20',
            time: '10:00',
            timezone: 'America/Sao_Paulo',
          }}
        />
      );

      // Change user timezone
      const timezoneSelect = screen.getByLabelText(/your timezone/i);
      await user.selectOptions(timezoneSelect, 'Europe/London');

      // Verify time conversion
      await waitFor(() => {
        expect(screen.getByText(/13:00.*london time/i)).toBeInTheDocument();
        expect(screen.getByText(/10:00.*são paulo time/i)).toBeInTheDocument();
      });
    });
  });
});