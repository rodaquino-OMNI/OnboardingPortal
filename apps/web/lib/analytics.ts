/**
 * Analytics Tracking Utility
 *
 * Client-side wrapper for analytics events
 * Delegates to backend for actual tracking to ensure zero PII on frontend
 */

import { api } from './api';

interface AnalyticsEventPayload {
  event_name: string;
  properties?: Record<string, any>;
  timestamp?: string;
}

/**
 * Track analytics event
 *
 * @param eventName - Name of the event to track
 * @param properties - Event properties (NO PII allowed)
 */
export async function trackAnalyticsEvent(
  eventName: string,
  properties: Record<string, any> = {}
): Promise<void> {
  try {
    // Send to backend for server-side tracking
    await api.post('/api/analytics/track', {
      event_name: eventName,
      properties,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    // Don't throw - analytics failures shouldn't break the app
    console.error('Analytics tracking failed:', error);
  }
}

/**
 * Track page view
 */
export async function trackPageView(path: string): Promise<void> {
  await trackAnalyticsEvent('page_view', { path });
}

/**
 * Track button click
 */
export async function trackButtonClick(buttonId: string, context?: Record<string, any>): Promise<void> {
  await trackAnalyticsEvent('button_click', { button_id: buttonId, ...context });
}

/**
 * Track form submission
 */
export async function trackFormSubmission(formId: string, success: boolean): Promise<void> {
  await trackAnalyticsEvent('form_submission', { form_id: formId, success });
}
