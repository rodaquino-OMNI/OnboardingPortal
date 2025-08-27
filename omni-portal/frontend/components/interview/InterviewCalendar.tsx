'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export interface InterviewCalendarProps {
  selectedDate?: Date;
  availableDates?: Date[];
  onDateSelect?: (date: Date) => void;
  onError?: (error: Error) => void;
  isLoading?: boolean;
}

export const InterviewCalendar: React.FC<InterviewCalendarProps> = ({
  selectedDate,
  availableDates = [],
  onDateSelect,
  onError,
  isLoading = false
}) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selected, setSelected] = useState<Date | undefined>(selectedDate);

  const handleDateClick = (date: Date) => {
    try {
      setSelected(date);
      onDateSelect?.(date);
    } catch (error) {
      onError?.(error instanceof Error ? error : new Error('Failed to select date'));
    }
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
    <Card data-testid="interview-calendar" className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="text-center">Select Interview Date</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="calendar-header flex justify-between items-center mb-6">
          <Button 
            variant="outline" 
            onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
            disabled={isLoading}
          >
            Previous
          </Button>
          <h3 className="text-lg font-semibold">
            {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </h3>
          <Button 
            variant="outline"
            onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
            disabled={isLoading}
          >
            Next
          </Button>
        </div>
        
        <div className="grid grid-cols-7 gap-2 mb-6">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="text-center text-sm font-medium text-muted-foreground p-2">
              {day}
            </div>
          ))}
          
          {days.map((day, index) => {
            const isAvailable = availableDates.some(d => 
              d.toDateString() === day.toDateString()
            );
            const isSelected = selected?.toDateString() === day.toDateString();
            
            return (
              <Button
                key={index}
                variant={isSelected ? "default" : "outline"}
                size="sm"
                className={`calendar-day h-10 p-0 ${
                  !isAvailable ? 'opacity-30 cursor-not-allowed' : ''
                }`}
                onClick={() => isAvailable && handleDateClick(day)}
                disabled={!isAvailable || isLoading}
                aria-label={`Select ${day.toLocaleDateString()}`}
              >
                <div className="flex flex-col items-center">
                  <span className="text-sm">{day.getDate()}</span>
                  {isAvailable && (
                    <div className="w-1 h-1 bg-primary rounded-full"></div>
                  )}
                </div>
              </Button>
            );
          })}
        </div>
        
        <div className="date-range-filter grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 p-4 bg-muted/50 rounded-lg">
          <div>
            <Label htmlFor="start-date">Start Date</Label>
            <Input 
              type="date" 
              id="start-date" 
              name="start-date" 
              disabled={isLoading}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="end-date">End Date</Label>
            <Input 
              type="date" 
              id="end-date" 
              name="end-date" 
              disabled={isLoading}
              className="mt-1"
            />
          </div>
        </div>
        
        {selected && (
          <div className="mt-4 p-3 bg-primary/10 border border-primary/20 rounded-md">
            <p className="text-sm text-primary font-medium">
              Selected: {selected.toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default InterviewCalendar;