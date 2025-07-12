import { a11y } from '@/lib/utils/accessibility';

export function SkipLinks() {
  return (
    <nav aria-label="Skip navigation">
      <a href="#main-content" className={a11y.skipLink}>
        Skip to main content
      </a>
      <a href="#navigation" className={a11y.skipLink}>
        Skip to navigation
      </a>
      <a href="#footer" className={a11y.skipLink}>
        Skip to footer
      </a>
    </nav>
  );
}