import { test, expect } from '@playwright/test';

test('working telemedicine flow - direct navigation', async ({ page }) => {
  console.log('🎯 Testing Telemedicine Flow with Direct Navigation');
  
  // Set up authenticated state by setting localStorage
  await page.goto('/');
  await page.evaluate(() => {
    const authData = {
      state: {
        user: {
          id: 17,
          fullName: "João Demo Silva",
          email: "demo@example.com",
          cpf: "35197258073",
          points: 2850,
          level: 5,
          lgpd_consent: true,
          lgpd_consent_at: "2025-08-01T20:34:37.000000Z",
          last_login_at: new Date().toISOString()
        },
        token: "secured-httponly-cookie"
      },
      version: 0
    };
    localStorage.setItem('auth-storage', JSON.stringify(authData));
  });
  
  console.log('✅ Auth state set in localStorage');
  
  // Navigate directly to telemedicine schedule
  await page.goto('/telemedicine-schedule');
  console.log('✅ Navigated to telemedicine schedule');
  
  // Wait for page to load
  await page.waitForTimeout(3000);
  
  // Take screenshot to see what's displayed
  await page.screenshot({ path: 'telemedicine-authenticated.png' });
  
  // Check if we see eligibility or appointment types
  const pageContent = await page.content();
  
  if (pageContent.includes('Verificando elegibilidade')) {
    console.log('⏳ Page is checking eligibility...');
    await page.waitForTimeout(5000);
  }
  
  // Check what's displayed
  if (await page.locator('text=Parabéns').isVisible({ timeout: 5000 }).catch(() => false)) {
    console.log('✅ User is eligible - showing success message');
    
    // Try to find and click appointment type
    if (await page.locator('text=Consulta Inicial').isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('✅ Appointment types are visible');
      
      // Click on first appointment type
      await page.click('.cursor-pointer:has-text("Consulta Inicial"):first-of-type');
      console.log('✅ Selected appointment type');
      
      // Wait for slots to load
      await page.waitForTimeout(3000);
      
      // Check if we're on slot selection
      if (await page.locator('text=Escolha o Horário').isVisible({ timeout: 5000 }).catch(() => false)) {
        console.log('✅ Slot selection page loaded');
        
        // Take screenshot
        await page.screenshot({ path: 'slot-selection.png' });
        
        // Try to click first slot
        const slots = page.locator('button[class*="border"]');
        const slotCount = await slots.count();
        console.log(`📅 Found ${slotCount} available slots`);
        
        if (slotCount > 0) {
          await slots.first().click();
          console.log('✅ Selected first available slot');
          
          // Wait for confirmation page
          await page.waitForTimeout(3000);
          
          if (await page.locator('text=Confirmar Agendamento').isVisible({ timeout: 5000 }).catch(() => false)) {
            console.log('✅ Confirmation page loaded');
            await page.screenshot({ path: 'confirmation-page.png' });
            
            // Click confirm
            await page.click('button:has-text("Confirmar Agendamento")');
            console.log('✅ Clicked confirm button');
            
            // Wait for success
            await page.waitForTimeout(5000);
            
            // Take final screenshot
            await page.screenshot({ path: 'booking-result.png' });
            
            const finalUrl = page.url();
            console.log('📍 Final URL:', finalUrl);
            
            if (finalUrl.includes('completion')) {
              console.log('🎉 Booking completed successfully!');
            }
          }
        }
      }
    }
  } else if (pageContent.includes('Progresso da Elegibilidade')) {
    console.log('❌ User is not eligible');
    await page.screenshot({ path: 'not-eligible.png' });
  } else {
    console.log('❓ Unknown state');
    console.log('Page contains:', {
      parabens: pageContent.includes('Parabéns'),
      elegibilidade: pageContent.includes('Elegibilidade'),
      loading: pageContent.includes('Loading') || pageContent.includes('Carregando'),
      error: pageContent.includes('error') || pageContent.includes('erro')
    });
  }
});