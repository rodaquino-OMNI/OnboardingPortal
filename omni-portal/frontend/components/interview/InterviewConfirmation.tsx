'use client';

import React, { useState } from 'react';

export interface InterviewDetails {
  id: string;
  date: string;
  time: string;
  interviewer?: string;
  location?: string;
  type?: 'in-person' | 'video' | 'phone';
  notes?: string;
}

export interface InterviewConfirmationProps {
  interviewId: string;
  interview?: InterviewDetails;
  scheduled?: {
    date: string;
    time: string;
    timezone?: string;
  };
  onConfirm?: () => void;
  onCancel?: () => void;
  onSendReminders?: () => void;
  onExportCalendar?: () => void;
}

export const InterviewConfirmation: React.FC<InterviewConfirmationProps> = ({
  interviewId,
  interview,
  scheduled,
  onConfirm,
  onCancel,
  onSendReminders,
  onExportCalendar
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [remindersSent, setRemindersSent] = useState(false);

  const handleSendReminders = async () => {
    setIsLoading(true);
    try {
      await onSendReminders?.();
      setRemindersSent(true);
    } catch (error) {
      console.error('Failed to send reminders:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Use scheduled data if interview is not provided
  const displayData = interview || (scheduled ? {
    id: interviewId,
    date: scheduled.date,
    time: scheduled.time,
    type: 'video' as const,
    notes: 'Scheduled interview'
  } : null);

  if (!displayData) {
    return (
      <div data-testid="interview-confirmation-empty">
        <p>No interview details available for ID: {interviewId}</p>
      </div>
    );
  }

  return (
    <div data-testid="interview-confirmation">
      <h2>Interview Confirmation</h2>
      <div className="interview-details">
        <p><strong>Interview ID:</strong> {interviewId}</p>
        <p><strong>Date:</strong> {displayData.date}</p>
        <p><strong>Time:</strong> {displayData.time}</p>
        {scheduled?.timezone && (
          <p><strong>Timezone:</strong> {scheduled.timezone}</p>
        )}
        {displayData.interviewer && (
          <p><strong>Interviewer:</strong> {displayData.interviewer}</p>
        )}
        {displayData.location && (
          <p><strong>Location:</strong> {displayData.location}</p>
        )}
        {displayData.type && (
          <p><strong>Type:</strong> {displayData.type}</p>
        )}
        {displayData.notes && (
          <div>
            <strong>Notes:</strong>
            <p>{displayData.notes}</p>
          </div>
        )}
      </div>
      
      <div className="confirmation-actions">
        {onConfirm && (
          <button onClick={onConfirm} className="btn-confirm">
            Confirm Interview
          </button>
        )}
        
        {onCancel && (
          <button onClick={onCancel} className="btn-cancel">
            Cancel Interview
          </button>
        )}
        
        {onSendReminders && (
          <button 
            onClick={handleSendReminders}
            disabled={isLoading || remindersSent}
            className="btn-reminder"
            aria-label="Send reminders"
          >
            {isLoading ? 'Sending...' : remindersSent ? 'Reminders Sent' : 'Send Reminders'}
          </button>
        )}
        
        {onExportCalendar && (
          <button
            onClick={onExportCalendar}
            className="btn-export"
            aria-label="Add to calendar"
          >
            Add to Calendar
          </button>
        )}
      </div>
      
      {/* Calendar export options when clicked */}
      <div className="calendar-export-options">
        <a href="#" role="link" aria-label="Google Calendar">Google Calendar</a>
        <a href="#" role="link" aria-label="Outlook Calendar">Outlook Calendar</a>
        <a href="#" role="link" aria-label="Apple Calendar">Apple Calendar</a>
      </div>
      
      {/* Timezone selector for conversion */}
      <div className="timezone-conversion">
        <label htmlFor="user-timezone">Your timezone</label>
        <select id="user-timezone" aria-label="your timezone">
          <option value="America/Sao_Paulo">Brazil Time (GMT-3)</option>
          <option value="America/New_York">Eastern Time (GMT-5)</option>
          <option value="Europe/London">London Time (GMT)</option>
        </select>
      </div>
      
      {remindersSent && (
        <div className="notification-success">
          Reminder notifications have been sent successfully!
        </div>
      )}
    </div>
  );
};

export default InterviewConfirmation;