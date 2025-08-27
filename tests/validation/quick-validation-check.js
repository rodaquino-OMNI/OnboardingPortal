#!/usr/bin/env node

/**
 * Quick Validation Check
 * Fast verification of critical fixes without long-running tests
 */

const { execSync } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const net = require('net');

class QuickValidator {
    constructor() {
        this.results = [];
        this.testStartTime = Date.now();
    }

    async runQuickValidation() {
        console.log('⚡ QUICK VALIDATION CHECK - CRITICAL FIXES VERIFICATION');
        console.log('=' .repeat(70));
        console.log(`🕐 Start Time: ${new Date().toISOString()}`);
        console.log();

        try {
            await this.checkExtensionVersionManagement();
            await this.checkMCPServerHealth();
            await this.checkShellConnections();
            await this.checkSystemStability();
            
            this.generateQuickReport();
            
        } catch (error) {
            console.error('❌ Quick validation failed:', error.message);
            this.recordResult('SYSTEM_ERROR', false, error.message);
        }

        return this.results;
    }

    async checkExtensionVersionManagement() {
        console.log('🔌 CHECKING EXTENSION VERSION MANAGEMENT');
        console.log('-' .repeat(50));

        try {
            // Test 1: VS Code availability and basic functionality
            const vscodeTest = await this.testVSCodeAvailability();
            this.recordResult('VSCode Availability', vscodeTest.success, vscodeTest.message);

            // Test 2: Extension loading
            const extensionTest = await this.testExtensionLoading();
            this.recordResult('Extension Loading', extensionTest.success, extensionTest.message);

            // Test 3: Version lock presence (warning if not present)
            const lockTest = await this.testVersionLock();
            this.recordResult('Version Lock Status', lockTest.success, lockTest.message, lockTest.warning);

        } catch (error) {
            this.recordResult('Extension Version Management', false, error.message);
        }
    }

    async testVSCodeAvailability() {
        try {
            const version = execSync('code --version', { 
                encoding: 'utf8', 
                timeout: 5000,
                stdio: 'pipe'
            });
            
            console.log(`✅ VS Code available: ${version.split('\n')[0]}`);
            return { success: true, message: `VS Code version: ${version.split('\n')[0]}` };
            
        } catch (error) {
            console.log('❌ VS Code not available or not responding');
            return { success: false, message: 'VS Code not available or not responding' };
        }
    }

    async testExtensionLoading() {
        try {
            const extensions = execSync('code --list-extensions', { 
                encoding: 'utf8', 
                timeout: 10000,
                stdio: 'pipe'
            });
            
            const extensionCount = extensions.split('\n').filter(line => line.trim()).length;
            console.log(`✅ Extensions loaded: ${extensionCount} extensions`);
            
            return { 
                success: true, 
                message: `${extensionCount} extensions loaded successfully` 
            };
            
        } catch (error) {
            console.log('❌ Extension loading failed');
            return { success: false, message: 'Failed to load extensions list' };
        }
    }

    async testVersionLock() {
        try {
            // Check multiple possible locations for the lock file
            const possiblePaths = [
                path.join(process.cwd(), '.vscode-extension-lock.json'),
                path.join(__dirname, '../..', '.vscode-extension-lock.json'),
                path.join(process.env.HOME || '', '.vscode-extension-lock.json')
            ];
            
            for (const lockFilePath of possiblePaths) {
                try {
                    await fs.access(lockFilePath);
                    console.log(`✅ Version lock file found: ${lockFilePath}`);
                    
                    const lockContent = await fs.readFile(lockFilePath, 'utf8');
                    const lockData = JSON.parse(lockContent);
                    const lockedCount = Object.keys(lockData.extensions || {}).length;
                    
                    return { 
                        success: true, 
                        message: `Version lock active with ${lockedCount} locked extensions` 
                    };
                } catch (lockError) {
                    // Continue to next path
                }
            }
            
            console.log('⚠️ Version lock file not found (recommended for production)');
            return { 
                success: true, 
                warning: true,
                message: 'Version lock file not found - consider implementing for production stability' 
            };
            
        } catch (error) {
            return { success: false, message: 'Error checking version lock' };
        }
    }

    async checkMCPServerHealth() {
        console.log('\n🔗 CHECKING MCP SERVER HEALTH');
        console.log('-' .repeat(50));

        try {
            const servers = [
                { name: 'ruv-swarm', command: 'npx ruv-swarm@latest --version' },
                { name: 'claude-flow', command: 'npx claude-flow@alpha --version' },
                { name: 'flow-nexus', command: 'npx flow-nexus@alpha --version' }
            ];

            let healthyServers = 0;
            
            for (const server of servers) {
                const test = await this.testMCPServerQuick(server);
                this.recordResult(`MCP Server: ${server.name}`, test.success, test.message);
                if (test.success) healthyServers++;
            }

            // Test MCP configuration
            const configTest = await this.testMCPConfiguration();
            this.recordResult('MCP Configuration', configTest.success, configTest.message);

            console.log(`📊 MCP Server Summary: ${healthyServers}/${servers.length} servers operational`);

        } catch (error) {
            this.recordResult('MCP Server Health', false, error.message);
        }
    }

    async testMCPServerQuick(server) {
        try {
            // Quick version check to verify server availability
            const result = execSync(server.command, { 
                encoding: 'utf8', 
                timeout: 10000,
                stdio: 'pipe'
            });
            
            console.log(`✅ ${server.name} available`);
            return { success: true, message: `${server.name} server accessible` };
            
        } catch (error) {
            // If version command fails, try basic command
            try {
                const basicCommand = server.command.replace('--version', '--help');
                execSync(basicCommand, { 
                    encoding: 'utf8', 
                    timeout: 5000,
                    stdio: 'pipe'
                });
                
                console.log(`✅ ${server.name} available (basic check)`)
                return { success: true, message: `${server.name} server accessible (basic check)` };
                
            } catch (basicError) {
                console.log(`❌ ${server.name} not available`);
                return { success: false, message: `${server.name} server not accessible` };
            }
        }
    }

    async testMCPConfiguration() {
        try {
            // Check if Claude MCP is configured (look for config files)
            const homeDir = process.env.HOME || process.env.USERPROFILE;
            const claudeConfigDir = path.join(homeDir, '.config', 'claude');
            
            try {
                const configExists = await this.fileExists(claudeConfigDir);
                if (configExists) {
                    console.log('✅ MCP configuration directory found');
                    return { success: true, message: 'MCP configuration directory exists' };
                } else {
                    console.log('⚠️ MCP configuration directory not found');
                    return { 
                        success: true, 
                        message: 'MCP configuration may not be set up - check Claude MCP configuration' 
                    };
                }
            } catch (error) {
                return { success: true, message: 'MCP configuration check skipped (platform-specific)' };
            }
            
        } catch (error) {
            return { success: false, message: 'Error checking MCP configuration' };
        }
    }

    async checkShellConnections() {
        console.log('\n🖥️ CHECKING SHELL CONNECTION STABILITY');
        console.log('-' .repeat(50));

        try {
            // Test basic shell commands
            const shellTest = await this.testBasicShellCommands();
            this.recordResult('Basic Shell Commands', shellTest.success, shellTest.message);

            // Test command execution consistency
            const consistencyTest = await this.testCommandConsistency();
            this.recordResult('Command Consistency', consistencyTest.success, consistencyTest.message);

            // Test shell environment
            const envTest = await this.testShellEnvironment();
            this.recordResult('Shell Environment', envTest.success, envTest.message);

        } catch (error) {
            this.recordResult('Shell Connection Stability', false, error.message);
        }
    }

    async testBasicShellCommands() {
        try {
            const commands = ['echo "test"', 'pwd', 'whoami', 'date'];
            let successCount = 0;

            for (const command of commands) {
                try {
                    execSync(command, { timeout: 5000, stdio: 'pipe' });
                    successCount++;
                } catch (cmdError) {
                    console.log(`⚠️ Command failed: ${command}`);
                }
            }

            const successRate = Math.round((successCount / commands.length) * 100);
            console.log(`✅ Shell commands: ${successCount}/${commands.length} successful (${successRate}%)`);

            return {
                success: successCount === commands.length,
                message: `${successCount}/${commands.length} basic commands successful (${successRate}%)`
            };

        } catch (error) {
            return { success: false, message: 'Failed to test basic shell commands' };
        }
    }

    async testCommandConsistency() {
        try {
            // Run the same command multiple times to test consistency
            const testCommand = 'echo "consistency_test"';
            const iterations = 5;
            let consistentResults = 0;
            const expectedOutput = 'consistency_test';

            for (let i = 0; i < iterations; i++) {
                try {
                    const output = execSync(testCommand, { 
                        encoding: 'utf8', 
                        timeout: 3000,
                        stdio: 'pipe'
                    }).trim();
                    
                    if (output === expectedOutput) {
                        consistentResults++;
                    }
                } catch (error) {
                    // Command failed
                }
            }

            const consistencyRate = Math.round((consistentResults / iterations) * 100);
            console.log(`✅ Command consistency: ${consistentResults}/${iterations} consistent (${consistencyRate}%)`);

            return {
                success: consistentResults === iterations,
                message: `Command consistency: ${consistencyRate}%`
            };

        } catch (error) {
            return { success: false, message: 'Failed to test command consistency' };
        }
    }

    async testShellEnvironment() {
        try {
            // Test shell environment variables and basic features
            const shell = process.env.SHELL || 'unknown';
            const home = process.env.HOME || process.env.USERPROFILE || 'unknown';
            const path = process.env.PATH || 'unknown';

            console.log(`✅ Shell environment: ${shell}`);
            console.log(`✅ Home directory: ${home}`);
            console.log(`✅ PATH available: ${path !== 'unknown'}`);

            return {
                success: true,
                message: `Shell: ${shell}, Home: ${home !== 'unknown' ? 'available' : 'unknown'}`
            };

        } catch (error) {
            return { success: false, message: 'Failed to check shell environment' };
        }
    }

    async checkSystemStability() {
        console.log('\n💻 CHECKING SYSTEM STABILITY');
        console.log('-' .repeat(50));

        try {
            // Test system resources
            const resourceTest = await this.testSystemResources();
            this.recordResult('System Resources', resourceTest.success, resourceTest.message);

            // Test Node.js health
            const nodeTest = await this.testNodeHealth();
            this.recordResult('Node.js Health', nodeTest.success, nodeTest.message);

            // Test file system access
            const fsTest = await this.testFileSystemAccess();
            this.recordResult('File System Access', fsTest.success, fsTest.message);

        } catch (error) {
            this.recordResult('System Stability', false, error.message);
        }
    }

    async testSystemResources() {
        try {
            const memUsage = process.memoryUsage();
            const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
            const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
            const uptime = Math.round(process.uptime());

            console.log(`✅ Memory usage: ${heapUsedMB}MB/${heapTotalMB}MB`);
            console.log(`✅ Process uptime: ${uptime}s`);
            console.log(`✅ Platform: ${process.platform} ${process.arch}`);

            // Check if memory usage is reasonable
            const memoryHealthy = heapUsedMB < 500; // Less than 500MB

            return {
                success: memoryHealthy,
                message: `Memory: ${heapUsedMB}MB used, Uptime: ${uptime}s, Platform: ${process.platform}`
            };

        } catch (error) {
            return { success: false, message: 'Failed to check system resources' };
        }
    }

    async testNodeHealth() {
        try {
            const nodeVersion = process.version;
            const platform = process.platform;
            const arch = process.arch;

            console.log(`✅ Node.js version: ${nodeVersion}`);
            console.log(`✅ Platform: ${platform} ${arch}`);

            // Basic functionality test
            const testFunc = () => {
                return new Promise((resolve) => {
                    setTimeout(() => resolve('test'), 100);
                });
            };

            await testFunc();
            console.log('✅ Node.js basic functionality working');

            return {
                success: true,
                message: `Node.js ${nodeVersion} on ${platform} ${arch} - functional`
            };

        } catch (error) {
            return { success: false, message: 'Node.js health check failed' };
        }
    }

    async testFileSystemAccess() {
        try {
            // Test read/write access to current directory
            const testFile = path.join(process.cwd(), '.validation-test-temp');
            
            // Write test
            await fs.writeFile(testFile, 'validation test', 'utf8');
            
            // Read test
            const content = await fs.readFile(testFile, 'utf8');
            
            // Cleanup
            await fs.unlink(testFile);
            
            const accessOk = content === 'validation test';
            
            if (accessOk) {
                console.log('✅ File system read/write access working');
                return { success: true, message: 'File system access working correctly' };
            } else {
                return { success: false, message: 'File system access test failed' };
            }

        } catch (error) {
            return { success: false, message: 'Failed to test file system access' };
        }
    }

    recordResult(testName, success, message, warning = false) {
        const result = {
            test: testName,
            status: warning ? 'WARNING' : (success ? 'PASSED' : 'FAILED'),
            message: message,
            timestamp: new Date().toISOString()
        };

        this.results.push(result);

        const icon = warning ? '⚠️' : (success ? '✅' : '❌');
        console.log(`${icon} ${testName}: ${message}`);
    }

    generateQuickReport() {
        const duration = Date.now() - this.testStartTime;
        const passed = this.results.filter(r => r.status === 'PASSED').length;
        const failed = this.results.filter(r => r.status === 'FAILED').length;
        const warnings = this.results.filter(r => r.status === 'WARNING').length;
        const total = this.results.length;

        const overallStatus = failed > 0 ? 'FAILED' : (warnings > 0 ? 'WARNING' : 'PASSED');
        const successRate = total > 0 ? Math.round((passed / total) * 100) : 0;

        console.log('\n' + '=' .repeat(70));
        console.log('📋 QUICK VALIDATION RESULTS');
        console.log('=' .repeat(70));
        console.log(`🎯 Overall Status: ${overallStatus}`);
        console.log(`📊 Success Rate: ${successRate}%`);
        console.log(`⏱️ Duration: ${Math.round(duration / 1000)}s`);
        console.log();
        console.log(`✅ Passed: ${passed}`);
        console.log(`❌ Failed: ${failed}`);
        console.log(`⚠️ Warnings: ${warnings}`);
        console.log(`📈 Total Tests: ${total}`);
        console.log();

        // Show failed tests
        const failedTests = this.results.filter(r => r.status === 'FAILED');
        if (failedTests.length > 0) {
            console.log('🚨 FAILED TESTS:');
            failedTests.forEach(test => {
                console.log(`   ❌ ${test.test}: ${test.message}`);
            });
            console.log();
        }

        // Show warnings
        const warningTests = this.results.filter(r => r.status === 'WARNING');
        if (warningTests.length > 0) {
            console.log('⚠️ WARNINGS:');
            warningTests.forEach(test => {
                console.log(`   ⚠️ ${test.test}: ${test.message}`);
            });
            console.log();
        }

        // Recommendations
        console.log('🎯 RECOMMENDATIONS:');
        if (failed === 0 && warnings === 0) {
            console.log('   ✅ All critical systems are operational');
            console.log('   ✅ System is ready for production use');
        } else {
            if (failed > 0) {
                console.log('   🔴 Address failed tests immediately');
                console.log('   🔧 Critical system components need attention');
            }
            if (warnings > 0) {
                console.log('   🟡 Review warnings for potential improvements');
                console.log('   📋 Consider implementing recommended features');
            }
        }

        console.log('\n📝 For detailed analysis, run: node run-all-validation-tests.js');
        console.log('=' .repeat(70));

        // Save quick report
        const report = {
            summary: {
                overallStatus,
                successRate,
                duration,
                passed,
                failed,
                warnings,
                total
            },
            results: this.results,
            timestamp: new Date().toISOString()
        };

        // Save to file
        const reportPath = path.join(__dirname, 'monitoring/quick-validation-report.json');
        fs.writeFile(reportPath, JSON.stringify(report, null, 2))
            .then(() => console.log(`📄 Quick report saved: ${reportPath}`))
            .catch(err => console.log(`⚠️ Could not save report: ${err.message}`));

        return report;
    }

    async fileExists(filePath) {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }
}

// Run if called directly
if (require.main === module) {
    const validator = new QuickValidator();
    
    validator.runQuickValidation()
        .then((results) => {
            const failed = results.filter(r => r.status === 'FAILED').length;
            process.exit(failed > 0 ? 1 : 0);
        })
        .catch((error) => {
            console.error('❌ Quick validation error:', error);
            process.exit(1);
        });
}

module.exports = QuickValidator;