/**
 * Base Analytics Tracking Utility
 *
 * Provides foundation for all analytics event tracking
 * Integrates with backend analytics system
 */

interface AnalyticsEvent {
  event_name: string;
  properties: Record<string, any>;
  timestamp: string;
}

/**
 * Base event tracking function
 * Sends events to backend analytics endpoint
 */
export function trackEvent(eventName: string, properties: Record<string, any> = {}) {
  const event: AnalyticsEvent = {
    event_name: eventName,
    properties: {
      ...properties,
      user_agent: navigator.userAgent,
      screen_width: window.screen.width,
      screen_height: window.screen.height,
    },
    timestamp: new Date().toISOString(),
  };

  // Send to backend analytics
  if (typeof window !== 'undefined') {
    fetch('/api/analytics/events', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
      keepalive: true, // Ensure event is sent even if page unloads
    }).catch(error => {
      console.error('Analytics tracking failed:', error);
    });
  }
}

/**
 * Track page view
 */
export function trackPageView(path: string, properties: Record<string, any> = {}) {
  trackEvent('page_view', {
    path,
    ...properties,
  });
}

/**
 * Track user interaction
 */
export function trackInteraction(
  action: string,
  category: string,
  label?: string,
  value?: number
) {
  trackEvent('user_interaction', {
    action,
    category,
    label,
    value,
  });
}
