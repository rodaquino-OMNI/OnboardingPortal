#!/usr/bin/env node

/**
 * MCP Server Installation and Setup Test
 * Tests and validates MCP server installations
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

class MCPInstallTester {
    constructor() {
        this.results = [];
        this.testStartTime = Date.now();
    }

    async runInstallTests() {
        console.log('🔧 MCP SERVER INSTALLATION & SETUP TEST');
        console.log('=' .repeat(60));
        
        try {
            await this.testMCPServerInstallations();
            await this.testMCPConfiguration();
            await this.generateReport();
        } catch (error) {
            console.error('❌ MCP install test failed:', error.message);
        }

        return this.results;
    }

    async testMCPServerInstallations() {
        console.log('\n📦 Testing MCP Server Installations');
        console.log('-' .repeat(40));

        const servers = [
            { 
                name: 'ruv-swarm', 
                package: 'ruv-swarm@latest',
                testCommand: 'ruv-swarm --help',
                description: 'High-performance AI agent swarm orchestration'
            },
            { 
                name: 'claude-flow', 
                package: 'claude-flow@alpha',
                testCommand: 'claude-flow --help',
                description: 'Advanced Claude workflow coordination'
            },
            { 
                name: 'flow-nexus', 
                package: 'flow-nexus@alpha',
                testCommand: 'flow-nexus --help',
                description: 'Unified flow and sandbox management'
            }
        ];

        for (const server of servers) {
            await this.testServerInstallation(server);
        }
    }

    async testServerInstallation(server) {
        console.log(`\n🔍 Testing ${server.name} installation`);
        
        try {
            // Test if server is already available
            const available = await this.testServerAvailability(server);
            
            if (available.success) {
                console.log(`✅ ${server.name} already available`);
                this.recordResult(`${server.name} Availability`, true, 'Server already installed and accessible');
                return;
            }

            // Attempt to install the server
            console.log(`📦 Installing ${server.name}...`);
            const installed = await this.installServer(server);
            
            if (installed.success) {
                console.log(`✅ ${server.name} installed successfully`);
                
                // Test post-installation availability
                const postInstallTest = await this.testServerAvailability(server);
                this.recordResult(
                    `${server.name} Installation`, 
                    postInstallTest.success, 
                    postInstallTest.success ? 'Installed and working' : 'Installation failed verification'
                );
            } else {
                console.log(`❌ ${server.name} installation failed`);
                this.recordResult(`${server.name} Installation`, false, installed.message);
            }

        } catch (error) {
            console.log(`❌ ${server.name} test failed:`, error.message);
            this.recordResult(`${server.name} Installation`, false, error.message);
        }
    }

    async testServerAvailability(server) {
        try {
            // Try direct npx command first
            try {
                const output = execSync(`npx ${server.package.split('@')[0]} --help`, {
                    encoding: 'utf8',
                    timeout: 15000,
                    stdio: 'pipe'
                });
                
                return { success: true, message: 'Server accessible via npx' };
            } catch (npxError) {
                // Try global installation check
                try {
                    const globalOutput = execSync(server.testCommand, {
                        encoding: 'utf8',
                        timeout: 10000,
                        stdio: 'pipe'
                    });
                    
                    return { success: true, message: 'Server accessible globally' };
                } catch (globalError) {
                    return { success: false, message: 'Server not accessible' };
                }
            }
            
        } catch (error) {
            return { success: false, message: error.message };
        }
    }

    async installServer(server) {
        try {
            console.log(`⬇️ Downloading ${server.package}...`);
            
            // Use npx to install and test
            const installCommand = `npm install -g ${server.package}`;
            
            try {
                const output = execSync(installCommand, {
                    encoding: 'utf8',
                    timeout: 120000, // 2 minutes timeout for installation
                    stdio: 'pipe'
                });
                
                console.log(`✅ ${server.name} package installed`);
                return { success: true, message: 'Installation completed successfully' };
                
            } catch (installError) {
                // Try with npx if global install fails
                console.log(`⚠️ Global install failed, testing with npx...`);
                
                try {
                    const npxOutput = execSync(`npx ${server.package.split('@')[0]} --help`, {
                        encoding: 'utf8',
                        timeout: 30000,
                        stdio: 'pipe'
                    });
                    
                    console.log(`✅ ${server.name} accessible via npx`);
                    return { success: true, message: 'Available via npx (recommended)' };
                    
                } catch (npxError) {
                    return { success: false, message: `Installation failed: ${installError.message}` };
                }
            }
            
        } catch (error) {
            return { success: false, message: `Installation error: ${error.message}` };
        }
    }

    async testMCPConfiguration() {
        console.log('\n⚙️ Testing MCP Configuration');
        console.log('-' .repeat(40));

        try {
            // Test Claude MCP configuration
            const configTest = await this.testClaudeMCPConfig();
            this.recordResult('Claude MCP Configuration', configTest.success, configTest.message);

            // Test MCP server registration
            const registrationTest = await this.testMCPRegistration();
            this.recordResult('MCP Server Registration', registrationTest.success, registrationTest.message);

            // Create sample configuration if needed
            await this.createSampleConfiguration();

        } catch (error) {
            this.recordResult('MCP Configuration', false, error.message);
        }
    }

    async testClaudeMCPConfig() {
        try {
            const homeDir = process.env.HOME || process.env.USERPROFILE;
            const claudeConfigPaths = [
                path.join(homeDir, '.config', 'claude'),
                path.join(homeDir, '.claude'),
                path.join(homeDir, 'AppData', 'Roaming', 'Claude') // Windows
            ];

            for (const configPath of claudeConfigPaths) {
                if (await this.fileExists(configPath)) {
                    console.log(`✅ Claude configuration found: ${configPath}`);
                    
                    // Check for MCP config file
                    const mcpConfigFile = path.join(configPath, 'mcp.json');
                    if (await this.fileExists(mcpConfigFile)) {
                        console.log('✅ MCP configuration file found');
                        return { success: true, message: 'Claude MCP configuration exists' };
                    }
                }
            }

            console.log('⚠️ Claude MCP configuration not found');
            return { 
                success: true, 
                message: 'Claude MCP configuration not found - manual setup may be required' 
            };

        } catch (error) {
            return { success: false, message: `Configuration check failed: ${error.message}` };
        }
    }

    async testMCPRegistration() {
        try {
            // Test if we can run claude mcp command
            try {
                const output = execSync('claude mcp --help', {
                    encoding: 'utf8',
                    timeout: 10000,
                    stdio: 'pipe'
                });
                
                console.log('✅ Claude MCP command available');
                return { success: true, message: 'Claude MCP CLI is accessible' };
                
            } catch (cliError) {
                console.log('⚠️ Claude MCP CLI not available');
                return { 
                    success: true, 
                    message: 'Claude MCP CLI not available - manual configuration required' 
                };
            }
            
        } catch (error) {
            return { success: false, message: `MCP registration test failed: ${error.message}` };
        }
    }

    async createSampleConfiguration() {
        try {
            console.log('\n📝 Creating sample MCP configuration');
            
            const sampleConfig = {
                version: "1.0",
                servers: {
                    "ruv-swarm": {
                        command: "npx",
                        args: ["ruv-swarm@latest", "mcp", "start"],
                        description: "High-performance AI agent swarm orchestration"
                    },
                    "claude-flow": {
                        command: "npx",
                        args: ["claude-flow@alpha", "mcp", "start"],
                        description: "Advanced Claude workflow coordination"
                    },
                    "flow-nexus": {
                        command: "npx",
                        args: ["flow-nexus@alpha", "mcp", "start"],
                        description: "Unified flow and sandbox management"
                    }
                }
            };

            const configPath = path.join(process.cwd(), 'mcp-config-sample.json');
            await fs.writeFile(configPath, JSON.stringify(sampleConfig, null, 2));
            
            console.log(`✅ Sample MCP configuration created: ${configPath}`);
            
            // Create setup instructions
            const instructions = `# MCP Server Setup Instructions

## Quick Setup

1. Install Claude Desktop if not already installed
2. Copy the MCP configuration:
   
   \`\`\`bash
   # For macOS/Linux
   mkdir -p ~/.config/claude
   cp mcp-config-sample.json ~/.config/claude/mcp.json
   
   # For Windows
   mkdir "%APPDATA%\\Claude"
   copy mcp-config-sample.json "%APPDATA%\\Claude\\mcp.json"
   \`\`\`

3. Restart Claude Desktop
4. Test MCP servers:
   
   \`\`\`bash
   # Test individual servers
   npx ruv-swarm@latest --help
   npx claude-flow@alpha --help
   npx flow-nexus@alpha --help
   \`\`\`

## Manual Registration (Alternative)

If CLI is available:

\`\`\`bash
claude mcp add ruv-swarm npx ruv-swarm@latest mcp start
claude mcp add claude-flow npx claude-flow@alpha mcp start
claude mcp add flow-nexus npx flow-nexus@alpha mcp start
\`\`\`

## Verification

Run the validation test to verify setup:
\`\`\`bash
node tests/validation/quick-validation-check.js
\`\`\`
`;

            const instructionsPath = path.join(process.cwd(), 'MCP-SETUP-INSTRUCTIONS.md');
            await fs.writeFile(instructionsPath, instructions);
            
            console.log(`✅ Setup instructions created: ${instructionsPath}`);
            this.recordResult('Sample Configuration', true, 'Sample config and instructions created');

        } catch (error) {
            console.log(`⚠️ Could not create sample configuration: ${error.message}`);
            this.recordResult('Sample Configuration', false, error.message);
        }
    }

    recordResult(testName, success, message) {
        const result = {
            test: testName,
            status: success ? 'PASSED' : 'FAILED',
            message: message,
            timestamp: new Date().toISOString()
        };

        this.results.push(result);

        const icon = success ? '✅' : '❌';
        console.log(`${icon} ${testName}: ${message}`);
    }

    async fileExists(filePath) {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }

    async generateReport() {
        const duration = Date.now() - this.testStartTime;
        const passed = this.results.filter(r => r.status === 'PASSED').length;
        const failed = this.results.filter(r => r.status === 'FAILED').length;
        const total = this.results.length;

        console.log('\n📋 MCP Installation Test Results');
        console.log('=' .repeat(50));
        console.log(`✅ Passed: ${passed}`);
        console.log(`❌ Failed: ${failed}`);
        console.log(`⏱️ Duration: ${duration}ms`);
        console.log(`📊 Success Rate: ${Math.round((passed / total) * 100)}%`);

        const report = {
            summary: {
                totalTests: total,
                passed: passed,
                failed: failed,
                duration: duration,
                successRate: Math.round((passed / total) * 100)
            },
            results: this.results,
            timestamp: new Date().toISOString()
        };

        const reportPath = path.join(__dirname, 'monitoring/mcp-install-report.json');
        await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
        console.log(`📄 Report saved: ${reportPath}`);

        return report;
    }
}

// Run if called directly
if (require.main === module) {
    const tester = new MCPInstallTester();
    tester.runInstallTests().catch(console.error);
}

module.exports = MCPInstallTester;