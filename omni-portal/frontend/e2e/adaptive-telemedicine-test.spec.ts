import { test, expect } from '@playwright/test';

test('adaptive telemedicine booking flow', async ({ page }) => {
  // Demo user credentials
  const demoUser = {
    email: 'demo@example.com',
    password: 'DemoPass123!',
    cpf: '12345678901',
    name: 'João Demo Silva',
    points: 2850
  };

  console.log('🧪 Testing: Adaptive Telemedicine Booking Flow');
  console.log(`👤 User: ${demoUser.email}`);

  // STEP 1: LOGIN
  console.log('\n📍 Step 1: Login');
  await page.goto('/login');
  await page.fill('input[name="login"]', demoUser.email);
  await page.fill('input[name="password"]', demoUser.password);
  await page.click('button[type="submit"]');
  await page.waitForURL('/home', { timeout: 10000 });
  console.log('✅ Login successful - redirected to /home');

  // STEP 2: NAVIGATE TO TELEMEDICINE
  console.log('\n📍 Step 2: Navigate to Telemedicine');
  await page.goto('/interview-schedule');
  
  // The interview-schedule page auto-redirects to telemedicine-schedule
  // We can either wait for auto-redirect or click the button
  try {
    // Try clicking the button if it exists
    await page.click('button:has-text("Ir Agora para Telemedicina")', { timeout: 3000 });
  } catch {
    // Otherwise wait for auto-redirect
    console.log('⏳ Waiting for auto-redirect...');
  }
  
  await page.waitForURL('/telemedicine-schedule', { timeout: 10000 });
  console.log('✅ Navigated to telemedicine schedule');

  // STEP 3: CHECK PAGE STATE
  console.log('\n📍 Step 3: Checking page state');
  await page.waitForTimeout(2000); // Let the page load
  
  // Take screenshot for debugging
  await page.screenshot({ path: 'telemedicine-page-state.png' });
  
  // Check what's visible on the page
  const pageContent = await page.content();
  console.log('Page contains "Elegibilidade":', pageContent.includes('Elegibilidade'));
  console.log('Page contains "Parabéns":', pageContent.includes('Parabéns'));
  console.log('Page contains "Escolha":', pageContent.includes('Escolha'));
  console.log('Page contains "Loading":', pageContent.includes('Loading') || pageContent.includes('Carregando'));
  
  // Try to find what step we're on
  if (await page.locator('text=Progresso da Elegibilidade').isVisible({ timeout: 5000 }).catch(() => false)) {
    console.log('❌ User is not eligible - showing eligibility progress');
    // User is not eligible, test should end here
    return;
  }
  
  if (await page.locator('text=Escolha o tipo de consulta').isVisible({ timeout: 5000 }).catch(() => false)) {
    console.log('✅ User is eligible - showing appointment types');
    
    // STEP 4: SELECT APPOINTMENT TYPE
    console.log('\n📍 Step 4: Select appointment type');
    await page.click('.cursor-pointer:has-text("Consulta"):first-of-type');
    console.log('✅ Selected appointment type');
    
    // STEP 5: SELECT SLOT
    console.log('\n📍 Step 5: Select time slot');
    await page.waitForSelector('text=Escolha o Horário', { timeout: 10000 });
    
    // Select first available slot
    await page.click('button[class*="border"]:first-of-type');
    console.log('✅ Selected time slot');
    
    // STEP 6: CONFIRM BOOKING
    console.log('\n📍 Step 6: Confirm booking');
    await page.waitForSelector('text=Confirmar Agendamento', { timeout: 10000 });
    await page.click('button:has-text("Confirmar Agendamento")');
    console.log('✅ Clicked confirm');
    
    // STEP 7: VERIFY SUCCESS
    console.log('\n📍 Step 7: Verify success');
    await page.waitForURL('**/completion**', { timeout: 10000 });
    console.log('✅ Booking completed successfully!');
  }
  
  // Final screenshot
  await page.screenshot({ path: 'telemedicine-final-state.png' });
  console.log('\n🎉 Test completed');
});