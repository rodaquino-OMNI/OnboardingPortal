'use client';

import React, { useState } from 'react';

export interface InterviewCalendarProps {
  selectedDate?: Date;
  availableDates?: Date[];
  onDateSelect?: (date: Date) => void;
}

export const InterviewCalendar: React.FC<InterviewCalendarProps> = ({
  selectedDate,
  availableDates = [],
  onDateSelect
}) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selected, setSelected] = useState<Date | undefined>(selectedDate);

  const handleDateClick = (date: Date) => {
    setSelected(date);
    onDateSelect?.(date);
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days = [];
    
    for (let d = firstDay; d <= lastDay; d.setDate(d.getDate() + 1)) {
      days.push(new Date(d));
    }
    
    return days;
  };

  const days = getDaysInMonth(currentMonth);

  return (
    <div data-testid="interview-calendar">
      <div className="calendar-header">
        <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}>
          Previous
        </button>
        <h3>{currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h3>
        <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}>
          Next
        </button>
      </div>
      
      <div className="calendar-grid">
        {days.map((day, index) => {
          const isAvailable = availableDates.some(d => 
            d.toDateString() === day.toDateString()
          );
          const isSelected = selected?.toDateString() === day.toDateString();
          
          return (
            <button
              key={index}
              className={`calendar-day ${isAvailable ? 'available' : ''} ${isSelected ? 'selected' : ''}`}
              onClick={() => isAvailable && handleDateClick(day)}
              disabled={!isAvailable}
              aria-label={`Select ${day.toLocaleDateString()}`}
            >
              {day.getDate()}
            </button>
          );
        })}
      </div>
      
      <div className="date-range-filter">
        <label htmlFor="start-date">Start Date</label>
        <input type="date" id="start-date" name="start-date" />
        <label htmlFor="end-date">End Date</label>
        <input type="date" id="end-date" name="end-date" />
      </div>
    </div>
  );
};

export default InterviewCalendar;