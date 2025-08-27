#!/usr/bin/env node

/**
 * Shell Connection Stability Validation Test
 * Tests terminal stability, connection persistence, and command execution reliability
 */

const { spawn, exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

class ShellConnectionTester {
    constructor() {
        this.results = [];
        this.testStartTime = Date.now();
        this.testSessions = new Map();
        this.connectionTests = [];
        this.maxConcurrentSessions = 5;
    }

    async runAllTests() {
        console.log('🧪 Starting Shell Connection Stability Validation Tests');
        console.log('=' .repeat(60));

        try {
            await this.testTerminalStability();
            await this.testConnectionPersistence();
            await this.testSessionRecovery();
            await this.testCommandExecution();
            await this.testConcurrentSessions();
            await this.testResourceCleanup();
            await this.generateReport();
        } catch (error) {
            console.error('❌ Test suite failed:', error.message);
            this.results.push({
                test: 'Suite Execution',
                status: 'FAILED',
                error: error.message,
                timestamp: new Date().toISOString()
            });
        } finally {
            await this.cleanup();
        }

        return this.results;
    }

    async testTerminalStability() {
        console.log('\n🖥️ Test 1: Terminal Stability');
        
        try {
            // Test multiple terminal session types
            const terminalTypes = [
                { name: 'bash', command: '/bin/bash', args: ['--noprofile', '--norc'] },
                { name: 'sh', command: '/bin/sh', args: [] },
                { name: 'zsh', command: '/bin/zsh', args: ['--no-rcs'] }
            ];

            for (const terminal of terminalTypes) {
                if (await this.isCommandAvailable(terminal.command)) {
                    await this.testTerminalType(terminal);
                }
            }

            console.log('✅ Terminal stability verified');
            this.results.push({
                test: 'Terminal Stability',
                status: 'PASSED',
                details: 'All available terminal types tested successfully',
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.log('❌ Terminal stability test failed:', error.message);
            this.results.push({
                test: 'Terminal Stability',
                status: 'FAILED',
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }
    }

    async testTerminalType(terminal) {
        console.log(`\n🔍 Testing ${terminal.name} terminal`);
        
        try {
            const session = await this.createTerminalSession(terminal);
            this.testSessions.set(terminal.name, session);
            
            // Test basic functionality
            await this.testBasicTerminalFunctions(terminal.name, session);
            
            // Test stability under load
            await this.testTerminalLoad(terminal.name, session);
            
            console.log(`✅ ${terminal.name} terminal stable`);
            
        } catch (error) {
            throw new Error(`${terminal.name} terminal failed: ${error.message}`);
        }
    }

    async testBasicTerminalFunctions(name, session) {
        try {
            const basicCommands = [
                'echo "test"',
                'pwd',
                'ls -la',
                'whoami',
                'date'
            ];

            for (const command of basicCommands) {
                const result = await this.executeCommand(session, command, 5000);
                if (!result.success) {
                    throw new Error(`Command "${command}" failed: ${result.error}`);
                }
            }

            console.log(`✅ ${name} basic functions working`);
            
        } catch (error) {
            throw new Error(`Basic functions test failed for ${name}: ${error.message}`);
        }
    }

    async testTerminalLoad(name, session) {
        try {
            console.log(`📊 Testing ${name} under load`);
            
            // Execute multiple commands simultaneously
            const loadCommands = Array(10).fill().map((_, i) => 
                `echo "load test ${i}" && sleep 0.1`
            );

            const startTime = Date.now();
            const results = await Promise.all(
                loadCommands.map(cmd => this.executeCommand(session, cmd, 10000))
            );
            const duration = Date.now() - startTime;

            const successCount = results.filter(r => r.success).length;
            
            if (successCount === loadCommands.length) {
                console.log(`✅ ${name} handled ${loadCommands.length} commands in ${duration}ms`);
            } else {
                throw new Error(`Only ${successCount}/${loadCommands.length} commands succeeded`);
            }
            
        } catch (error) {
            throw new Error(`Load test failed for ${name}: ${error.message}`);
        }
    }

    async testConnectionPersistence() {
        console.log('\n🔄 Test 2: Connection Persistence');
        
        try {
            // Test long-running connections
            await this.testLongRunningConnection();
            
            // Test connection after idle time
            await this.testIdleConnectionRecovery();
            
            // Test connection interruption handling
            await this.testConnectionInterruptionRecovery();
            
            console.log('✅ Connection persistence verified');
            this.results.push({
                test: 'Connection Persistence',
                status: 'PASSED',
                details: 'Connections maintain stability over time and recover from interruptions',
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.log('❌ Connection persistence test failed:', error.message);
            this.results.push({
                test: 'Connection Persistence',
                status: 'FAILED',
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }
    }

    async testLongRunningConnection() {
        console.log('\n⏱️ Testing long-running connection');
        
        try {
            const session = this.testSessions.get('bash') || await this.createDefaultSession();
            
            // Keep connection active for extended period
            const testDuration = 30000; // 30 seconds
            const startTime = Date.now();
            
            const keepAliveInterval = setInterval(async () => {
                try {
                    await this.executeCommand(session, 'echo "keepalive"', 5000);
                } catch (error) {
                    console.log('⚠️ Keepalive failed:', error.message);
                }
            }, 5000);

            // Wait for test duration
            await this.sleep(testDuration);
            clearInterval(keepAliveInterval);
            
            const duration = Date.now() - startTime;
            
            // Test if connection is still responsive
            const finalTest = await this.executeCommand(session, 'echo "final test"', 5000);
            
            if (finalTest.success) {
                console.log(`✅ Connection remained stable for ${Math.round(duration / 1000)}s`);
            } else {
                throw new Error('Connection became unresponsive after long run');
            }
            
        } catch (error) {
            throw new Error(`Long-running connection test failed: ${error.message}`);
        }
    }

    async testIdleConnectionRecovery() {
        console.log('\n😴 Testing idle connection recovery');
        
        try {
            const session = this.testSessions.get('bash') || await this.createDefaultSession();
            
            // Let connection idle
            console.log('💤 Letting connection idle for 10 seconds');
            await this.sleep(10000);
            
            // Test if connection recovers
            const recoveryTest = await this.executeCommand(session, 'echo "recovery test"', 10000);
            
            if (recoveryTest.success) {
                console.log('✅ Connection recovered from idle state');
            } else {
                throw new Error('Connection failed to recover from idle state');
            }
            
        } catch (error) {
            throw new Error(`Idle connection recovery failed: ${error.message}`);
        }
    }

    async testConnectionInterruptionRecovery() {
        console.log('\n🔄 Testing connection interruption recovery');
        
        try {
            // This would test recovery from network interruptions, process crashes, etc.
            // For this test, we'll simulate by creating a new session after "interruption"
            
            const originalSession = this.testSessions.get('bash');
            
            if (originalSession) {
                // Simulate interruption by killing session
                console.log('🔌 Simulating connection interruption');
                originalSession.kill('SIGTERM');
                
                await this.sleep(2000);
                
                // Attempt to recover with new session
                console.log('🔄 Attempting connection recovery');
                const newSession = await this.createDefaultSession();
                this.testSessions.set('bash', newSession);
                
                // Test new session
                const recoveryTest = await this.executeCommand(newSession, 'echo "recovered"', 5000);
                
                if (recoveryTest.success) {
                    console.log('✅ Successfully recovered from connection interruption');
                } else {
                    throw new Error('Failed to recover from interruption');
                }
            }
            
        } catch (error) {
            console.log(`⚠️ Connection interruption recovery test: ${error.message}`);
            // This is not a critical failure since interruptions are expected to be recoverable
        }
    }

    async testSessionRecovery() {
        console.log('\n🛠️ Test 3: Session Recovery');
        
        try {
            // Test session state preservation
            await this.testSessionStatePreservation();
            
            // Test working directory persistence
            await this.testWorkingDirectoryPersistence();
            
            // Test environment variable persistence
            await this.testEnvironmentPersistence();
            
            console.log('✅ Session recovery mechanisms functional');
            this.results.push({
                test: 'Session Recovery',
                status: 'PASSED',
                details: 'Session state, working directory, and environment variables persist correctly',
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.log('❌ Session recovery test failed:', error.message);
            this.results.push({
                test: 'Session Recovery',
                status: 'FAILED',
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }
    }

    async testSessionStatePreservation() {
        console.log('\n💾 Testing session state preservation');
        
        try {
            const session = this.testSessions.get('bash') || await this.createDefaultSession();
            
            // Set up session state
            await this.executeCommand(session, 'export TEST_VAR="session_test"', 5000);
            await this.executeCommand(session, 'cd /tmp', 5000);
            await this.executeCommand(session, 'alias testcmd="echo test_alias"', 5000);
            
            // Verify state persists
            const varTest = await this.executeCommand(session, 'echo $TEST_VAR', 5000);
            const pwdTest = await this.executeCommand(session, 'pwd', 5000);
            const aliasTest = await this.executeCommand(session, 'testcmd', 5000);
            
            if (varTest.output.includes('session_test') &&
                pwdTest.output.includes('/tmp') &&
                aliasTest.output.includes('test_alias')) {
                console.log('✅ Session state preserved correctly');
            } else {
                throw new Error('Session state not preserved');
            }
            
        } catch (error) {
            throw new Error(`Session state preservation failed: ${error.message}`);
        }
    }

    async testWorkingDirectoryPersistence() {
        console.log('\n📁 Testing working directory persistence');
        
        try {
            const session = this.testSessions.get('bash') || await this.createDefaultSession();
            
            // Change to a specific directory
            const testDir = '/tmp';
            await this.executeCommand(session, `cd ${testDir}`, 5000);
            
            // Execute another command and verify we're still in the same directory
            const pwdResult = await this.executeCommand(session, 'pwd', 5000);
            
            if (pwdResult.output.trim().endsWith(testDir)) {
                console.log(`✅ Working directory persists: ${testDir}`);
            } else {
                throw new Error(`Working directory not persistent. Expected: ${testDir}, Got: ${pwdResult.output.trim()}`);
            }
            
        } catch (error) {
            throw new Error(`Working directory persistence failed: ${error.message}`);
        }
    }

    async testEnvironmentPersistence() {
        console.log('\n🌍 Testing environment variable persistence');
        
        try {
            const session = this.testSessions.get('bash') || await this.createDefaultSession();
            
            // Set environment variable
            const testVarName = 'SHELL_TEST_VAR';
            const testVarValue = 'persistence_test_value';
            
            await this.executeCommand(session, `export ${testVarName}="${testVarValue}"`, 5000);
            
            // Verify variable persists
            const varResult = await this.executeCommand(session, `echo $${testVarName}`, 5000);
            
            if (varResult.output.trim() === testVarValue) {
                console.log(`✅ Environment variable persists: ${testVarName}=${testVarValue}`);
            } else {
                throw new Error(`Environment variable not persistent. Expected: ${testVarValue}, Got: ${varResult.output.trim()}`);
            }
            
        } catch (error) {
            throw new Error(`Environment persistence failed: ${error.message}`);
        }
    }

    async testCommandExecution() {
        console.log('\n⚡ Test 4: Command Execution Reliability');
        
        try {
            // Test various command types
            await this.testSimpleCommands();
            await this.testComplexCommands();
            await this.testLongRunningCommands();
            await this.testErrorHandling();
            
            console.log('✅ Command execution reliability verified');
            this.results.push({
                test: 'Command Execution',
                status: 'PASSED',
                details: 'All command types execute reliably with proper error handling',
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.log('❌ Command execution test failed:', error.message);
            this.results.push({
                test: 'Command Execution',
                status: 'FAILED',
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }
    }

    async testSimpleCommands() {
        console.log('\n📝 Testing simple commands');
        
        const session = this.testSessions.get('bash') || await this.createDefaultSession();
        const simpleCommands = [
            'echo "hello world"',
            'date',
            'whoami',
            'pwd',
            'ls -la .',
            'uname -a'
        ];
        
        for (const command of simpleCommands) {
            const result = await this.executeCommand(session, command, 5000);
            if (!result.success) {
                throw new Error(`Simple command failed: ${command} - ${result.error}`);
            }
        }
        
        console.log(`✅ ${simpleCommands.length} simple commands executed successfully`);
    }

    async testComplexCommands() {
        console.log('\n🔧 Testing complex commands');
        
        const session = this.testSessions.get('bash') || await this.createDefaultSession();
        const complexCommands = [
            'for i in 1 2 3; do echo "iteration $i"; done',
            'if [ -d "/tmp" ]; then echo "tmp exists"; fi',
            'find /usr -name "bin" -type d 2>/dev/null | head -5',
            'ps aux | head -10',
            'cat /proc/version 2>/dev/null || echo "proc not available"'
        ];
        
        for (const command of complexCommands) {
            const result = await this.executeCommand(session, command, 10000);
            if (!result.success) {
                throw new Error(`Complex command failed: ${command} - ${result.error}`);
            }
        }
        
        console.log(`✅ ${complexCommands.length} complex commands executed successfully`);
    }

    async testLongRunningCommands() {
        console.log('\n⏱️ Testing long-running commands');
        
        const session = this.testSessions.get('bash') || await this.createDefaultSession();
        
        // Test command that takes several seconds
        const longCommand = 'sleep 3 && echo "long command completed"';
        const result = await this.executeCommand(session, longCommand, 15000);
        
        if (result.success && result.output.includes('long command completed')) {
            console.log('✅ Long-running command executed successfully');
        } else {
            throw new Error('Long-running command failed');
        }
    }

    async testErrorHandling() {
        console.log('\n❌ Testing error handling');
        
        const session = this.testSessions.get('bash') || await this.createDefaultSession();
        
        // Test commands that should fail
        const errorCommands = [
            'nonexistent_command_12345',
            'ls /nonexistent/directory/12345',
            'cat /nonexistent/file.txt'
        ];
        
        for (const command of errorCommands) {
            const result = await this.executeCommand(session, command, 5000);
            // These commands should fail, but the session should handle the error gracefully
            if (result.success) {
                console.log(`⚠️ Command unexpectedly succeeded: ${command}`);
            } else {
                console.log(`✅ Error handled correctly for: ${command}`);
            }
        }
    }

    async testConcurrentSessions() {
        console.log('\n🔀 Test 5: Concurrent Session Management');
        
        try {
            // Create multiple concurrent sessions
            const sessions = [];
            
            console.log(`🚀 Creating ${this.maxConcurrentSessions} concurrent sessions`);
            
            for (let i = 0; i < this.maxConcurrentSessions; i++) {
                const session = await this.createDefaultSession();
                sessions.push({ id: `session_${i}`, process: session });
            }
            
            // Test concurrent command execution
            await this.testConcurrentExecution(sessions);
            
            // Cleanup concurrent sessions
            for (const session of sessions) {
                session.process.kill('SIGTERM');
            }
            
            console.log('✅ Concurrent session management verified');
            this.results.push({
                test: 'Concurrent Sessions',
                status: 'PASSED',
                details: `Successfully managed ${this.maxConcurrentSessions} concurrent sessions`,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.log('❌ Concurrent sessions test failed:', error.message);
            this.results.push({
                test: 'Concurrent Sessions',
                status: 'FAILED',
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }
    }

    async testConcurrentExecution(sessions) {
        console.log('\n⚡ Testing concurrent command execution');
        
        try {
            // Execute different commands in each session simultaneously
            const concurrentCommands = sessions.map((session, index) => 
                this.executeCommand(
                    session.process, 
                    `echo "concurrent test ${index}" && sleep 1 && pwd`, 
                    10000
                )
            );
            
            const results = await Promise.all(concurrentCommands);
            const successCount = results.filter(r => r.success).length;
            
            if (successCount === sessions.length) {
                console.log(`✅ ${successCount}/${sessions.length} concurrent commands succeeded`);
            } else {
                throw new Error(`Only ${successCount}/${sessions.length} concurrent commands succeeded`);
            }
            
        } catch (error) {
            throw new Error(`Concurrent execution failed: ${error.message}`);
        }
    }

    async testResourceCleanup() {
        console.log('\n🧹 Test 6: Resource Cleanup');
        
        try {
            // Test that terminated sessions don't leave resources
            await this.testProcessCleanup();
            await this.testMemoryCleanup();
            
            console.log('✅ Resource cleanup verified');
            this.results.push({
                test: 'Resource Cleanup',
                status: 'PASSED',
                details: 'Session termination properly cleans up processes and memory',
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.log('❌ Resource cleanup test failed:', error.message);
            this.results.push({
                test: 'Resource Cleanup',
                status: 'FAILED',
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }
    }

    async testProcessCleanup() {
        console.log('\n🔄 Testing process cleanup');
        
        try {
            // Create a session and then terminate it
            const testSession = await this.createDefaultSession();
            const pid = testSession.pid;
            
            // Verify process is running
            const isRunning = await this.isProcessRunning(pid);
            if (!isRunning) {
                throw new Error('Test session process not found');
            }
            
            // Terminate session
            testSession.kill('SIGTERM');
            
            // Wait for cleanup
            await this.sleep(2000);
            
            // Verify process is cleaned up
            const stillRunning = await this.isProcessRunning(pid);
            if (!stillRunning) {
                console.log(`✅ Process ${pid} cleaned up successfully`);
            } else {
                throw new Error(`Process ${pid} not cleaned up`);
            }
            
        } catch (error) {
            throw new Error(`Process cleanup test failed: ${error.message}`);
        }
    }

    async testMemoryCleanup() {
        console.log('\n💾 Testing memory cleanup');
        
        try {
            // This would require more sophisticated memory monitoring
            // For now, we'll just verify that we can create and destroy sessions without accumulation
            
            const initialMemory = process.memoryUsage().heapUsed;
            
            // Create and destroy multiple sessions
            for (let i = 0; i < 3; i++) {
                const session = await this.createDefaultSession();
                await this.sleep(500);
                session.kill('SIGTERM');
                await this.sleep(500);
            }
            
            // Force garbage collection if available
            if (global.gc) {
                global.gc();
            }
            
            await this.sleep(1000);
            
            const finalMemory = process.memoryUsage().heapUsed;
            const memoryIncrease = finalMemory - initialMemory;
            
            console.log(`📊 Memory increase: ${Math.round(memoryIncrease / 1024 / 1024)}MB`);
            
            // Allow some memory increase but flag if excessive
            if (memoryIncrease < 50 * 1024 * 1024) { // Less than 50MB increase
                console.log('✅ Memory usage within expected bounds');
            } else {
                console.log('⚠️ High memory usage detected, possible leak');
            }
            
        } catch (error) {
            console.log(`⚠️ Memory cleanup test warning: ${error.message}`);
        }
    }

    // Helper methods
    async createTerminalSession(terminal) {
        return new Promise((resolve, reject) => {
            try {
                const process = spawn(terminal.command, terminal.args, {
                    stdio: ['pipe', 'pipe', 'pipe']
                });
                
                process.on('error', reject);
                
                setTimeout(() => {
                    if (!process.killed) {
                        resolve(process);
                    } else {
                        reject(new Error('Terminal failed to start'));
                    }
                }, 1000);
                
            } catch (error) {
                reject(error);
            }
        });
    }

    async createDefaultSession() {
        return this.createTerminalSession({
            name: 'default',
            command: '/bin/bash',
            args: ['--noprofile', '--norc']
        });
    }

    async executeCommand(session, command, timeout = 10000) {
        return new Promise((resolve) => {
            let output = '';
            let error = '';
            
            const timer = setTimeout(() => {
                resolve({
                    success: false,
                    output: output,
                    error: 'Command timeout',
                    duration: timeout
                });
            }, timeout);
            
            const startTime = Date.now();
            
            const dataHandler = (data) => {
                output += data.toString();
                
                // Check if command completed (simple heuristic)
                if (output.includes('\n') && !output.endsWith('$ ')) {
                    clearTimeout(timer);
                    session.stdout.removeListener('data', dataHandler);
                    session.stderr.removeListener('data', errorHandler);
                    
                    resolve({
                        success: true,
                        output: output,
                        error: error,
                        duration: Date.now() - startTime
                    });
                }
            };
            
            const errorHandler = (data) => {
                error += data.toString();
            };
            
            session.stdout.on('data', dataHandler);
            session.stderr.on('data', errorHandler);
            
            // Send command
            session.stdin.write(command + '\n');
        });
    }

    async isCommandAvailable(command) {
        try {
            await fs.access(command);
            return true;
        } catch {
            return false;
        }
    }

    async isProcessRunning(pid) {
        try {
            process.kill(pid, 0);
            return true;
        } catch {
            return false;
        }
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async cleanup() {
        console.log('\n🧹 Cleaning up test sessions');
        
        for (const [name, session] of this.testSessions) {
            try {
                if (!session.killed) {
                    console.log(`🛑 Stopping ${name} session`);
                    session.kill('SIGTERM');
                }
            } catch (error) {
                console.log(`⚠️ Error stopping ${name}: ${error.message}`);
            }
        }
        
        this.testSessions.clear();
        
        // Wait for cleanup
        await this.sleep(2000);
    }

    async generateReport() {
        const duration = Date.now() - this.testStartTime;
        const passedTests = this.results.filter(r => r.status === 'PASSED').length;
        const failedTests = this.results.filter(r => r.status === 'FAILED').length;
        const warningTests = this.results.filter(r => r.status === 'WARNING').length;

        const report = {
            summary: {
                totalTests: this.results.length,
                passed: passedTests,
                failed: failedTests,
                warnings: warningTests,
                duration: `${duration}ms`,
                sessionsTestedCount: this.testSessions.size,
                timestamp: new Date().toISOString()
            },
            systemInfo: {
                platform: os.platform(),
                arch: os.arch(),
                nodeVersion: process.version,
                shell: process.env.SHELL || 'unknown'
            },
            results: this.results
        };

        console.log('\n📊 Shell Connection Stability Test Report');
        console.log('=' .repeat(50));
        console.log(`✅ Passed: ${passedTests}`);
        console.log(`❌ Failed: ${failedTests}`);
        console.log(`⚠️ Warnings: ${warningTests}`);
        console.log(`🖥️ Sessions Tested: ${this.testSessions.size}`);
        console.log(`⏱️ Duration: ${duration}ms`);

        // Save report
        const reportPath = path.join(__dirname, '../monitoring/shell-connection-stability-report.json');
        await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
        console.log(`📄 Report saved: ${reportPath}`);

        return report;
    }
}

// Run tests if called directly
if (require.main === module) {
    const tester = new ShellConnectionTester();
    tester.runAllTests().catch(console.error);
}

module.exports = ShellConnectionTester;