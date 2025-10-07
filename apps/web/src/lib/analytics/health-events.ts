/**
 * Health Questionnaire Analytics Events
 *
 * Implements Analytics Contract v1.0.0 for Slice C Health events
 * Tracks schema fetching, page navigation, and submission metrics
 */

import { trackEvent as baseTrackEvent } from './analytics';

/**
 * Track when health questionnaire schema is fetched
 * Event: health.schema_fetched
 */
export function trackHealthSchemaFetched(version: number, latencyMs: number) {
  baseTrackEvent('health.schema_fetched', {
    version,
    fetch_latency_ms: latencyMs,
  });
}

/**
 * Track when user starts a health questionnaire
 * Event: health.questionnaire_started
 */
export function trackHealthQuestionnaireStarted(version: number) {
  baseTrackEvent('health.questionnaire_started', {
    version,
    page_turn: 0,
  });
}

/**
 * Track when user navigates between questionnaire pages
 * Event: health.page_turned
 */
export function trackHealthPageTurn(version: number, pageNumber: number, dwellMs: number) {
  baseTrackEvent('health.page_turned', {
    version,
    page_turn: pageNumber,
    dwell_ms: dwellMs,
  });
}

/**
 * Track when user submits health questionnaire
 * Event: health.questionnaire_submitted
 */
export function trackHealthQuestionnaireSubmitted(
  version: number,
  durationMs: number,
  band: string
) {
  baseTrackEvent('health.questionnaire_submitted', {
    version,
    duration_ms: durationMs,
    band,
  });
}
