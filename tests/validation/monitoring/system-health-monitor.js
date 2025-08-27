#!/usr/bin/env node

/**
 * System Health Monitor
 * Continuous monitoring of all system components with real-time alerts
 */

const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');
const EventEmitter = require('events');

class SystemHealthMonitor extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.monitoringInterval = options.interval || 30000; // 30 seconds
        this.alertThresholds = {
            cpu: 80,
            memory: 85,
            disk: 90,
            responseTime: 5000
        };
        
        this.healthStatus = {
            overall: 'UNKNOWN',
            components: {
                extensions: { status: 'UNKNOWN', lastCheck: null },
                mcp: { status: 'UNKNOWN', lastCheck: null },
                shell: { status: 'UNKNOWN', lastCheck: null },
                system: { status: 'UNKNOWN', lastCheck: null }
            }
        };
        
        this.metrics = [];
        this.alerts = [];
        this.isMonitoring = false;
        this.monitoringStartTime = null;
    }

    async startMonitoring() {
        if (this.isMonitoring) {
            console.log('⚠️ Monitoring already active');
            return;
        }

        console.log('🚀 Starting System Health Monitoring');
        console.log('=' .repeat(50));
        
        this.isMonitoring = true;
        this.monitoringStartTime = Date.now();
        
        // Initial health check
        await this.performFullHealthCheck();
        
        // Start periodic monitoring
        this.monitoringTimer = setInterval(async () => {
            try {
                await this.performFullHealthCheck();
                await this.checkAlertConditions();
                await this.generateHealthReport();
            } catch (error) {
                console.error('❌ Monitoring cycle error:', error.message);
                this.recordAlert('MONITORING_ERROR', error.message);
            }
        }, this.monitoringInterval);
        
        console.log(`✅ Health monitoring started (interval: ${this.monitoringInterval}ms)`);
    }

    async stopMonitoring() {
        if (!this.isMonitoring) {
            return;
        }

        console.log('🛑 Stopping System Health Monitoring');
        
        this.isMonitoring = false;
        
        if (this.monitoringTimer) {
            clearInterval(this.monitoringTimer);
            this.monitoringTimer = null;
        }
        
        // Generate final report
        await this.generateFinalReport();
        
        console.log('✅ Health monitoring stopped');
    }

    async performFullHealthCheck() {
        const timestamp = new Date().toISOString();
        console.log(`\n🔍 Health Check - ${timestamp}`);
        
        try {
            // Check all components
            await Promise.all([
                this.checkExtensionHealth(),
                this.checkMCPHealth(),
                this.checkShellHealth(),
                this.checkSystemHealth()
            ]);
            
            // Update overall status
            this.updateOverallHealth();
            
            // Record metrics
            this.recordMetrics();
            
        } catch (error) {
            console.error('❌ Health check failed:', error.message);
            this.recordAlert('HEALTH_CHECK_FAILURE', error.message);
        }
    }

    async checkExtensionHealth() {
        try {
            console.log('🔌 Checking Extension Health');
            
            const startTime = Date.now();
            
            // Check VS Code availability
            const vscodeVersion = execSync('code --version', { 
                encoding: 'utf8', 
                timeout: 5000 
            });
            
            // Check extension list
            const extensions = execSync('code --list-extensions', { 
                encoding: 'utf8', 
                timeout: 10000 
            });
            
            const responseTime = Date.now() - startTime;
            const extensionCount = extensions.split('\n').filter(line => line.trim()).length;
            
            // Check version lock file
            const lockFilePath = path.join(process.cwd(), '.vscode-extension-lock.json');
            const lockExists = await this.fileExists(lockFilePath);
            
            const status = {
                status: 'HEALTHY',
                responseTime: responseTime,
                extensionCount: extensionCount,
                versionLockEnabled: lockExists,
                lastCheck: new Date().toISOString(),
                details: {
                    vscodeVersion: vscodeVersion.split('\n')[0],
                    extensions: extensionCount
                }
            };
            
            this.healthStatus.components.extensions = status;
            console.log(`✅ Extensions: ${extensionCount} loaded, response: ${responseTime}ms`);
            
        } catch (error) {
            const status = {
                status: 'UNHEALTHY',
                error: error.message,
                lastCheck: new Date().toISOString()
            };
            
            this.healthStatus.components.extensions = status;
            console.log('❌ Extension health check failed:', error.message);
            this.recordAlert('EXTENSION_HEALTH', error.message);
        }
    }

    async checkMCPHealth() {
        try {
            console.log('🔗 Checking MCP Server Health');
            
            const startTime = Date.now();
            const serverStatuses = [];
            
            // Check common MCP servers
            const servers = [
                { name: 'ruv-swarm', port: 3000 },
                { name: 'claude-flow', port: 3001 },
                { name: 'flow-nexus', port: 3002 }
            ];
            
            for (const server of servers) {
                const serverStatus = await this.checkMCPServer(server);
                serverStatuses.push(serverStatus);
            }
            
            const responseTime = Date.now() - startTime;
            const healthyServers = serverStatuses.filter(s => s.healthy).length;
            
            const status = {
                status: healthyServers > 0 ? 'HEALTHY' : 'UNHEALTHY',
                responseTime: responseTime,
                serversHealthy: healthyServers,
                serversTotal: servers.length,
                lastCheck: new Date().toISOString(),
                details: serverStatuses
            };
            
            this.healthStatus.components.mcp = status;
            console.log(`✅ MCP: ${healthyServers}/${servers.length} servers healthy`);
            
        } catch (error) {
            const status = {
                status: 'UNHEALTHY',
                error: error.message,
                lastCheck: new Date().toISOString()
            };
            
            this.healthStatus.components.mcp = status;
            console.log('❌ MCP health check failed:', error.message);
            this.recordAlert('MCP_HEALTH', error.message);
        }
    }

    async checkMCPServer(server) {
        try {
            // This would check if MCP server is responding
            // For now, we'll simulate by checking if port is in use
            const isRunning = await this.isPortInUse(server.port);
            
            return {
                name: server.name,
                port: server.port,
                healthy: isRunning,
                status: isRunning ? 'running' : 'stopped'
            };
            
        } catch (error) {
            return {
                name: server.name,
                port: server.port,
                healthy: false,
                status: 'error',
                error: error.message
            };
        }
    }

    async checkShellHealth() {
        try {
            console.log('🖥️ Checking Shell Health');
            
            const startTime = Date.now();
            
            // Test basic shell commands
            const testCommands = [
                'echo "test"',
                'pwd',
                'whoami'
            ];
            
            let successCount = 0;
            
            for (const command of testCommands) {
                try {
                    execSync(command, { timeout: 5000, stdio: 'pipe' });
                    successCount++;
                } catch (cmdError) {
                    console.log(`⚠️ Command failed: ${command}`);
                }
            }
            
            const responseTime = Date.now() - startTime;
            
            const status = {
                status: successCount === testCommands.length ? 'HEALTHY' : 'DEGRADED',
                responseTime: responseTime,
                commandsSuccessful: successCount,
                commandsTotal: testCommands.length,
                lastCheck: new Date().toISOString(),
                details: {
                    shell: process.env.SHELL || 'unknown',
                    successRate: Math.round((successCount / testCommands.length) * 100)
                }
            };
            
            this.healthStatus.components.shell = status;
            console.log(`✅ Shell: ${successCount}/${testCommands.length} commands successful`);
            
        } catch (error) {
            const status = {
                status: 'UNHEALTHY',
                error: error.message,
                lastCheck: new Date().toISOString()
            };
            
            this.healthStatus.components.shell = status;
            console.log('❌ Shell health check failed:', error.message);
            this.recordAlert('SHELL_HEALTH', error.message);
        }
    }

    async checkSystemHealth() {
        try {
            console.log('💻 Checking System Health');
            
            const systemMetrics = await this.getSystemMetrics();
            
            const status = {
                status: this.evaluateSystemStatus(systemMetrics),
                metrics: systemMetrics,
                lastCheck: new Date().toISOString(),
                details: {
                    platform: process.platform,
                    nodeVersion: process.version,
                    uptime: process.uptime()
                }
            };
            
            this.healthStatus.components.system = status;
            console.log(`✅ System: CPU ${systemMetrics.cpu}%, Memory ${systemMetrics.memory}%`);
            
        } catch (error) {
            const status = {
                status: 'UNHEALTHY',
                error: error.message,
                lastCheck: new Date().toISOString()
            };
            
            this.healthStatus.components.system = status;
            console.log('❌ System health check failed:', error.message);
            this.recordAlert('SYSTEM_HEALTH', error.message);
        }
    }

    async getSystemMetrics() {
        const memUsage = process.memoryUsage();
        
        // Get system-specific metrics
        let cpuUsage = 0;
        let memoryUsage = 0;
        let diskUsage = 0;
        
        try {
            if (process.platform === 'darwin') {
                // macOS specific commands
                const topOutput = execSync('top -l 1 -n 0', { encoding: 'utf8', timeout: 5000 });
                const cpuMatch = topOutput.match(/CPU usage: ([\d.]+)%/);
                if (cpuMatch) {
                    cpuUsage = parseFloat(cpuMatch[1]);
                }
                
                // Memory usage from process
                memoryUsage = Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100);
                
            } else if (process.platform === 'linux') {
                // Linux specific commands
                const loadavg = require('os').loadavg();
                cpuUsage = Math.round(loadavg[0] * 10); // Rough approximation
                memoryUsage = Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100);
            }
            
            // Disk usage (simplified)
            diskUsage = 50; // Placeholder
            
        } catch (error) {
            console.log('⚠️ Could not get detailed system metrics:', error.message);
        }
        
        return {
            cpu: cpuUsage,
            memory: memoryUsage,
            disk: diskUsage,
            heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
            heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024)
        };
    }

    evaluateSystemStatus(metrics) {
        if (metrics.cpu > this.alertThresholds.cpu ||
            metrics.memory > this.alertThresholds.memory ||
            metrics.disk > this.alertThresholds.disk) {
            return 'DEGRADED';
        }
        return 'HEALTHY';
    }

    updateOverallHealth() {
        const components = this.healthStatus.components;
        const statuses = Object.values(components).map(c => c.status);
        
        if (statuses.includes('UNHEALTHY')) {
            this.healthStatus.overall = 'UNHEALTHY';
        } else if (statuses.includes('DEGRADED')) {
            this.healthStatus.overall = 'DEGRADED';
        } else if (statuses.every(s => s === 'HEALTHY')) {
            this.healthStatus.overall = 'HEALTHY';
        } else {
            this.healthStatus.overall = 'UNKNOWN';
        }
        
        // Emit status change events
        this.emit('healthStatusChange', this.healthStatus);
    }

    recordMetrics() {
        const timestamp = Date.now();
        const metric = {
            timestamp: timestamp,
            overall: this.healthStatus.overall,
            components: { ...this.healthStatus.components }
        };
        
        this.metrics.push(metric);
        
        // Keep only last 100 metrics
        if (this.metrics.length > 100) {
            this.metrics = this.metrics.slice(-100);
        }
    }

    recordAlert(type, message, severity = 'warning') {
        const alert = {
            timestamp: Date.now(),
            type: type,
            message: message,
            severity: severity
        };
        
        this.alerts.push(alert);
        
        // Emit alert event
        this.emit('alert', alert);
        
        console.log(`🚨 ALERT [${severity.toUpperCase()}]: ${type} - ${message}`);
    }

    async checkAlertConditions() {
        const current = this.healthStatus;
        
        // Check response time thresholds
        for (const [component, status] of Object.entries(current.components)) {
            if (status.responseTime && status.responseTime > this.alertThresholds.responseTime) {
                this.recordAlert(
                    `${component.toUpperCase()}_SLOW_RESPONSE`, 
                    `${component} response time ${status.responseTime}ms exceeds threshold`,
                    'warning'
                );
            }
        }
        
        // Check system resource thresholds
        if (current.components.system.metrics) {
            const metrics = current.components.system.metrics;
            
            if (metrics.cpu > this.alertThresholds.cpu) {
                this.recordAlert('HIGH_CPU_USAGE', `CPU usage ${metrics.cpu}% exceeds threshold`, 'critical');
            }
            
            if (metrics.memory > this.alertThresholds.memory) {
                this.recordAlert('HIGH_MEMORY_USAGE', `Memory usage ${metrics.memory}% exceeds threshold`, 'critical');
            }
        }
        
        // Check overall health degradation
        if (current.overall === 'UNHEALTHY') {
            this.recordAlert('SYSTEM_UNHEALTHY', 'Overall system health is unhealthy', 'critical');
        }
    }

    async generateHealthReport() {
        const uptime = this.monitoringStartTime ? Date.now() - this.monitoringStartTime : 0;
        const recentAlerts = this.alerts.filter(alert => 
            Date.now() - alert.timestamp < 300000 // Last 5 minutes
        );
        
        const report = {
            timestamp: new Date().toISOString(),
            uptime: uptime,
            overall: this.healthStatus.overall,
            components: this.healthStatus.components,
            recentAlerts: recentAlerts.length,
            totalAlerts: this.alerts.length
        };
        
        console.log(`\n📊 Health Status: ${report.overall}`);
        console.log(`🔔 Recent Alerts: ${recentAlerts.length}`);
        console.log(`⏱️ Uptime: ${Math.round(uptime / 1000)}s`);
    }

    async generateFinalReport() {
        const totalDuration = this.monitoringStartTime ? Date.now() - this.monitoringStartTime : 0;
        
        const report = {
            summary: {
                monitoringDuration: totalDuration,
                totalMetrics: this.metrics.length,
                totalAlerts: this.alerts.length,
                finalStatus: this.healthStatus.overall
            },
            healthStatus: this.healthStatus,
            metrics: this.metrics,
            alerts: this.alerts,
            timestamp: new Date().toISOString()
        };
        
        console.log('\n📋 Final System Health Report');
        console.log('=' .repeat(40));
        console.log(`⏱️ Total Duration: ${Math.round(totalDuration / 1000)}s`);
        console.log(`📊 Metrics Collected: ${this.metrics.length}`);
        console.log(`🚨 Total Alerts: ${this.alerts.length}`);
        console.log(`📈 Final Status: ${this.healthStatus.overall}`);
        
        // Save comprehensive report
        const reportPath = path.join(__dirname, 'system-health-final-report.json');
        await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
        console.log(`📄 Final report saved: ${reportPath}`);
        
        return report;
    }

    // Helper methods
    async fileExists(filePath) {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }

    async isPortInUse(port) {
        return new Promise((resolve) => {
            const net = require('net');
            const server = net.createServer();
            
            server.listen(port, () => {
                server.once('close', () => resolve(false));
                server.close();
            });
            
            server.on('error', () => resolve(true));
        });
    }

    // Public API methods
    getHealthStatus() {
        return { ...this.healthStatus };
    }

    getMetrics(count = 10) {
        return this.metrics.slice(-count);
    }

    getAlerts(count = 10) {
        return this.alerts.slice(-count);
    }

    clearAlerts() {
        this.alerts = [];
        console.log('🧹 Alerts cleared');
    }
}

// Run monitor if called directly
if (require.main === module) {
    const monitor = new SystemHealthMonitor();
    
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
        console.log('\n🛑 Received SIGINT, shutting down gracefully...');
        await monitor.stopMonitoring();
        process.exit(0);
    });
    
    // Start monitoring
    monitor.startMonitoring().catch(console.error);
    
    // Example of listening to events
    monitor.on('alert', (alert) => {
        // Could send to external monitoring system
        console.log(`📢 Alert Event: ${alert.type} - ${alert.message}`);
    });
    
    monitor.on('healthStatusChange', (status) => {
        console.log(`🔄 Health Status Changed: ${status.overall}`);
    });
}

module.exports = SystemHealthMonitor;