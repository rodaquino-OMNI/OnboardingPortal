#!/usr/bin/env node

import axios from 'axios';
import fs from 'fs-extra';

const FRONTEND_URL = 'http://localhost:3000';
const BACKEND_URL = 'http://localhost:8000';

async function healthCheck() {
  console.log('🏥 Frontend Flow Health Check');
  console.log('==============================');

  const results = {
    timestamp: new Date().toISOString(),
    frontend: { accessible: false, error: null },
    backend: { accessible: false, error: null },
    recommendations: []
  };

  // Check Frontend
  try {
    console.log(`🌐 Checking frontend at ${FRONTEND_URL}...`);
    const frontendResponse = await axios.get(FRONTEND_URL, { 
      timeout: 5000,
      validateStatus: () => true 
    });
    
    results.frontend.accessible = frontendResponse.status < 400;
    results.frontend.status = frontendResponse.status;
    results.frontend.headers = frontendResponse.headers;

    if (results.frontend.accessible) {
      console.log('✅ Frontend is accessible');
    } else {
      console.log(`❌ Frontend returned status: ${frontendResponse.status}`);
      results.recommendations.push('Check if frontend development server is running');
    }

  } catch (error) {
    console.log(`❌ Frontend is not accessible: ${error.message}`);
    results.frontend.error = error.message;
    results.frontend.code = error.code;
    
    if (error.code === 'ECONNREFUSED') {
      results.recommendations.push('Start your frontend development server (e.g., npm run dev, yarn dev)');
    }
  }

  // Check Backend API
  try {
    console.log(`🔌 Checking backend API at ${BACKEND_URL}...`);
    const backendResponse = await axios.get(`${BACKEND_URL}/api/health`, { 
      timeout: 5000,
      validateStatus: () => true 
    });
    
    results.backend.accessible = backendResponse.status < 400;
    results.backend.status = backendResponse.status;
    
    if (results.backend.accessible) {
      console.log('✅ Backend API is accessible');
    } else {
      console.log(`❌ Backend API returned status: ${backendResponse.status}`);
    }

  } catch (error) {
    console.log(`❌ Backend API is not accessible: ${error.message}`);
    results.backend.error = error.message;
    results.backend.code = error.code;
    
    if (error.code === 'ECONNREFUSED') {
      results.recommendations.push('Start your Laravel backend server (e.g., php artisan serve)');
    }
  }

  // Check CSRF endpoint
  try {
    console.log('🍪 Checking CSRF cookie endpoint...');
    const csrfResponse = await axios.get(`${BACKEND_URL}/sanctum/csrf-cookie`, {
      timeout: 5000,
      validateStatus: () => true
    });
    
    results.csrf = {
      accessible: csrfResponse.status < 400,
      status: csrfResponse.status,
      hasCookies: !!(csrfResponse.headers['set-cookie'])
    };

    if (results.csrf.accessible) {
      console.log('✅ CSRF endpoint is accessible');
      if (results.csrf.hasCookies) {
        console.log('✅ CSRF cookies are being set');
      } else {
        console.log('⚠️ CSRF endpoint accessible but no cookies set');
        results.recommendations.push('Check Laravel Sanctum configuration');
      }
    }

  } catch (error) {
    console.log(`❌ CSRF endpoint check failed: ${error.message}`);
    results.csrf = { accessible: false, error: error.message };
  }

  // Generate recommendations
  if (!results.frontend.accessible) {
    results.recommendations.push('Ensure frontend is running on http://localhost:3000');
  }
  
  if (!results.backend.accessible) {
    results.recommendations.push('Ensure backend is running on http://localhost:8000');
  }

  if (results.frontend.accessible && results.backend.accessible) {
    results.recommendations.push('Both services are accessible - ready for testing!');
    console.log('🎉 All systems ready for testing!');
  } else {
    console.log('');
    console.log('📋 Recommendations:');
    results.recommendations.forEach(rec => {
      console.log(`  • ${rec}`);
    });
  }

  // Save health check results
  await fs.ensureDir('./logs');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  await fs.writeJson(`./logs/health-check-${timestamp}.json`, results, { spaces: 2 });

  console.log('');
  console.log(`📄 Health check results saved to: ./logs/health-check-${timestamp}.json`);

  return results;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  healthCheck().catch(console.error);
}

export default healthCheck;