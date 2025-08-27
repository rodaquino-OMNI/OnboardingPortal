// Test to verify PHQ-9 validation logic
// Run this in the browser console to check navigation state

const testPHQ9Validation = () => {
  // Test cases for different value types
  const testCases = [
    { value: 0, type: 'select', required: true, expected: true, description: 'Numeric 0 for select' },
    { value: '0', type: 'select', required: true, expected: true, description: 'String "0" for select' },
    { value: '', type: 'select', required: true, expected: false, description: 'Empty string for select' },
    { value: null, type: 'select', required: true, expected: false, description: 'Null for select' },
    { value: undefined, type: 'select', required: true, expected: false, description: 'Undefined for select' },
    { value: false, type: 'boolean', required: true, expected: true, description: 'False for boolean' },
    { value: true, type: 'boolean', required: true, expected: true, description: 'True for boolean' },
    { value: 0, type: 'number', required: true, expected: true, description: 'Zero for number' },
  ];

  const checkHasValue = (currentValue, questionType) => {
    let hasValue = false;
    
    if (currentValue !== null && currentValue !== undefined) {
      if (questionType === 'boolean') {
        hasValue = typeof currentValue === 'boolean';
      }
      else if (questionType === 'select') {
        if (typeof currentValue === 'number') {
          hasValue = true; // All numbers including 0 are valid
        } else if (typeof currentValue === 'string') {
          hasValue = currentValue !== ''; // Only empty string is invalid
        } else {
          hasValue = currentValue !== null && currentValue !== undefined;
        }
      }
      else if (questionType === 'number') {
        hasValue = typeof currentValue === 'number';
      }
    }
    
    return hasValue;
  };

  console.log('=== PHQ-9 Validation Test Results ===');
  
  testCases.forEach(test => {
    const hasValue = checkHasValue(test.value, test.type);
    const canNavigate = !test.required || hasValue;
    const passed = canNavigate === test.expected;
    
    console.log(
      `${passed ? '✅' : '❌'} ${test.description}:`,
      `Value=${JSON.stringify(test.value)}, hasValue=${hasValue}, canNavigate=${canNavigate}, Expected=${test.expected}`
    );
  });
};

// Export for browser console
window.testPHQ9Validation = testPHQ9Validation;
console.log('Test loaded. Run testPHQ9Validation() to test PHQ-9 validation logic.');