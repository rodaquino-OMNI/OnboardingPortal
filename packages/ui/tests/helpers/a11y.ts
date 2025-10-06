import { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Accessibility testing utilities
 */

export interface A11yTestOptions {
  /**
   * Include only specific WCAG tags
   * @example ['wcag2a', 'wcag2aa', 'wcag21aa']
   */
  tags?: string[];

  /**
   * Exclude specific rules
   * @example ['color-contrast'] // Skip color contrast checks
   */
  disabledRules?: string[];

  /**
   * Run only specific rules
   */
  rules?: string[];
}

/**
 * Run axe-core accessibility tests on a page
 */
export async function checkA11y(
  page: Page,
  options: A11yTestOptions = {}
) {
  const {
    tags = ['wcag2a', 'wcag2aa', 'wcag21aa'],
    disabledRules = [],
    rules,
  } = options;

  const builder = new AxeBuilder({ page })
    .withTags(tags)
    .disableRules(disabledRules);

  if (rules) {
    builder.withRules(rules);
  }

  const results = await builder.analyze();

  return {
    violations: results.violations,
    passes: results.passes,
    incomplete: results.incomplete,
    inapplicable: results.inapplicable,
  };
}

/**
 * Check specific element for accessibility violations
 */
export async function checkElementA11y(
  page: Page,
  selector: string,
  options: A11yTestOptions = {}
) {
  const { tags = ['wcag2a', 'wcag2aa'], disabledRules = [] } = options;

  const results = await new AxeBuilder({ page })
    .include(selector)
    .withTags(tags)
    .disableRules(disabledRules)
    .analyze();

  return results.violations;
}

/**
 * Format axe violations for readable error messages
 */
export function formatViolations(violations: any[]) {
  return violations.map((violation) => {
    const nodes = violation.nodes.map((node: any) => ({
      html: node.html,
      target: node.target,
      failureSummary: node.failureSummary,
    }));

    return {
      id: violation.id,
      impact: violation.impact,
      description: violation.description,
      help: violation.help,
      helpUrl: violation.helpUrl,
      nodes,
    };
  });
}

/**
 * Assert no accessibility violations
 */
export function assertNoA11yViolations(violations: any[]) {
  if (violations.length > 0) {
    const formatted = formatViolations(violations);
    const message = `
      Found ${violations.length} accessibility violations:
      ${JSON.stringify(formatted, null, 2)}
    `;
    throw new Error(message);
  }
}

/**
 * Common accessibility test patterns
 */
export const a11yTestPatterns = {
  /**
   * Check keyboard navigation
   */
  async testKeyboardNavigation(page: Page, selector: string) {
    await page.focus(selector);
    const focused = await page.evaluate(
      (sel) => document.activeElement?.matches(sel),
      selector
    );
    return focused;
  },

  /**
   * Check ARIA attributes
   */
  async testAriaAttributes(page: Page, selector: string) {
    const element = await page.locator(selector);
    const role = await element.getAttribute('role');
    const ariaLabel = await element.getAttribute('aria-label');
    const ariaDescribedBy = await element.getAttribute('aria-describedby');

    return { role, ariaLabel, ariaDescribedBy };
  },

  /**
   * Check color contrast (using axe)
   */
  async testColorContrast(page: Page, selector: string) {
    const violations = await checkElementA11y(page, selector, {
      rules: ['color-contrast'],
    });
    return violations;
  },

  /**
   * Check focus indicators
   */
  async testFocusIndicators(page: Page, selector: string) {
    await page.focus(selector);
    const outline = await page.evaluate((sel) => {
      const element = document.querySelector(sel);
      if (!element) return null;
      const styles = window.getComputedStyle(element);
      return {
        outline: styles.outline,
        outlineWidth: styles.outlineWidth,
        outlineColor: styles.outlineColor,
      };
    }, selector);
    return outline;
  },
};
