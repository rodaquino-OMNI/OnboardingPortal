'use client';

import React, { useState } from 'react';

export interface InterviewSlot {
  id: string;
  date: string;
  time: string;
  available: boolean;
  timezone?: string;
}

export interface InterviewSchedulerProps {
  slots?: InterviewSlot[];
  onSelectSlot?: (slot: InterviewSlot) => void;
  hasExistingInterview?: boolean;
}

export const InterviewScheduler: React.FC<InterviewSchedulerProps> = ({
  slots = [],
  onSelectSlot,
  hasExistingInterview = false
}) => {
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

  const handleSlotClick = (slot: InterviewSlot) => {
    if (slot.available && !hasExistingInterview) {
      setSelectedSlot(slot.id);
      onSelectSlot?.(slot);
    }
  };

  if (hasExistingInterview) {
    return (
      <div data-testid="interview-scheduler-existing">
        <p>You already have an interview scheduled</p>
      </div>
    );
  }

  return (
    <div data-testid="interview-scheduler">
      <h2>Available Interview Slots</h2>
      {slots.length === 0 ? (
        <p>No available slots at this time</p>
      ) : (
        <div className="slots-grid">
          {slots.map((slot) => (
            <button
              key={slot.id}
              data-testid={`slot-${slot.id}`}
              className={`slot ${selectedSlot === slot.id ? 'selected' : ''}`}
              onClick={() => handleSlotClick(slot)}
              disabled={!slot.available}
            >
              <div>{slot.date}</div>
              <div>{slot.time}</div>
              {slot.timezone && <div className="text-sm">{slot.timezone}</div>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default InterviewScheduler;