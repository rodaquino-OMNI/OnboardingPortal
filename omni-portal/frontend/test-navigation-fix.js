/**
 * Test script to verify navigation button fix
 * Run this in the browser console on the health questionnaire page
 */

// Function to test navigation state with different values
async function testNavigationFix() {
  console.log('🧪 Testing Health Questionnaire Navigation Fix...\n');
  
  // Get the current question element
  const questionText = document.querySelector('#question-text')?.textContent;
  console.log('Current Question:', questionText);
  
  // Check if we're on an AUDIT-C question
  if (questionText?.includes('álcool') || questionText?.includes('bebidas')) {
    console.log('✅ AUDIT-C question detected');
    
    // Find all option buttons
    const optionButtons = document.querySelectorAll('[role="radio"]');
    console.log(`Found ${optionButtons.length} options`);
    
    // Find the navigation button
    const nextButton = Array.from(document.querySelectorAll('button')).find(
      btn => btn.textContent?.includes('Próximo') || btn.textContent?.includes('Próxima')
    );
    
    if (!nextButton) {
      console.error('❌ Navigation button not found');
      return;
    }
    
    console.log('\n--- Testing First Option (value=0) ---');
    
    // Click the first option (should have value 0)
    const firstOption = optionButtons[0];
    if (firstOption) {
      console.log('Clicking first option:', firstOption.textContent);
      firstOption.click();
      
      // Wait a bit for state to update
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Check if button is enabled
      const isEnabled = !nextButton.disabled;
      const buttonClasses = nextButton.className;
      
      console.log('Navigation button disabled?', nextButton.disabled);
      console.log('Navigation button classes:', buttonClasses);
      
      if (isEnabled) {
        console.log('✅ SUCCESS: Navigation button is ENABLED with first option (value=0)');
      } else {
        console.error('❌ FAIL: Navigation button is still DISABLED with first option');
      }
      
      // Test other options
      console.log('\n--- Testing Other Options ---');
      for (let i = 1; i < Math.min(optionButtons.length, 3); i++) {
        const option = optionButtons[i];
        console.log(`Testing option ${i+1}:`, option.textContent);
        option.click();
        await new Promise(resolve => setTimeout(resolve, 100));
        console.log(`  Button enabled: ${!nextButton.disabled}`);
      }
    }
  } else {
    console.log('ℹ️ Not on an AUDIT-C question. Navigate to one to test the fix.');
  }
  
  // Check navigation hook state if available
  if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
    console.log('\n--- React DevTools Detected ---');
    console.log('You can inspect component state in React DevTools');
  }
  
  console.log('\n🏁 Test Complete');
}

// Run the test
testNavigationFix();

// Export for reuse
window.testNavigationFix = testNavigationFix;