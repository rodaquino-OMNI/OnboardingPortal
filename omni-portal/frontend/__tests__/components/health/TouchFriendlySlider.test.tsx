import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react';
import { TouchFriendlySlider } from '@/components/health/TouchFriendlySlider';
import '@testing-library/jest-dom';

describe('TouchFriendlySlider', () => {
  const mockQuestion = {
    id: 'pain-scale',
    text: 'Rate your pain level',
    type: 'scale' as const,
    domain: 'pain',
    riskWeight: 5,
    options: [
      { value: 0, label: 'No pain', emoji: '😊' },
      { value: 5, label: 'Moderate', emoji: '😐' },
      { value: 10, label: 'Severe', emoji: '😣' }
    ]
  };

  const mockOnComplete = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders with initial value in the middle of range', () => {
    render(
      <TouchFriendlySlider 
        question={mockQuestion} 
        onComplete={mockOnComplete}
      />
    );

    // Check for value in the main display
    const valueElements = screen.getAllByText('5');
    expect(valueElements).toHaveLength(2); // One in display, one in thumb
    expect(screen.getByText('😐')).toBeInTheDocument();
    expect(screen.getByText('Moderate')).toBeInTheDocument();
  });

  it('displays min and max values correctly', () => {
    render(
      <TouchFriendlySlider 
        question={mockQuestion} 
        onComplete={mockOnComplete}
      />
    );

    expect(screen.getByText('0 - No pain')).toBeInTheDocument();
    expect(screen.getByText('10 - Severe')).toBeInTheDocument();
  });

  it('meets minimum touch target size requirements', () => {
    render(
      <TouchFriendlySlider 
        question={mockQuestion} 
        onComplete={mockOnComplete}
      />
    );

    // Check slider track height
    const sliderTrack = screen.getByRole('slider');
    expect(sliderTrack).toHaveClass('h-12'); // 48px height

    // Check increment/decrement buttons
    const buttons = screen.getAllByRole('button');
    buttons.forEach(button => {
      if (button.getAttribute('aria-label')?.includes('valor')) {
        expect(button).toHaveClass('min-h-[44px]', 'min-w-[44px]');
      }
    });
  });

  it('handles increment button click', () => {
    render(
      <TouchFriendlySlider 
        question={mockQuestion} 
        onComplete={mockOnComplete}
      />
    );

    const incrementButton = screen.getByLabelText('Aumentar valor');
    fireEvent.click(incrementButton);

    const valueElements = screen.getAllByText('6');
    expect(valueElements.length).toBeGreaterThan(0);
  });

  it('handles decrement button click', () => {
    render(
      <TouchFriendlySlider 
        question={mockQuestion} 
        onComplete={mockOnComplete}
      />
    );

    const decrementButton = screen.getByLabelText('Diminuir valor');
    fireEvent.click(decrementButton);

    const valueElements = screen.getAllByText('4');
    expect(valueElements.length).toBeGreaterThan(0);
  });

  it('disables increment button at maximum value', () => {
    render(
      <TouchFriendlySlider 
        question={mockQuestion} 
        onComplete={mockOnComplete}
      />
    );

    const incrementButton = screen.getByLabelText('Aumentar valor');
    
    // Click to reach max value (10)
    for (let i = 0; i < 5; i++) {
      fireEvent.click(incrementButton);
    }

    expect(incrementButton).toBeDisabled();
    const valueElements = screen.getAllByText('10');
    expect(valueElements.length).toBeGreaterThan(0);
  });

  it('disables decrement button at minimum value', () => {
    render(
      <TouchFriendlySlider 
        question={mockQuestion} 
        onComplete={mockOnComplete}
      />
    );

    const decrementButton = screen.getByLabelText('Diminuir valor');
    
    // Click to reach min value (0)
    for (let i = 0; i < 5; i++) {
      fireEvent.click(decrementButton);
    }

    expect(decrementButton).toBeDisabled();
    // Check for 0 in multiple places
    const zeroElements = screen.getAllByText('0');
    expect(zeroElements.length).toBeGreaterThan(0);
  });

  it('calls onComplete when continue button is clicked', () => {
    render(
      <TouchFriendlySlider 
        question={mockQuestion} 
        onComplete={mockOnComplete}
      />
    );

    const continueButton = screen.getByText('Continuar');
    fireEvent.click(continueButton);

    expect(mockOnComplete).toHaveBeenCalledWith(5);
    expect(mockOnComplete).toHaveBeenCalledTimes(1);
  });

  it('has proper ARIA attributes', () => {
    render(
      <TouchFriendlySlider 
        question={mockQuestion} 
        onComplete={mockOnComplete}
      />
    );

    const slider = screen.getByRole('slider');
    expect(slider).toHaveAttribute('aria-valuemin', '0');
    expect(slider).toHaveAttribute('aria-valuemax', '10');
    expect(slider).toHaveAttribute('aria-valuenow', '5');
    expect(slider).toHaveAttribute('aria-label', 'Rate your pain level');
  });

  it('continue button meets touch target requirements', () => {
    render(
      <TouchFriendlySlider 
        question={mockQuestion} 
        onComplete={mockOnComplete}
      />
    );

    const continueButton = screen.getByText('Continuar').closest('button');
    expect(continueButton).toHaveClass('min-h-[44px]');
  });

  it('disables continue button when isProcessing is true', () => {
    render(
      <TouchFriendlySlider 
        question={mockQuestion} 
        onComplete={mockOnComplete}
        isProcessing={true}
      />
    );

    const continueButton = screen.getByText('Continuar');
    expect(continueButton).toBeDisabled();
  });
});