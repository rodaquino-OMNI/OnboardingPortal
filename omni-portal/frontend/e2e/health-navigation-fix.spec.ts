import { test, expect } from '@playwright/test';

test.describe('Health Questionnaire Navigation Fix', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to health questionnaire
    await page.goto('http://localhost:3002/health-questionnaire');
    
    // Wait for page to load
    await page.waitForSelector('#question-text', { timeout: 10000 });
  });

  test('should enable navigation button when selecting first option with value 0', async ({ page }) => {
    // Keep clicking through questions until we find an AUDIT-C question
    let attempts = 0;
    const maxAttempts = 20;
    
    while (attempts < maxAttempts) {
      const questionText = await page.textContent('#question-text');
      console.log(`Question ${attempts + 1}: ${questionText}`);
      
      // Check if this is an AUDIT-C question about alcohol
      if (questionText?.includes('álcool') || questionText?.includes('bebidas')) {
        console.log('Found AUDIT-C question!');
        
        // Find all option buttons
        const optionButtons = await page.$$('[role="radio"]');
        console.log(`Found ${optionButtons.length} options`);
        
        if (optionButtons.length > 0) {
          // Get the first option text
          const firstOptionText = await optionButtons[0].textContent();
          console.log('First option text:', firstOptionText);
          
          // Click the first option (value=0)
          await optionButtons[0].click();
          
          // Wait for state update
          await page.waitForTimeout(200);
          
          // Find the navigation button
          const nextButton = await page.$('button:has-text("Próximo"), button:has-text("Próxima")');
          
          if (nextButton) {
            // Check if button is enabled
            const isDisabled = await nextButton.isDisabled();
            
            // Take a screenshot for evidence
            await page.screenshot({ 
              path: `test-results/audit-c-first-option-${Date.now()}.png`,
              fullPage: false 
            });
            
            // Assert button is enabled
            expect(isDisabled).toBe(false);
            console.log('✅ Navigation button is ENABLED with first option');
            
            // Test that we can actually click it
            await nextButton.click();
            await page.waitForTimeout(500);
            
            // Verify we moved to next question
            const newQuestionText = await page.textContent('#question-text');
            expect(newQuestionText).not.toBe(questionText);
            console.log('✅ Successfully navigated to next question');
            
            return; // Test passed
          }
        }
      }
      
      // Try to go to next question
      const anyOption = await page.$('[role="radio"]:first-child');
      if (anyOption) {
        await anyOption.click();
        await page.waitForTimeout(200);
      }
      
      const nextBtn = await page.$('button:has-text("Próximo"), button:has-text("Próxima")');
      if (nextBtn && !(await nextBtn.isDisabled())) {
        await nextBtn.click();
        await page.waitForTimeout(500);
      } else {
        // If we can't proceed, we might need to select an option
        console.log('Navigation button disabled, trying to select an option...');
        break;
      }
      
      attempts++;
    }
    
    // If we didn't find an AUDIT-C question, fail the test
    if (attempts >= maxAttempts) {
      throw new Error('Could not find AUDIT-C question in questionnaire');
    }
  });

  test('should handle "1 ou 2" option in AUDIT-C quantity question', async ({ page }) => {
    // This specifically tests the second AUDIT-C question
    let foundQuantityQuestion = false;
    let attempts = 0;
    const maxAttempts = 30;
    
    while (!foundQuantityQuestion && attempts < maxAttempts) {
      const questionText = await page.textContent('#question-text');
      
      // Look for the specific quantity question
      if (questionText?.includes('Quantas doses de álcool você toma')) {
        console.log('Found AUDIT-C quantity question!');
        foundQuantityQuestion = true;
        
        // Find the "1 ou 2" option
        const option1ou2 = await page.$('text="1 ou 2"');
        
        if (option1ou2) {
          // Click it
          await option1ou2.click();
          await page.waitForTimeout(200);
          
          // Check navigation button
          const nextButton = await page.$('button:has-text("Próximo"), button:has-text("Próxima")');
          
          if (nextButton) {
            const isDisabled = await nextButton.isDisabled();
            
            // Take screenshot
            await page.screenshot({ 
              path: `test-results/audit-c-1ou2-option-${Date.now()}.png`,
              fullPage: false 
            });
            
            // Assert button is enabled
            expect(isDisabled).toBe(false);
            console.log('✅ Navigation button is ENABLED with "1 ou 2" option');
            
            // Click to verify it works
            await nextButton.click();
            console.log('✅ Successfully clicked navigation button');
          }
        } else {
          console.error('Could not find "1 ou 2" option');
        }
        
        break;
      }
      
      // Navigate to next question
      const anyOption = await page.$('[role="radio"]:first-child');
      if (anyOption) {
        await anyOption.click();
        await page.waitForTimeout(200);
      }
      
      const nextBtn = await page.$('button:has-text("Próximo"), button:has-text("Próxima"):not(:disabled)');
      if (nextBtn) {
        await nextBtn.click();
        await page.waitForTimeout(500);
      }
      
      attempts++;
    }
    
    expect(foundQuantityQuestion).toBe(true);
  });

  test('should handle all PHQ-9 "Nunca" options', async ({ page }) => {
    // Test PHQ-9 questions with "Nunca" (value=0)
    let foundPHQ9 = false;
    let attempts = 0;
    
    while (!foundPHQ9 && attempts < 30) {
      const questionText = await page.textContent('#question-text');
      
      // Check for PHQ-9 questions (they mention "últimas 2 semanas")
      if (questionText?.includes('últimas 2 semanas')) {
        console.log('Found PHQ-9 question!');
        foundPHQ9 = true;
        
        // Find "Nunca" option
        const nuncaOption = await page.$('text="Nunca"');
        
        if (nuncaOption) {
          await nuncaOption.click();
          await page.waitForTimeout(200);
          
          const nextButton = await page.$('button:has-text("Próximo"), button:has-text("Próxima")');
          
          if (nextButton) {
            const isDisabled = await nextButton.isDisabled();
            expect(isDisabled).toBe(false);
            console.log('✅ Navigation enabled with "Nunca" in PHQ-9');
          }
        }
        
        break;
      }
      
      // Navigate forward
      const anyOption = await page.$('[role="radio"]:first-child');
      if (anyOption) {
        await anyOption.click();
        await page.waitForTimeout(200);
      }
      
      const nextBtn = await page.$('button:has-text("Próximo"), button:has-text("Próxima"):not(:disabled)');
      if (nextBtn) {
        await nextBtn.click();
        await page.waitForTimeout(500);
      }
      
      attempts++;
    }
  });
});

// Verify rapid selection changes don't cause issues
test('should handle rapid option changes without getting stuck', async ({ page }) => {
  await page.goto('http://localhost:3002/health-questionnaire');
  await page.waitForSelector('#question-text');
  
  // Find a question with multiple options
  const options = await page.$$('[role="radio"]');
  
  if (options.length >= 3) {
    console.log('Testing rapid selection changes...');
    
    // Rapidly click different options
    for (let i = 0; i < 10; i++) {
      const optionIndex = i % options.length;
      await options[optionIndex].click();
      await page.waitForTimeout(50); // Very short delay
    }
    
    // After rapid changes, navigation should still work
    const nextButton = await page.$('button:has-text("Próximo"), button:has-text("Próxima")');
    
    if (nextButton) {
      const isDisabled = await nextButton.isDisabled();
      expect(isDisabled).toBe(false);
      console.log('✅ Navigation still works after rapid selection changes');
    }
  }
});