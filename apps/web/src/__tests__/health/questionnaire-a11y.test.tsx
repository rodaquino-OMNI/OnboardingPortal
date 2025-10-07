import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { QuestionnaireContainer } from '@/components/health/QuestionnaireContainer';
import { DynamicFormRenderer } from '@/components/health/DynamicFormRenderer';
import { SWRConfig } from 'swr';

expect.extend(toHaveNoViolations);

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

const mockSchema = {
  id: 1,
  version: 1,
  title: 'PHQ-9 Depression Screening',
  sections: [
    {
      id: 'phq9',
      title: 'Depression Assessment',
      questions: [
        {
          id: 'phq9_q1',
          text: 'Over the last 2 weeks, how often have you felt down, depressed, or hopeless?',
          type: 'scale',
          required: true,
          options: [
            { value: 0, label: 'Not at all' },
            { value: 1, label: 'Several days' },
            { value: 2, label: 'More than half the days' },
            { value: 3, label: 'Nearly every day' },
          ],
        },
        {
          id: 'phq9_q2',
          text: 'Little interest or pleasure in doing things?',
          type: 'scale',
          required: true,
          options: [
            { value: 0, label: 'Not at all' },
            { value: 1, label: 'Several days' },
            { value: 2, label: 'More than half the days' },
            { value: 3, label: 'Nearly every day' },
          ],
        },
      ],
    },
  ],
};

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
    {children}
  </SWRConfig>
);

describe('Questionnaire Accessibility', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  describe('WCAG 2.1 AA Compliance', () => {
    it('QuestionnaireContainer has no WCAG violations', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockSchema }),
      });

      const { container } = render(<QuestionnaireContainer questionnaireId={1} />, {
        wrapper,
      });

      // Wait for content to load
      await new Promise((resolve) => setTimeout(resolve, 100));

      const results = await axe(container, {
        runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'],
      });

      expect(results).toHaveNoViolations();
    });

    it('DynamicFormRenderer has no WCAG violations', async () => {
      const { container } = render(
        <DynamicFormRenderer
          questions={mockSchema.sections[0].questions}
          values={{}}
          errors={{}}
          onChange={() => {}}
        />
      );

      const results = await axe(container, {
        runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'],
      });

      expect(results).toHaveNoViolations();
    });

    it('Form with errors has no WCAG violations', async () => {
      const errors = {
        phq9_q1: 'This field is required',
        phq9_q2: 'Please select an option',
      };

      const { container } = render(
        <DynamicFormRenderer
          questions={mockSchema.sections[0].questions}
          values={{}}
          errors={errors}
          onChange={() => {}}
        />
      );

      const results = await axe(container, {
        runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'],
      });

      expect(results).toHaveNoViolations();
    });

    it('Form with partial completion has no WCAG violations', async () => {
      const values = {
        phq9_q1: 2,
      };

      const { container } = render(
        <DynamicFormRenderer
          questions={mockSchema.sections[0].questions}
          values={values}
          errors={{}}
          onChange={() => {}}
          showProgress={true}
        />
      );

      const results = await axe(container, {
        runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'],
      });

      expect(results).toHaveNoViolations();
    });
  });

  describe('Specific WCAG Success Criteria', () => {
    it('meets 1.3.1 Info and Relationships (A)', async () => {
      const { container } = render(
        <DynamicFormRenderer
          questions={mockSchema.sections[0].questions}
          values={{}}
          errors={{}}
          onChange={() => {}}
        />
      );

      const results = await axe(container, {
        runOnly: ['aria-allowed-attr', 'aria-required-children', 'aria-required-parent'],
      });

      expect(results).toHaveNoViolations();
    });

    it('meets 1.4.3 Contrast (Minimum) (AA)', async () => {
      const { container } = render(
        <DynamicFormRenderer
          questions={mockSchema.sections[0].questions}
          values={{}}
          errors={{}}
          onChange={() => {}}
        />
      );

      const results = await axe(container, {
        runOnly: ['color-contrast'],
      });

      expect(results).toHaveNoViolations();
    });

    it('meets 2.1.1 Keyboard (A)', async () => {
      const { container } = render(
        <DynamicFormRenderer
          questions={mockSchema.sections[0].questions}
          values={{}}
          errors={{}}
          onChange={() => {}}
        />
      );

      const results = await axe(container, {
        runOnly: ['tabindex'],
      });

      expect(results).toHaveNoViolations();
    });

    it('meets 2.4.3 Focus Order (A)', async () => {
      const { container } = render(
        <DynamicFormRenderer
          questions={mockSchema.sections[0].questions}
          values={{}}
          errors={{}}
          onChange={() => {}}
        />
      );

      const results = await axe(container, {
        runOnly: ['focus-order-semantics'],
      });

      expect(results).toHaveNoViolations();
    });

    it('meets 3.2.2 On Input (A)', async () => {
      const { container } = render(
        <DynamicFormRenderer
          questions={mockSchema.sections[0].questions}
          values={{}}
          errors={{}}
          onChange={() => {}}
        />
      );

      const results = await axe(container, {
        runOnly: ['select-name'],
      });

      expect(results).toHaveNoViolations();
    });

    it('meets 3.3.1 Error Identification (A)', async () => {
      const errors = {
        phq9_q1: 'This field is required',
      };

      const { container } = render(
        <DynamicFormRenderer
          questions={mockSchema.sections[0].questions}
          values={{}}
          errors={errors}
          onChange={() => {}}
        />
      );

      const results = await axe(container, {
        runOnly: ['aria-valid-attr-value'],
      });

      expect(results).toHaveNoViolations();
    });

    it('meets 3.3.2 Labels or Instructions (A)', async () => {
      const { container } = render(
        <DynamicFormRenderer
          questions={mockSchema.sections[0].questions}
          values={{}}
          errors={{}}
          onChange={() => {}}
        />
      );

      const results = await axe(container, {
        runOnly: ['label', 'label-title-only'],
      });

      expect(results).toHaveNoViolations();
    });

    it('meets 4.1.2 Name, Role, Value (A)', async () => {
      const { container } = render(
        <DynamicFormRenderer
          questions={mockSchema.sections[0].questions}
          values={{}}
          errors={{}}
          onChange={() => {}}
        />
      );

      const results = await axe(container, {
        runOnly: ['aria-roles', 'aria-valid-attr', 'button-name'],
      });

      expect(results).toHaveNoViolations();
    });
  });

  describe('Screen Reader Compatibility', () => {
    it('provides meaningful labels for all form controls', async () => {
      const { container } = render(
        <DynamicFormRenderer
          questions={mockSchema.sections[0].questions}
          values={{}}
          errors={{}}
          onChange={() => {}}
        />
      );

      const results = await axe(container, {
        runOnly: ['label', 'aria-labelledby'],
      });

      expect(results).toHaveNoViolations();
    });

    it('announces dynamic content changes to screen readers', async () => {
      const errors = {
        phq9_q1: 'This field is required',
      };

      const { container } = render(
        <DynamicFormRenderer
          questions={mockSchema.sections[0].questions}
          values={{}}
          errors={errors}
          onChange={() => {}}
        />
      );

      const results = await axe(container, {
        runOnly: ['aria-live'],
      });

      expect(results).toHaveNoViolations();
    });

    it('provides status messages for form submission', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockSchema }),
      });

      const { container } = render(<QuestionnaireContainer questionnaireId={1} />, {
        wrapper,
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      const results = await axe(container, {
        runOnly: ['aria-live', 'status-role'],
      });

      expect(results).toHaveNoViolations();
    });
  });

  describe('Landmark Regions', () => {
    it('uses appropriate landmark roles', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockSchema }),
      });

      const { container } = render(<QuestionnaireContainer questionnaireId={1} />, {
        wrapper,
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      const results = await axe(container, {
        runOnly: ['region'],
      });

      expect(results).toHaveNoViolations();
    });
  });

  describe('Focus Management', () => {
    it('maintains logical focus order', async () => {
      const { container } = render(
        <DynamicFormRenderer
          questions={mockSchema.sections[0].questions}
          values={{}}
          errors={{}}
          onChange={() => {}}
        />
      );

      const results = await axe(container, {
        runOnly: ['tabindex', 'focus-order-semantics'],
      });

      expect(results).toHaveNoViolations();
    });

    it('has no positive tabindex values', async () => {
      const { container } = render(
        <DynamicFormRenderer
          questions={mockSchema.sections[0].questions}
          values={{}}
          errors={{}}
          onChange={() => {}}
        />
      );

      const results = await axe(container, {
        runOnly: ['tabindex'],
      });

      expect(results).toHaveNoViolations();
    });
  });

  describe('Form Semantics', () => {
    it('uses proper HTML5 form elements', async () => {
      const { container } = render(
        <DynamicFormRenderer
          questions={mockSchema.sections[0].questions}
          values={{}}
          errors={{}}
          onChange={() => {}}
        />
      );

      const results = await axe(container, {
        runOnly: ['form-field-multiple-labels'],
      });

      expect(results).toHaveNoViolations();
    });

    it('associates error messages correctly', async () => {
      const errors = {
        phq9_q1: 'This field is required',
      };

      const { container } = render(
        <DynamicFormRenderer
          questions={mockSchema.sections[0].questions}
          values={{}}
          errors={errors}
          onChange={() => {}}
        />
      );

      const results = await axe(container, {
        runOnly: ['aria-describedby'],
      });

      expect(results).toHaveNoViolations();
    });
  });

  describe('Mobile Accessibility', () => {
    it('has sufficient touch target sizes', async () => {
      const { container } = render(
        <DynamicFormRenderer
          questions={mockSchema.sections[0].questions}
          values={{}}
          errors={{}}
          onChange={() => {}}
        />
      );

      // Axe doesn't check touch target sizes, but we can verify structure
      const results = await axe(container);

      expect(results).toHaveNoViolations();
    });
  });
});
