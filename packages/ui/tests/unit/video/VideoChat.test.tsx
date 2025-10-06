import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VideoChat } from '../../../src/video/VideoChat';
import {
  createMockVideoChatProps,
  createMockChatMessage,
  setupVideoMocks,
  cleanupVideoMocks,
} from '../../helpers/video-mocks';

describe('VideoChat', () => {
  beforeEach(() => {
    setupVideoMocks();
  });

  afterEach(() => {
    cleanupVideoMocks();
  });

  describe('Rendering', () => {
    it('renders the video chat interface when visible', () => {
      const props = createMockVideoChatProps({ isVisible: true });
      render(<VideoChat {...props} />);

      expect(screen.getByRole('region', { name: /video chat session/i })).toBeInTheDocument();
      expect(screen.getByText(/session chat/i)).toBeInTheDocument();
    });

    it('does not render when not visible', () => {
      const props = createMockVideoChatProps({ isVisible: false });
      render(<VideoChat {...props} />);

      expect(screen.queryByRole('region', { name: /video chat session/i })).not.toBeInTheDocument();
    });

    it('displays encryption status badges correctly', () => {
      const props = createMockVideoChatProps({
        encryptionStatus: { ready: true, verified: true, channelState: 'open' },
      });
      render(<VideoChat {...props} />);

      expect(screen.getByLabelText(/end-to-end encrypted/i)).toBeInTheDocument();
    });

    it('displays server encryption when E2E not ready', () => {
      const props = createMockVideoChatProps({
        encryptionStatus: { ready: false, verified: false, channelState: 'open' },
      });
      render(<VideoChat {...props} />);

      expect(screen.getByLabelText(/server encrypted/i)).toBeInTheDocument();
    });

    it('displays close button', () => {
      const props = createMockVideoChatProps();
      render(<VideoChat {...props} />);

      expect(screen.getByLabelText(/close chat/i)).toBeInTheDocument();
    });
  });

  describe('Error Display', () => {
    it('displays error message when error is present', () => {
      const error = { message: 'Connection failed', code: 'CONN_ERROR' };
      const props = createMockVideoChatProps({ error });
      render(<VideoChat {...props} />);

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/connection failed/i)).toBeInTheDocument();
    });

    it('does not display error when no error', () => {
      const props = createMockVideoChatProps({ error: null });
      render(<VideoChat {...props} />);

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  describe('Message Display', () => {
    it('displays loading state when loading', () => {
      const props = createMockVideoChatProps({
        isLoading: true,
        messages: [],
      });
      render(<VideoChat {...props} />);

      expect(screen.getByText(/loading chat/i)).toBeInTheDocument();
      expect(screen.getByRole('log')).toHaveAttribute('aria-live', 'polite');
    });

    it('displays empty state when no messages', () => {
      const props = createMockVideoChatProps({
        isLoading: false,
        messages: [],
      });
      render(<VideoChat {...props} />);

      expect(screen.getByText(/secure chat is ready/i)).toBeInTheDocument();
      expect(screen.getByText(/messages are end-to-end encrypted/i)).toBeInTheDocument();
    });

    it('displays messages correctly', () => {
      const message = createMockChatMessage({
        content: 'Test message content',
        sender: { id: 'other-user', name: 'Other User', role: 'doctor' },
      });
      const props = createMockVideoChatProps({
        messages: [message],
        currentUser: { id: 'current-user', name: 'Current User', role: 'patient' },
      });
      render(<VideoChat {...props} />);

      expect(screen.getByText(/test message content/i)).toBeInTheDocument();
      expect(screen.getByText(/other user/i)).toBeInTheDocument();
    });

    it('styles own messages differently', () => {
      const ownMessage = createMockChatMessage({
        content: 'My message',
        sender: { id: 'current-user', name: 'Current User', role: 'patient' },
      });
      const props = createMockVideoChatProps({
        messages: [ownMessage],
        currentUser: { id: 'current-user', name: 'Current User', role: 'patient' },
      });
      render(<VideoChat {...props} />);

      const messageContainer = screen.getByRole('article');
      expect(messageContainer).toHaveClass('justify-end');
    });

    it('styles other messages differently', () => {
      const otherMessage = createMockChatMessage({
        content: 'Other message',
        sender: { id: 'other-user', name: 'Other User', role: 'doctor' },
      });
      const props = createMockVideoChatProps({
        messages: [otherMessage],
        currentUser: { id: 'current-user', name: 'Current User', role: 'patient' },
      });
      render(<VideoChat {...props} />);

      const messageContainer = screen.getByRole('article');
      expect(messageContainer).toHaveClass('justify-start');
    });

    it('displays emergency messages with special styling', () => {
      const emergencyMessage = createMockChatMessage({
        content: 'Emergency message',
        type: 'emergency',
        sender: { id: 'other-user', name: 'Other User', role: 'patient' },
      });
      const props = createMockVideoChatProps({
        messages: [emergencyMessage],
        currentUser: { id: 'current-user', name: 'Current User', role: 'doctor' },
      });
      render(<VideoChat {...props} />);

      const messageElement = screen.getByText(/emergency message/i).parentElement;
      expect(messageElement).toHaveClass('bg-red-100', 'border-red-300', 'text-red-800');
    });

    it('displays system messages with special styling', () => {
      const systemMessage = createMockChatMessage({
        content: 'System notification',
        type: 'system',
      });
      const props = createMockVideoChatProps({
        messages: [systemMessage],
      });
      render(<VideoChat {...props} />);

      const messageElement = screen.getByText(/system notification/i).parentElement;
      expect(messageElement).toHaveClass('bg-gray-100', 'text-gray-700', 'text-center');
    });

    it('formats timestamps correctly', () => {
      const message = createMockChatMessage({
        timestamp: new Date('2023-10-02T14:30:00'),
      });
      const props = createMockVideoChatProps({ messages: [message] });
      render(<VideoChat {...props} />);

      expect(screen.getByText(/2:30 PM/i)).toBeInTheDocument();
    });

    it('displays encryption indicators on messages', () => {
      const message = createMockChatMessage({
        encrypted: true,
        encryptionVerified: true,
      });
      const props = createMockVideoChatProps({ messages: [message] });
      render(<VideoChat {...props} />);

      expect(screen.getByLabelText(/end-to-end encrypted/i)).toBeInTheDocument();
    });

    it('displays server encryption indicator when not E2E verified', () => {
      const message = createMockChatMessage({
        encrypted: true,
        encryptionVerified: false,
      });
      const props = createMockVideoChatProps({ messages: [message] });
      render(<VideoChat {...props} />);

      expect(screen.getByLabelText(/server encrypted/i)).toBeInTheDocument();
    });
  });

  describe('Sender Role Styling', () => {
    it('applies correct color for doctor role', () => {
      const message = createMockChatMessage({
        sender: { id: 'doc-1', name: 'Dr. Test', role: 'doctor' },
      });
      const props = createMockVideoChatProps({
        messages: [message],
        currentUser: { id: 'patient-1', name: 'Patient', role: 'patient' },
      });
      render(<VideoChat {...props} />);

      const senderName = screen.getByText(/dr\. test/i);
      expect(senderName).toHaveClass('text-blue-600');
    });

    it('applies correct color for patient role', () => {
      const message = createMockChatMessage({
        sender: { id: 'patient-1', name: 'Patient Test', role: 'patient' },
      });
      const props = createMockVideoChatProps({
        messages: [message],
        currentUser: { id: 'doc-1', name: 'Doctor', role: 'doctor' },
      });
      render(<VideoChat {...props} />);

      const senderName = screen.getByText(/patient test/i);
      expect(senderName).toHaveClass('text-green-600');
    });

    it('applies correct color for moderator role', () => {
      const message = createMockChatMessage({
        sender: { id: 'mod-1', name: 'Moderator Test', role: 'moderator' },
      });
      const props = createMockVideoChatProps({
        messages: [message],
        currentUser: { id: 'patient-1', name: 'Patient', role: 'patient' },
      });
      render(<VideoChat {...props} />);

      const senderName = screen.getByText(/moderator test/i);
      expect(senderName).toHaveClass('text-purple-600');
    });
  });

  describe('Typing Indicator', () => {
    it('displays typing indicator for single user', () => {
      const props = createMockVideoChatProps({
        typingUsers: ['Dr. Smith'],
      });
      render(<VideoChat {...props} />);

      expect(screen.getByText(/dr\. smith is typing\.\.\./i)).toBeInTheDocument();
    });

    it('displays typing indicator for multiple users', () => {
      const props = createMockVideoChatProps({
        typingUsers: ['Dr. Smith', 'Nurse Johnson'],
      });
      render(<VideoChat {...props} />);

      expect(screen.getByText(/dr\. smith, nurse johnson are typing\.\.\./i)).toBeInTheDocument();
    });

    it('does not display typing indicator when no one is typing', () => {
      const props = createMockVideoChatProps({
        typingUsers: [],
      });
      render(<VideoChat {...props} />);

      expect(screen.queryByText(/typing\.\.\./i)).not.toBeInTheDocument();
    });
  });

  describe('Message Input', () => {
    it('allows typing in the message input', async () => {
      const props = createMockVideoChatProps();
      render(<VideoChat {...props} />);

      const input = screen.getByLabelText(/type a secure message/i);
      await userEvent.type(input, 'Test message');

      expect(input).toHaveValue('Test message');
    });

    it('calls onSendMessage when send button is clicked', async () => {
      const mockSendMessage = vi.fn().mockResolvedValue(undefined);
      const props = createMockVideoChatProps({
        onSendMessage: mockSendMessage,
      });
      render(<VideoChat {...props} />);

      const input = screen.getByLabelText(/type a secure message/i);
      const sendButton = screen.getByLabelText(/send message/i);

      await userEvent.type(input, 'Test message');
      await userEvent.click(sendButton);

      expect(mockSendMessage).toHaveBeenCalledWith('Test message', 'text');
    });

    it('calls onSendMessage when Enter key is pressed', async () => {
      const mockSendMessage = vi.fn().mockResolvedValue(undefined);
      const props = createMockVideoChatProps({
        onSendMessage: mockSendMessage,
      });
      render(<VideoChat {...props} />);

      const input = screen.getByLabelText(/type a secure message/i);
      await userEvent.type(input, 'Test message');
      await userEvent.keyboard('{Enter}');

      expect(mockSendMessage).toHaveBeenCalledWith('Test message', 'text');
    });

    it('does not send message when Shift+Enter is pressed', async () => {
      const mockSendMessage = vi.fn();
      const props = createMockVideoChatProps({
        onSendMessage: mockSendMessage,
      });
      render(<VideoChat {...props} />);

      const input = screen.getByLabelText(/type a secure message/i);
      await userEvent.type(input, 'Test message');
      await userEvent.keyboard('{Shift>}{Enter}{/Shift}');

      expect(mockSendMessage).not.toHaveBeenCalled();
    });

    it('disables send button when no message content', () => {
      const props = createMockVideoChatProps();
      render(<VideoChat {...props} />);

      const sendButton = screen.getByLabelText(/send message/i);
      expect(sendButton).toBeDisabled();
    });

    it('disables send button when sending', async () => {
      let resolveSend: (value: void) => void;
      const sendPromise = new Promise<void>((resolve) => {
        resolveSend = resolve;
      });
      const mockSendMessage = vi.fn().mockReturnValue(sendPromise);

      const props = createMockVideoChatProps({
        onSendMessage: mockSendMessage,
      });
      render(<VideoChat {...props} />);

      const input = screen.getByLabelText(/type a secure message/i);
      const sendButton = screen.getByLabelText(/send message/i);

      await userEvent.type(input, 'Test message');
      await userEvent.click(sendButton);

      expect(sendButton).toBeDisabled();

      // Resolve the promise to finish sending
      resolveSend();
      await waitFor(() => {
        expect(sendButton).not.toBeDisabled();
      });
    });

    it('clears input after successful send', async () => {
      const mockSendMessage = vi.fn().mockResolvedValue(undefined);
      const props = createMockVideoChatProps({
        onSendMessage: mockSendMessage,
      });
      render(<VideoChat {...props} />);

      const input = screen.getByLabelText(/type a secure message/i);
      const sendButton = screen.getByLabelText(/send message/i);

      await userEvent.type(input, 'Test message');
      await userEvent.click(sendButton);

      await waitFor(() => {
        expect(input).toHaveValue('');
      });
    });

    it('restores message on send failure', async () => {
      const mockSendMessage = vi.fn().mockRejectedValue(new Error('Send failed'));
      const props = createMockVideoChatProps({
        onSendMessage: mockSendMessage,
      });
      render(<VideoChat {...props} />);

      const input = screen.getByLabelText(/type a secure message/i);
      const sendButton = screen.getByLabelText(/send message/i);

      await userEvent.type(input, 'Test message');
      await userEvent.click(sendButton);

      await waitFor(() => {
        expect(input).toHaveValue('Test message');
      });
    });
  });

  describe('Typing Behavior', () => {
    it('calls onTypingChange when user starts typing', async () => {
      const mockTypingChange = vi.fn();
      const props = createMockVideoChatProps({
        onTypingChange: mockTypingChange,
      });
      render(<VideoChat {...props} />);

      const input = screen.getByLabelText(/type a secure message/i);
      await userEvent.type(input, 'T');

      expect(mockTypingChange).toHaveBeenCalledWith(true);
    });

    it('automatically clears typing state after timeout', async () => {
      vi.useFakeTimers();

      const mockTypingChange = vi.fn();
      const props = createMockVideoChatProps({
        onTypingChange: mockTypingChange,
      });
      render(<VideoChat {...props} />);

      const input = screen.getByLabelText(/type a secure message/i);
      await userEvent.type(input, 'Test');

      // Fast-forward 3 seconds
      vi.advanceTimersByTime(3000);

      expect(mockTypingChange).toHaveBeenCalledWith(false);

      vi.useRealTimers();
    });
  });

  describe('Emergency Button', () => {
    it('shows emergency button for patient role', () => {
      const props = createMockVideoChatProps({
        currentUser: { id: 'patient-1', name: 'Patient', role: 'patient' },
      });
      render(<VideoChat {...props} />);

      expect(screen.getByLabelText(/send emergency alert/i)).toBeInTheDocument();
    });

    it('hides emergency button for non-patient roles', () => {
      const props = createMockVideoChatProps({
        currentUser: { id: 'doc-1', name: 'Doctor', role: 'doctor' },
      });
      render(<VideoChat {...props} />);

      expect(screen.queryByLabelText(/send emergency alert/i)).not.toBeInTheDocument();
    });

    it('sends emergency message when clicked', async () => {
      const mockSendMessage = vi.fn().mockResolvedValue(undefined);
      const props = createMockVideoChatProps({
        currentUser: { id: 'patient-1', name: 'Patient', role: 'patient' },
        onSendMessage: mockSendMessage,
      });
      render(<VideoChat {...props} />);

      const emergencyButton = screen.getByLabelText(/send emergency alert/i);
      await userEvent.click(emergencyButton);

      expect(mockSendMessage).toHaveBeenCalledWith('EMERGENCY: Immediate assistance required', 'emergency');
    });
  });

  describe('Encryption Status Display', () => {
    it('displays E2E encryption when ready', () => {
      const props = createMockVideoChatProps({
        encryptionStatus: { ready: true, verified: true, channelState: 'open' },
      });
      render(<VideoChat {...props} />);

      expect(screen.getByText(/e2e encrypted/i)).toBeInTheDocument();
    });

    it('displays connecting state', () => {
      const props = createMockVideoChatProps({
        encryptionStatus: { ready: false, verified: false, channelState: 'connecting' },
      });
      render(<VideoChat {...props} />);

      expect(screen.getByText(/establishing encryption/i)).toBeInTheDocument();
    });

    it('displays server encryption fallback', () => {
      const props = createMockVideoChatProps({
        encryptionStatus: { ready: false, verified: false, channelState: 'open' },
      });
      render(<VideoChat {...props} />);

      expect(screen.getByText(/server encrypted/i)).toBeInTheDocument();
    });
  });

  describe('Close Functionality', () => {
    it('calls onClose when close button is clicked', async () => {
      const mockOnClose = vi.fn();
      const props = createMockVideoChatProps({ onClose: mockOnClose });
      render(<VideoChat {...props} />);

      const closeButton = screen.getByLabelText(/close chat/i);
      await userEvent.click(closeButton);

      expect(mockOnClose).toHaveBeenCalledOnce();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels for all interactive elements', () => {
      const props = createMockVideoChatProps({
        currentUser: { id: 'patient-1', name: 'Patient', role: 'patient' },
      });
      render(<VideoChat {...props} />);

      expect(screen.getByLabelText(/type a secure message/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/send message/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/close chat/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/send emergency alert/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/add emoji/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/attach file/i)).toBeInTheDocument();
    });

    it('has proper role attributes', () => {
      const props = createMockVideoChatProps();
      render(<VideoChat {...props} />);

      expect(screen.getByRole('region', { name: /video chat session/i })).toBeInTheDocument();
      expect(screen.getByRole('log', { name: /chat messages/i })).toBeInTheDocument();
    });

    it('has proper aria-live attributes for dynamic content', () => {
      const props = createMockVideoChatProps();
      render(<VideoChat {...props} />);

      expect(screen.getByRole('log')).toHaveAttribute('aria-live', 'polite');
      expect(screen.getByText(/e2e encrypted/i).parentElement).toHaveAttribute('aria-live', 'polite');
    });

    it('has proper aria-describedby for input', () => {
      const props = createMockVideoChatProps();
      render(<VideoChat {...props} />);

      expect(screen.getByLabelText(/type a secure message/i)).toHaveAttribute('aria-describedby', 'encryption-status');
    });
  });
});