import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import WS from 'jest-websocket-mock';
import '@testing-library/jest-dom';

// Components under test
import NotificationCenter from '../../components/notifications/NotificationCenter';
import RealtimeChat from '../../components/chat/RealtimeChat';
import CollaborativeSession from '../../components/collaboration/CollaborativeSession';
import LiveDashboard from '../../components/dashboard/LiveDashboard';

// Types
interface WebSocketMessage {
  type: string;
  payload: any;
  timestamp: string;
  userId?: string;
}

interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  action?: {
    label: string;
    url: string;
  };
}

// Mock WebSocket server
let mockServer: WS;

beforeEach(async () => {
  mockServer = new WS('ws://localhost:8080/ws');
});

afterEach(() => {
  WS.clean();
});

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

// WebSocket connection helper
const waitForSocketConnection = async () => {
  await mockServer.connected;
  return mockServer;
};

describe('Real-time Features Integration', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
    // Mock performance.now for consistent timing
    jest.spyOn(performance, 'now').mockReturnValue(1000);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('WebSocket Connection Management', () => {
    it('should establish and maintain WebSocket connection', async () => {
      renderWithProviders(<NotificationCenter />);

      // Wait for connection
      await waitForSocketConnection();

      // Verify connection status
      expect(screen.getByTestId('connection-status')).toHaveTextContent('Connected');

      // Send heartbeat
      act(() => {
        mockServer.send(
          JSON.stringify({
            type: 'ping',
            timestamp: new Date().toISOString(),
          })
        );
      });

      // Verify pong response
      await expect(mockServer).toReceiveMessage(
        JSON.stringify({
          type: 'pong',
          timestamp: expect.any(String),
        })
      );
    });

    it('should handle connection interruption and reconnection', async () => {
      renderWithProviders(<NotificationCenter />);

      await waitForSocketConnection();

      // Simulate connection loss
      act(() => {
        mockServer.close();
      });

      await waitFor(() => {
        expect(screen.getByTestId('connection-status')).toHaveTextContent('Disconnected');
        expect(screen.getByText(/attempting to reconnect/i)).toBeInTheDocument();
      });

      // Create new server for reconnection
      const newServer = new WS('ws://localhost:8080/ws');

      await waitFor(() => {
        expect(screen.getByTestId('connection-status')).toHaveTextContent('Connected');
      }, { timeout: 5000 });

      newServer.close();
    });

    it('should queue messages during disconnection', async () => {
      renderWithProviders(<RealtimeChat roomId="support-123" />);

      await waitForSocketConnection();

      // Type message
      const messageInput = screen.getByPlaceholderText(/type a message/i);
      await user.type(messageInput, 'Hello support');

      // Disconnect before sending
      act(() => {
        mockServer.close();
      });

      // Try to send message
      await user.click(screen.getByRole('button', { name: /send/i }));

      // Verify message is queued
      expect(screen.getByText(/message will be sent when connected/i)).toBeInTheDocument();
      expect(screen.getByTestId('queued-messages')).toHaveTextContent('1');

      // Reconnect
      const newServer = new WS('ws://localhost:8080/ws');
      await newServer.connected;

      // Verify queued message is sent
      await expect(newServer).toReceiveMessage(
        expect.stringContaining('Hello support')
      );
    });
  });

  describe('Real-time Notification Delivery', () => {
    it('should receive and display notifications in real-time', async () => {
      renderWithProviders(<NotificationCenter />);

      await waitForSocketConnection();

      // Send notification from server
      act(() => {
        mockServer.send(
          JSON.stringify({
            type: 'notification',
            payload: {
              id: 'notif-1',
              type: 'success',
              title: 'Interview Scheduled',
              message: 'Your interview is confirmed for Dec 20 at 10:00 AM',
              timestamp: new Date().toISOString(),
              read: false,
            },
          } as WebSocketMessage)
        );
      });

      // Verify notification appears
      await waitFor(() => {
        expect(screen.getByText(/interview scheduled/i)).toBeInTheDocument();
        expect(screen.getByText(/dec 20 at 10:00 am/i)).toBeInTheDocument();
      });

      // Verify notification count
      expect(screen.getByTestId('unread-count')).toHaveTextContent('1');
    });

    it('should handle notification actions', async () => {
      renderWithProviders(<NotificationCenter />);

      await waitForSocketConnection();

      // Send actionable notification
      act(() => {
        mockServer.send(
          JSON.stringify({
            type: 'notification',
            payload: {
              id: 'notif-2',
              type: 'info',
              title: 'Document Review Required',
              message: 'Please review your uploaded documents',
              timestamp: new Date().toISOString(),
              read: false,
              action: {
                label: 'Review Now',
                url: '/documents',
              },
            },
          })
        );
      });

      await waitFor(() => {
        expect(screen.getByText(/document review required/i)).toBeInTheDocument();
      });

      // Click action button
      const actionButton = screen.getByRole('button', { name: /review now/i });
      await user.click(actionButton);

      // Verify navigation (mocked)
      expect(window.location.pathname).toBe('/documents');
    });

    it('should group and prioritize notifications', async () => {
      renderWithProviders(<NotificationCenter />);

      await waitForSocketConnection();

      // Send multiple notifications
      const notifications = [
        {
          type: 'notification',
          payload: {
            id: 'n1',
            type: 'error',
            title: 'Urgent: Action Required',
            message: 'Your session expires in 5 minutes',
            priority: 'high',
          },
        },
        {
          type: 'notification',
          payload: {
            id: 'n2',
            type: 'info',
            title: 'New Message',
            message: 'You have a new message from HR',
            priority: 'medium',
          },
        },
        {
          type: 'notification',
          payload: {
            id: 'n3',
            type: 'success',
            title: 'Points Earned',
            message: 'You earned 50 points!',
            priority: 'low',
          },
        },
      ];

      act(() => {
        notifications.forEach(notif => {
          mockServer.send(JSON.stringify({
            ...notif,
            payload: {
              ...notif.payload,
              timestamp: new Date().toISOString(),
              read: false,
            },
          }));
        });
      });

      await waitFor(() => {
        const notificationList = screen.getByTestId('notification-list');
        const items = notificationList.querySelectorAll('[data-testid^="notification-"]');
        
        // Verify high priority appears first
        expect(items[0]).toHaveTextContent(/urgent: action required/i);
        expect(items[1]).toHaveTextContent(/new message/i);
        expect(items[2]).toHaveTextContent(/points earned/i);
      });
    });
  });

  describe('Concurrent User Updates', () => {
    it('should handle real-time collaboration in shared sessions', async () => {
      renderWithProviders(
        <CollaborativeSession 
          sessionId="collab-123"
          userId="user-1"
        />
      );

      await waitForSocketConnection();

      // Simulate another user joining
      act(() => {
        mockServer.send(
          JSON.stringify({
            type: 'user_joined',
            payload: {
              userId: 'user-2',
              name: 'John Doe',
              avatar: '/avatars/john.jpg',
            },
          })
        );
      });

      await waitFor(() => {
        expect(screen.getByText(/john doe joined/i)).toBeInTheDocument();
        expect(screen.getByTestId('active-users')).toHaveTextContent('2');
      });

      // Simulate collaborative edit
      act(() => {
        mockServer.send(
          JSON.stringify({
            type: 'content_update',
            payload: {
              userId: 'user-2',
              fieldId: 'address',
              value: '123 Main St',
              cursor: { line: 0, column: 11 },
            },
          })
        );
      });

      await waitFor(() => {
        const addressField = screen.getByLabelText(/address/i);
        expect(addressField).toHaveValue('123 Main St');
        expect(screen.getByTestId('user-2-cursor')).toBeInTheDocument();
      });
    });

    it('should resolve conflicts in concurrent edits', async () => {
      renderWithProviders(
        <CollaborativeSession 
          sessionId="collab-456"
          userId="user-1"
        />
      );

      await waitForSocketConnection();

      // User 1 starts editing
      const nameField = screen.getByLabelText(/name/i);
      await user.type(nameField, 'Alice');

      // Simulate concurrent edit from User 2
      act(() => {
        mockServer.send(
          JSON.stringify({
            type: 'content_update',
            payload: {
              userId: 'user-2',
              fieldId: 'name',
              value: 'Bob',
              version: 2,
            },
          })
        );
      });

      // Verify conflict resolution
      await waitFor(() => {
        expect(screen.getByText(/conflict detected/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /keep mine/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /use theirs/i })).toBeInTheDocument();
      });

      // Resolve conflict
      await user.click(screen.getByRole('button', { name: /merge both/i }));

      await waitFor(() => {
        expect(nameField).toHaveValue('Alice, Bob');
      });
    });
  });

  describe('State Synchronization', () => {
    it('should sync application state across multiple tabs', async () => {
      // Simulate broadcast channel for cross-tab communication
      const broadcastChannel = new BroadcastChannel('app-state');
      const messageHandler = jest.fn();
      broadcastChannel.addEventListener('message', messageHandler);

      renderWithProviders(<LiveDashboard />);

      await waitForSocketConnection();

      // Update state in current tab
      await user.click(screen.getByRole('button', { name: /toggle notifications/i }));

      // Verify broadcast message
      await waitFor(() => {
        expect(messageHandler).toHaveBeenCalledWith(
          expect.objectContaining({
            data: {
              type: 'STATE_UPDATE',
              payload: {
                notifications: { enabled: false },
              },
            },
          })
        );
      });

      broadcastChannel.close();
    });

    it('should maintain state consistency during reconnection', async () => {
      renderWithProviders(<LiveDashboard />);

      await waitForSocketConnection();

      // Set some state
      await user.click(screen.getByRole('button', { name: /start timer/i }));

      await waitFor(() => {
        expect(screen.getByTestId('timer')).toHaveTextContent('00:01');
      });

      // Disconnect
      act(() => {
        mockServer.close();
      });

      // Wait a bit (timer should continue)
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Reconnect
      const newServer = new WS('ws://localhost:8080/ws');
      await newServer.connected;

      // Verify state sync request
      await expect(newServer).toReceiveMessage(
        JSON.stringify({
          type: 'state_sync',
          payload: {
            timer: expect.objectContaining({
              running: true,
              elapsed: expect.any(Number),
            }),
          },
        })
      );
    });
  });

  describe('Message Queuing and Delivery', () => {
    it('should ensure message delivery order', async () => {
      renderWithProviders(<RealtimeChat roomId="chat-123" />);

      await waitForSocketConnection();

      const messages = ['First', 'Second', 'Third'];
      const messageInput = screen.getByPlaceholderText(/type a message/i);

      // Send messages rapidly
      for (const msg of messages) {
        await user.clear(messageInput);
        await user.type(messageInput, msg);
        await user.click(screen.getByRole('button', { name: /send/i }));
      }

      // Verify messages sent in order
      const sentMessages: string[] = [];
      mockServer.on('message', (data) => {
        const parsed = JSON.parse(data as string);
        if (parsed.type === 'chat_message') {
          sentMessages.push(parsed.payload.text);
        }
      });

      await waitFor(() => {
        expect(sentMessages).toEqual(messages);
      });

      // Verify display order
      const displayedMessages = screen.getAllByTestId(/^message-/);
      expect(displayedMessages[0]).toHaveTextContent('First');
      expect(displayedMessages[1]).toHaveTextContent('Second');
      expect(displayedMessages[2]).toHaveTextContent('Third');
    });

    it('should handle message acknowledgments and retries', async () => {
      renderWithProviders(<RealtimeChat roomId="chat-456" />);

      await waitForSocketConnection();

      // Send message
      const messageInput = screen.getByPlaceholderText(/type a message/i);
      await user.type(messageInput, 'Important message');
      await user.click(screen.getByRole('button', { name: /send/i }));

      // Don't acknowledge first attempt
      let messageId: string;
      mockServer.on('message', (data) => {
        const parsed = JSON.parse(data as string);
        if (parsed.type === 'chat_message') {
          messageId = parsed.id;
        }
      });

      // Wait for retry
      await waitFor(() => {
        const pendingIndicator = screen.getByTestId(`pending-${messageId}`);
        expect(pendingIndicator).toBeInTheDocument();
      });

      // Acknowledge on retry
      act(() => {
        mockServer.send(
          JSON.stringify({
            type: 'message_ack',
            payload: {
              messageId,
              status: 'delivered',
            },
          })
        );
      });

      // Verify delivery confirmation
      await waitFor(() => {
        expect(screen.getByTestId(`delivered-${messageId}`)).toBeInTheDocument();
      });
    });
  });

  describe('Performance Under Load', () => {
    it('should handle high-frequency updates efficiently', async () => {
      renderWithProviders(<LiveDashboard />);

      await waitForSocketConnection();

      const startTime = performance.now();
      
      // Simulate rapid updates
      act(() => {
        for (let i = 0; i < 100; i++) {
          mockServer.send(
            JSON.stringify({
              type: 'metrics_update',
              payload: {
                activeUsers: Math.floor(Math.random() * 1000),
                requestsPerSecond: Math.floor(Math.random() * 100),
                avgResponseTime: Math.random() * 500,
              },
            })
          );
        }
      });

      // Verify UI remains responsive
      await waitFor(() => {
        const metricsDisplay = screen.getByTestId('metrics-display');
        expect(metricsDisplay).toBeInTheDocument();
      });

      const endTime = performance.now();
      const processingTime = endTime - startTime;

      // Should process 100 updates in under 1 second
      expect(processingTime).toBeLessThan(1000);

      // Verify no dropped frames (check render count)
      const renderCount = screen.getByTestId('render-count');
      expect(parseInt(renderCount.textContent!)).toBeLessThan(10); // Batched updates
    });

    it('should throttle non-critical updates', async () => {
      renderWithProviders(<NotificationCenter />);

      await waitForSocketConnection();

      let updateCount = 0;
      const updateHandler = jest.fn();

      // Monitor DOM updates
      const observer = new MutationObserver(updateHandler);
      observer.observe(document.body, { childList: true, subtree: true });

      // Send many low-priority notifications
      act(() => {
        for (let i = 0; i < 50; i++) {
          mockServer.send(
            JSON.stringify({
              type: 'notification',
              payload: {
                id: `low-${i}`,
                type: 'info',
                title: `Update ${i}`,
                message: 'Low priority update',
                priority: 'low',
              },
            })
          );
        }
      });

      await new Promise(resolve => setTimeout(resolve, 500));

      // Should batch updates
      expect(updateHandler).toHaveBeenCalledTimes(expect.any(Number));
      expect(updateHandler.mock.calls.length).toBeLessThan(10); // Throttled

      observer.disconnect();
    });
  });
});