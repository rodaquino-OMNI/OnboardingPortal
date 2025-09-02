#!/usr/bin/env node

import { spawn } from 'child_process';
import fs from 'fs-extra';
import path from 'path';

const REPORTS_DIR = './reports';
const LOGS_DIR = './logs';

async function runTests() {
  console.log('🚀 Starting Frontend Flow Tests');
  console.log('================================');

  // Ensure directories exist
  await fs.ensureDir(REPORTS_DIR);
  await fs.ensureDir(LOGS_DIR);
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  
  try {
    // Check if frontend is running
    console.log('🔍 Checking if frontend is running on localhost:3000...');
    
    const { default: axios } = await import('axios');
    try {
      await axios.get('http://localhost:3000', { timeout: 5000 });
      console.log('✅ Frontend is accessible');
    } catch (error) {
      console.log('❌ Frontend is not accessible on localhost:3000');
      console.log('   Please ensure your frontend application is running');
      console.log('   Error:', error.message);
      return;
    }

    // Install Playwright browsers if needed
    console.log('🎭 Installing Playwright browsers...');
    await new Promise((resolve, reject) => {
      const install = spawn('npx', ['playwright', 'install'], { stdio: 'inherit' });
      install.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`Playwright install failed with code ${code}`));
      });
    });

    // Run Playwright tests
    console.log('🎬 Running Playwright tests...');
    const playwrightProcess = spawn('npx', ['playwright', 'test', '--reporter=html'], { 
      stdio: 'pipe',
      cwd: process.cwd()
    });

    let output = '';
    let errorOutput = '';

    playwrightProcess.stdout.on('data', (data) => {
      const text = data.toString();
      console.log(text);
      output += text;
    });

    playwrightProcess.stderr.on('data', (data) => {
      const text = data.toString();
      console.error(text);
      errorOutput += text;
    });

    await new Promise((resolve, reject) => {
      playwrightProcess.on('close', (code) => {
        console.log(`🏁 Playwright tests completed with exit code: ${code}`);
        resolve(code);
      });

      playwrightProcess.on('error', (error) => {
        reject(error);
      });
    });

    // Save test output
    await fs.writeFile(
      path.join(LOGS_DIR, `playwright-output-${timestamp}.log`),
      `STDOUT:\n${output}\n\nSTDERR:\n${errorOutput}`
    );

    // Generate summary report
    const summaryReport = {
      timestamp: new Date().toISOString(),
      testRun: 'Frontend Flow Tests',
      playwrightCompleted: true,
      outputLogSaved: true,
      artifacts: {
        screenshots: './screenshots',
        networkLogs: './network',
        consoleLogs: './logs',
        htmlReport: './playwright-report'
      },
      nextSteps: [
        'Review HTML report in ./playwright-report/index.html',
        'Check screenshots in ./screenshots directory',
        'Analyze network logs in ./network directory',
        'Review console errors in ./logs directory'
      ]
    };

    await fs.writeJson(
      path.join(REPORTS_DIR, `test-summary-${timestamp}.json`),
      summaryReport,
      { spaces: 2 }
    );

    console.log('');
    console.log('📊 Test Summary');
    console.log('===============');
    console.log('✅ Tests completed');
    console.log(`📁 Summary report: ${path.join(REPORTS_DIR, `test-summary-${timestamp}.json`)}`);
    console.log(`📄 Playwright output: ${path.join(LOGS_DIR, `playwright-output-${timestamp}.log`)}`);
    console.log('🌐 HTML report: ./playwright-report/index.html');
    console.log('');
    console.log('📂 Test Artifacts:');
    console.log('  - Screenshots: ./screenshots/');
    console.log('  - Network logs: ./network/');
    console.log('  - Console logs: ./logs/');
    console.log('  - Reports: ./reports/');

  } catch (error) {
    console.error('❌ Test execution failed:', error.message);
    
    await fs.writeJson(
      path.join(REPORTS_DIR, `error-report-${timestamp}.json`),
      {
        timestamp: new Date().toISOString(),
        error: error.message,
        stack: error.stack
      },
      { spaces: 2 }
    );
  }
}

runTests().catch(console.error);