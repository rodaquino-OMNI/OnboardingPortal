'use client';

import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { 
  usePerformanceMonitor,
  useComponentLifecycle,
  useSafeTimeout,
  MemoryLeakPrevention
} from '@/lib/react-performance-utils';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';

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
  userId?: string;
  onError?: (error: Error) => void;
}

export const InterviewScheduler: React.FC<InterviewSchedulerProps> = memo(function InterviewScheduler({
  slots = [],
  onSelectSlot,
  hasExistingInterview = false,
  userId,
  onError
}) {
  // Performance monitoring
  const { renderStats } = usePerformanceMonitor('InterviewScheduler');
  const lifecycle = useComponentLifecycle('InterviewScheduler');
  const { setSafeTimeout, clearSafeTimeout } = useSafeTimeout();

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearSafeTimeout();
      MemoryLeakPrevention.cleanup();
    };
  }, [clearSafeTimeout]);

  // Generate mock slots if none provided - memoized for performance
  const generateMockSlots = useCallback((): InterviewSlot[] => {
    const mockSlots: InterviewSlot[] = [];
    const now = new Date();
    
    for (let i = 1; i <= 14; i++) {
      const slotDate = new Date(now);
      slotDate.setDate(now.getDate() + i);
      
      // Generate 3 slots per day
      for (let j = 0; j < 3; j++) {
        const hour = 9 + (j * 3); // 9am, 12pm, 3pm
        mockSlots.push({
          id: `slot-${i}-${j}`,
          date: slotDate.toLocaleDateString('en-US'),
          time: `${hour}:00`,
          available: Math.random() > 0.3, // 70% availability
          timezone: 'America/Sao_Paulo'
        });
      }
    }
    
    return mockSlots;
  }, []);

  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timezone, setTimezone] = useState('America/Sao_Paulo');
  // Memoize initial slots to prevent regeneration
  const [availableSlots, setAvailableSlots] = useState<InterviewSlot[]>(() => 
    slots.length > 0 ? slots : []
  );
  const [preferredTime, setPreferredTime] = useState<string>('any');

  // Memoize mock slots generation to prevent unnecessary calls
  const mockSlots = useMemo(() => generateMockSlots(), [generateMockSlots]);

  // Load slots on component mount or timezone change
  useEffect(() => {
    const loadSlots = async () => {
      setIsLoading(true);
      try {
        // Simulate API call with safe timeout
        await new Promise(resolve => setSafeTimeout(resolve, 10));
        
        const newSlots = slots.length > 0 ? slots : mockSlots;
        setAvailableSlots(newSlots);
      } catch (error) {
        setError('Failed to load interview slots');
      } finally {
        setIsLoading(false);
      }
    };

    // Load when timezone changes or initially if no slots
    if (timezone !== 'America/Sao_Paulo' || availableSlots.length === 0) {
      loadSlots();
    }
  }, [timezone, slots, mockSlots, setSafeTimeout, availableSlots.length]);

  const handleSlotClick = useCallback(async (slot: InterviewSlot) => {
    try {
      if (slot.available && !hasExistingInterview) {
        setError(null);
        setSelectedSlot(slot.id);
        await onSelectSlot?.(slot);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to select slot';
      setError(errorMessage);
      onError?.(error instanceof Error ? error : new Error(errorMessage));
    }
  }, [hasExistingInterview, onSelectSlot, onError]);

  const handleTimezoneChange = useCallback((newTimezone: string) => {
    setTimezone(newTimezone);
  }, []);

  const handlePreferredTimeChange = useCallback((time: string) => {
    setPreferredTime(time);
    // Filter slots based on preference - using the base slots to avoid data loss
    const baseSlots = slots.length > 0 ? slots : mockSlots;
    if (time !== 'any') {
      const filtered = baseSlots.filter(slot => {
        const hour = parseInt(slot.time.split(':')[0]);
        switch (time) {
          case 'morning': return hour < 12;
          case 'afternoon': return hour >= 12 && hour < 17;
          case 'evening': return hour >= 17;
          default: return true;
        }
      });
      setAvailableSlots(filtered);
    } else {
      setAvailableSlots(baseSlots);
    }
  }, [slots, mockSlots]);

  if (hasExistingInterview) {
    return (
      <Card data-testid="interview-scheduler-existing" className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="text-center">Interview Already Scheduled</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center">
            <Badge variant="secondary" className="mb-4">Interview Confirmed</Badge>
            <p className="text-muted-foreground">You already have an interview scheduled. Check your dashboard for details.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardContent className="py-8">
          <div className="flex items-center justify-center mb-4">
            <span className="text-muted-foreground">Loading interview slots...</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="interview-scheduler" className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="text-center">Available Interview Slots</CardTitle>
        {userId && (
          <p className="text-sm text-muted-foreground text-center">User ID: {userId}</p>
        )}
      </CardHeader>
      <CardContent>
        {/* Controls */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <Label htmlFor="timezone-select">Timezone</Label>
            <select 
              id="timezone-select" 
              aria-label="timezone"
              value={timezone} 
              onChange={(e) => handleTimezoneChange(e.target.value)}
              className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
            >
              <option value="America/Sao_Paulo">Brazil Time (GMT-3)</option>
              <option value="America/New_York">Eastern Time (GMT-5)</option>
              <option value="America/Los_Angeles">Pacific Time (GMT-8)</option>
              <option value="Europe/London">London Time (GMT)</option>
            </select>
          </div>
          
          {userId && (
            <div>
              <Label htmlFor="preferred-time">Preferred Time</Label>
              <select 
                id="preferred-time" 
                aria-label="preferred time"
                value={preferredTime} 
                onChange={(e) => handlePreferredTimeChange(e.target.value)}
                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
              >
                <option value="any">Any Time</option>
                <option value="morning">Morning (9am-12pm)</option>
                <option value="afternoon">Afternoon (12pm-5pm)</option>
                <option value="evening">Evening (5pm-8pm)</option>
              </select>
            </div>
          )}
        </div>

        {userId && preferredTime !== 'any' && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-blue-800 text-sm font-medium">
              📅 Recommended for you: {preferredTime} slots based on your preferences
            </p>
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
            <p className="text-destructive text-sm">{error}</p>
          </div>
        )}
        
        {availableSlots.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No available slots at this time</p>
            <p className="text-sm text-muted-foreground mt-2">Please check back later or contact support</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {availableSlots.map((slot) => (
              <Button
                key={slot.id}
                data-testid={`slot-${slot.id}`}
                variant={selectedSlot === slot.id ? "default" : "outline"}
                className={`h-auto p-4 flex flex-col items-center space-y-2 ${
                  !slot.available ? 'opacity-50 cursor-not-allowed' : ''
                }`}
                onClick={() => handleSlotClick(slot)}
                disabled={!slot.available || isLoading}
                aria-label={`Book slot on ${slot.date} at ${slot.time}`}
              >
                <div className="font-medium">{slot.date}</div>
                <div className="text-sm">{slot.time}</div>
                {slot.timezone && (
                  <Badge variant="secondary" className="text-xs">
                    {slot.timezone === 'America/New_York' ? 'Eastern Time' : 
                     slot.timezone === 'America/Sao_Paulo' ? 'Brazil Time' : 
                     slot.timezone}
                  </Badge>
                )}
                {!slot.available && (
                  <Badge variant="destructive" className="text-xs">
                    Unavailable
                  </Badge>
                )}
              </Button>
            ))}
          </div>
        )}
        
        {selectedSlot && (
          <div className="mt-6 p-4 bg-primary/10 border border-primary/20 rounded-md">
            <p className="text-sm text-primary font-medium">
              Slot selected! Proceeding with booking...
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
});

export default InterviewScheduler;