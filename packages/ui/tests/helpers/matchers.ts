/**
 * Custom Vitest matchers for UI testing
 */

export function toBeAccessible(element: HTMLElement) {
  const hasAriaLabel = element.hasAttribute('aria-label');
  const hasAriaLabelledBy = element.hasAttribute('aria-labelledby');
  const hasTextContent = element.textContent && element.textContent.trim().length > 0;

  const isAccessible = hasAriaLabel || hasAriaLabelledBy || hasTextContent;

  return {
    pass: isAccessible,
    message: () =>
      isAccessible
        ? `Expected element not to be accessible`
        : `Expected element to have aria-label, aria-labelledby, or text content`,
    actual: {
      'aria-label': element.getAttribute('aria-label'),
      'aria-labelledby': element.getAttribute('aria-labelledby'),
      textContent: element.textContent,
    },
  };
}

export function toHaveNoA11yViolations(violations: any[]) {
  const hasViolations = violations.length > 0;

  return {
    pass: !hasViolations,
    message: () =>
      hasViolations
        ? `Expected no accessibility violations but found ${violations.length}:\n${JSON.stringify(violations, null, 2)}`
        : `Expected accessibility violations but found none`,
    actual: violations,
  };
}

export function toHaveFocusVisible(element: HTMLElement) {
  const styles = window.getComputedStyle(element);
  const hasOutline = styles.outline !== 'none' && styles.outlineWidth !== '0px';
  const hasBoxShadow = styles.boxShadow !== 'none';

  const hasFocusIndicator = hasOutline || hasBoxShadow;

  return {
    pass: hasFocusIndicator,
    message: () =>
      hasFocusIndicator
        ? `Expected element not to have visible focus indicator`
        : `Expected element to have visible focus indicator (outline or box-shadow)`,
    actual: {
      outline: styles.outline,
      outlineWidth: styles.outlineWidth,
      boxShadow: styles.boxShadow,
    },
  };
}

// Extend Vitest expect
declare module 'vitest' {
  interface Assertion<T = any> {
    toBeAccessible(): T;
    toHaveNoA11yViolations(): T;
    toHaveFocusVisible(): T;
  }
}
