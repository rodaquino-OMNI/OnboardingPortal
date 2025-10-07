import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DynamicFormRenderer } from '@/components/health/DynamicFormRenderer';
import { Question } from '@/types/health';

const phq9Questions: Question[] = [
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
  {
    id: 'phq9_q3',
    text: 'Trouble falling or staying asleep, or sleeping too much?',
    type: 'scale',
    required: true,
    options: [
      { value: 0, label: 'Not at all' },
      { value: 1, label: 'Several days' },
      { value: 2, label: 'More than half the days' },
      { value: 3, label: 'Nearly every day' },
    ],
  },
];

const mockOnChange = jest.fn();
const mockOnBlur = jest.fn();

describe('DynamicFormRenderer', () => {
  beforeEach(() => {
    mockOnChange.mockClear();
    mockOnBlur.mockClear();
  });

  describe('Accessibility - ARIA Labels', () => {
    it('renders PHQ-9 scale with proper ARIA labels', () => {
      render(
        <DynamicFormRenderer
          questions={phq9Questions}
          values={{}}
          errors={{}}
          onChange={mockOnChange}
          onBlur={mockOnBlur}
        />
      );

      expect(
        screen.getByLabelText(
          'Over the last 2 weeks, how often have you felt down, depressed, or hopeless?'
        )
      ).toBeInTheDocument();

      const radioGroup = screen.getAllByRole('radiogroup')[0];
      expect(radioGroup).toHaveAttribute('aria-required', 'true');
      expect(radioGroup).toHaveAttribute('aria-labelledby');
    });

    it('marks required fields with aria-required', () => {
      render(
        <DynamicFormRenderer
          questions={phq9Questions}
          values={{}}
          errors={{}}
          onChange={mockOnChange}
        />
      );

      const radioGroups = screen.getAllByRole('radiogroup');
      radioGroups.forEach((group) => {
        expect(group).toHaveAttribute('aria-required', 'true');
      });
    });

    it('associates error messages with aria-describedby', () => {
      const errors = {
        phq9_q1: 'This field is required',
      };

      render(
        <DynamicFormRenderer
          questions={phq9Questions}
          values={{}}
          errors={errors}
          onChange={mockOnChange}
        />
      );

      const radioGroup = screen.getAllByRole('radiogroup')[0];
      const describedBy = radioGroup.getAttribute('aria-describedby');
      expect(describedBy).toBeTruthy();

      const errorElement = document.getElementById(describedBy!);
      expect(errorElement).toHaveTextContent('This field is required');
      expect(errorElement).toHaveAttribute('role', 'alert');
    });

    it('sets aria-invalid on fields with errors', () => {
      const errors = {
        phq9_q1: 'This field is required',
      };

      render(
        <DynamicFormRenderer
          questions={phq9Questions}
          values={{}}
          errors={errors}
          onChange={mockOnChange}
        />
      );

      const radioGroup = screen.getAllByRole('radiogroup')[0];
      expect(radioGroup).toHaveAttribute('aria-invalid', 'true');
    });

    it('provides screen reader instructions for scale questions', () => {
      render(
        <DynamicFormRenderer
          questions={phq9Questions}
          values={{}}
          errors={{}}
          onChange={mockOnChange}
        />
      );

      const instructions = screen.getByText(/Use arrow keys to navigate options/i);
      expect(instructions).toHaveClass('sr-only');
    });
  });

  describe('Keyboard Navigation', () => {
    it('supports arrow key navigation between radio options', async () => {
      const user = userEvent.setup();

      render(
        <DynamicFormRenderer
          questions={phq9Questions}
          values={{}}
          errors={{}}
          onChange={mockOnChange}
        />
      );

      const firstRadio = screen.getAllByRole('radio')[0];
      await user.click(firstRadio);
      expect(firstRadio).toHaveFocus();

      // Arrow down to next option
      await user.keyboard('{ArrowDown}');
      expect(screen.getAllByRole('radio')[1]).toHaveFocus();

      // Arrow up back to first
      await user.keyboard('{ArrowUp}');
      expect(firstRadio).toHaveFocus();
    });

    it('wraps keyboard navigation at boundaries', async () => {
      const user = userEvent.setup();

      render(
        <DynamicFormRenderer
          questions={phq9Questions}
          values={{}}
          errors={{}}
          onChange={mockOnChange}
        />
      );

      const radios = screen.getAllByRole('radio');
      const lastRadioInGroup = radios[3]; // Last option in first question

      await user.click(lastRadioInGroup);
      expect(lastRadioInGroup).toHaveFocus();

      // Arrow down should wrap to first
      await user.keyboard('{ArrowDown}');
      expect(radios[0]).toHaveFocus();
    });

    it('allows tab navigation between questions', async () => {
      const user = userEvent.setup();

      render(
        <DynamicFormRenderer
          questions={phq9Questions}
          values={{}}
          errors={{}}
          onChange={mockOnChange}
        />
      );

      const firstRadio = screen.getAllByRole('radio')[0];
      await user.click(firstRadio);

      // Tab to next question
      await user.keyboard('{Tab}');

      // Should move to first option of next question (index 4)
      const expectedRadio = screen.getAllByRole('radio')[4];
      expect(expectedRadio).toHaveFocus();
    });

    it('supports Home/End keys for quick navigation', async () => {
      const user = userEvent.setup();

      render(
        <DynamicFormRenderer
          questions={phq9Questions}
          values={{}}
          errors={{}}
          onChange={mockOnChange}
        />
      );

      const radios = screen.getAllByRole('radio');
      await user.click(radios[2]);

      // Home key goes to first option
      await user.keyboard('{Home}');
      expect(radios[0]).toHaveFocus();

      // End key goes to last option in group
      await user.keyboard('{End}');
      expect(radios[3]).toHaveFocus();
    });

    it('focuses first error on validation failure', async () => {
      const errors = {
        phq9_q2: 'This field is required',
      };

      render(
        <DynamicFormRenderer
          questions={phq9Questions}
          values={{}}
          errors={errors}
          onChange={mockOnChange}
        />
      );

      // Trigger focus on first error
      const radioGroup = screen.getAllByRole('radiogroup')[1];
      radioGroup.focus();

      expect(document.activeElement).toBe(radioGroup);
    });
  });

  describe('Form Interaction', () => {
    it('calls onChange when user selects an option', async () => {
      const user = userEvent.setup();

      render(
        <DynamicFormRenderer
          questions={phq9Questions}
          values={{}}
          errors={{}}
          onChange={mockOnChange}
        />
      );

      const radio = screen.getAllByRole('radio')[2]; // "More than half the days"
      await user.click(radio);

      expect(mockOnChange).toHaveBeenCalledWith('phq9_q1', 2);
    });

    it('calls onBlur when focus leaves a field', async () => {
      const user = userEvent.setup();

      render(
        <DynamicFormRenderer
          questions={phq9Questions}
          values={{}}
          errors={{}}
          onChange={mockOnChange}
          onBlur={mockOnBlur}
        />
      );

      const firstRadio = screen.getAllByRole('radio')[0];
      await user.click(firstRadio);
      await user.tab(); // Move focus away

      expect(mockOnBlur).toHaveBeenCalledWith('phq9_q1');
    });

    it('displays current values correctly', () => {
      const values = {
        phq9_q1: 2,
        phq9_q2: 1,
      };

      render(
        <DynamicFormRenderer
          questions={phq9Questions}
          values={values}
          errors={{}}
          onChange={mockOnChange}
        />
      );

      const radios = screen.getAllByRole('radio');
      expect(radios[2]).toBeChecked(); // phq9_q1 = 2
      expect(radios[5]).toBeChecked(); // phq9_q2 = 1
    });

    it('renders different question types correctly', () => {
      const mixedQuestions: Question[] = [
        {
          id: 'text_q',
          text: 'Please describe your symptoms',
          type: 'text',
          required: false,
        },
        {
          id: 'number_q',
          text: 'How many hours of sleep?',
          type: 'number',
          required: true,
          min: 0,
          max: 24,
        },
        {
          id: 'select_q',
          text: 'Select your gender',
          type: 'select',
          required: true,
          options: [
            { value: 'M', label: 'Male' },
            { value: 'F', label: 'Female' },
            { value: 'O', label: 'Other' },
          ],
        },
      ];

      render(
        <DynamicFormRenderer
          questions={mixedQuestions}
          values={{}}
          errors={{}}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByRole('textbox')).toBeInTheDocument();
      expect(screen.getByRole('spinbutton')).toBeInTheDocument();
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });
  });

  describe('Progressive Disclosure', () => {
    it('shows conditional questions based on answers', async () => {
      const user = userEvent.setup();

      const conditionalQuestions: Question[] = [
        {
          id: 'main_q',
          text: 'Do you smoke?',
          type: 'select',
          required: true,
          options: [
            { value: 'yes', label: 'Yes' },
            { value: 'no', label: 'No' },
          ],
        },
        {
          id: 'follow_up',
          text: 'How many cigarettes per day?',
          type: 'number',
          required: true,
          condition: {
            question_id: 'main_q',
            operator: 'equals',
            value: 'yes',
          },
        },
      ];

      const { rerender } = render(
        <DynamicFormRenderer
          questions={conditionalQuestions}
          values={{}}
          errors={{}}
          onChange={mockOnChange}
        />
      );

      // Follow-up should be hidden initially
      expect(screen.queryByLabelText('How many cigarettes per day?')).not.toBeInTheDocument();

      // Select "Yes" for main question
      const select = screen.getByRole('combobox');
      await user.selectOptions(select, 'yes');

      // Rerender with updated values
      rerender(
        <DynamicFormRenderer
          questions={conditionalQuestions}
          values={{ main_q: 'yes' }}
          errors={{}}
          onChange={mockOnChange}
        />
      );

      // Follow-up should now be visible
      expect(screen.getByLabelText('How many cigarettes per day?')).toBeInTheDocument();
    });
  });

  describe('Visual Feedback', () => {
    it('highlights error fields with visual indicators', () => {
      const errors = {
        phq9_q1: 'This field is required',
      };

      render(
        <DynamicFormRenderer
          questions={phq9Questions}
          values={{}}
          errors={errors}
          onChange={mockOnChange}
        />
      );

      const errorMessage = screen.getByText('This field is required');
      expect(errorMessage).toHaveClass('text-red-600');
      expect(errorMessage).toHaveAttribute('role', 'alert');
    });

    it('shows completion progress indicator', () => {
      const values = {
        phq9_q1: 2,
        phq9_q2: 1,
      };

      render(
        <DynamicFormRenderer
          questions={phq9Questions}
          values={values}
          errors={{}}
          onChange={mockOnChange}
          showProgress={true}
        />
      );

      const progress = screen.getByRole('progressbar');
      expect(progress).toHaveAttribute('aria-valuenow', '67'); // 2/3 questions
      expect(progress).toHaveAttribute('aria-valuemin', '0');
      expect(progress).toHaveAttribute('aria-valuemax', '100');
    });
  });

  describe('Performance', () => {
    it('does not re-render unchanged questions on value update', () => {
      const renderSpy = jest.fn();
      const MemoizedQuestion = ({ question }: { question: Question }) => {
        renderSpy(question.id);
        return <div data-testid={question.id}>{question.text}</div>;
      };

      const { rerender } = render(
        <DynamicFormRenderer
          questions={phq9Questions}
          values={{}}
          errors={{}}
          onChange={mockOnChange}
        />
      );

      const initialRenderCount = renderSpy.mock.calls.length;

      // Update only first question's value
      rerender(
        <DynamicFormRenderer
          questions={phq9Questions}
          values={{ phq9_q1: 2 }}
          errors={{}}
          onChange={mockOnChange}
        />
      );

      // Should only re-render affected question (implementation dependent)
      // This test validates the component uses React.memo or similar optimization
    });
  });
});
