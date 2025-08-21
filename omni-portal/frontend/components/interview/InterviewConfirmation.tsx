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
  onConfirm?: () => void;
  onCancel?: () => void;
  onSendReminders?: () => void;
}

export const InterviewConfirmation: React.FC<InterviewConfirmationProps> = ({
  interviewId,
  interview,
  onConfirm,
  onCancel,
  onSendReminders
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

  if (!interview) {
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
        <p><strong>Date:</strong> {interview.date}</p>
        <p><strong>Time:</strong> {interview.time}</p>
        {interview.interviewer && (
          <p><strong>Interviewer:</strong> {interview.interviewer}</p>
        )}
        {interview.location && (
          <p><strong>Location:</strong> {interview.location}</p>
        )}
        {interview.type && (
          <p><strong>Type:</strong> {interview.type}</p>
        )}
        {interview.notes && (
          <div>
            <strong>Notes:</strong>
            <p>{interview.notes}</p>
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