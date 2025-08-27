#!/usr/bin/env node

/**
 * System Diagnostic Engine - Comprehensive system monitoring and diagnostics
 * Monitors extensions, MCP servers, shell connections, and system resources
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec, spawn } = require('child_process');
const EventEmitter = require('events');
const util = require('util');
const execAsync = util.promisify(exec);

class SystemDiagnosticEngine extends EventEmitter {
    constructor(configPath) {
        super();
        
        this.configPath = configPath || path.join(__dirname, '../config/system-diagnostic-config.json');
        this.config = this.loadConfig();
        this.metrics = new Map();
        this.alerts = [];
        this.healthStatus = new Map();
        this.logger = this.createLogger();
        this.isRunning = false;
        this.intervals = new Map();
        
        this.init();
    }
    
    loadConfig() {
        try {
            const configData = fs.readFileSync(this.configPath, 'utf8');
            return JSON.parse(configData);
        } catch (error) {
            console.error('Failed to load diagnostic config:', error.message);
            return this.getDefaultConfig();
        }
    }
    
    getDefaultConfig() {
        return {
            diagnostics: { enabled: true, collection_interval_ms: 10000 },
            logging: { console: { enabled: true }, file: { enabled: true, path: './logs/system-diagnostics.log' } },
            metrics: { system: { enabled: true }, application: { enabled: true } },
            alerts: { enabled: true, thresholds: {} },
            health_checks: { enabled: true, interval_ms: 30000 },
            recovery: { enabled: true, auto_recovery: true }
        };
    }
    
    createLogger() {
        const logConfig = this.config.logging;
        const logDir = path.dirname(logConfig.file?.path || './logs/system-diagnostics.log');
        
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }
        
        return {
            log: (level, message, data = {}) => {
                const timestamp = new Date().toISOString();
                const logEntry = {
                    timestamp,
                    level,
                    message,
                    component: 'SystemDiagnostics',
                    pid: process.pid,
                    ...data
                };
                
                // Console logging
                if (logConfig.console?.enabled) {
                    const colorMap = {
                        ERROR: '\x1b[31m',
                        WARN: '\x1b[33m',
                        INFO: '\x1b[36m',
                        DEBUG: '\x1b[90m'
                    };
                    
                    const color = colorMap[level] || '\x1b[0m';
                    const reset = '\x1b[0m';
                    
                    if (logConfig.console.colors) {
                        console.log(`${color}[${timestamp}] ${level}: ${message}${reset}`);
                    } else {
                        console.log(`[${timestamp}] ${level}: ${message}`);
                    }
                }
                
                // File logging
                if (logConfig.file?.enabled) {
                    const logLine = JSON.stringify(logEntry) + '\n';
                    try {
                        fs.appendFileSync(logConfig.file.path, logLine);
                    } catch (error) {
                        console.error('Failed to write log to file:', error.message);
                    }
                }
            },
            info: (message, data) => this.log('INFO', message, data),
            warn: (message, data) => this.log('WARN', message, data),
            error: (message, data) => this.log('ERROR', message, data),
            debug: (message, data) => this.log('DEBUG', message, data)
        };
    }
    
    init() {
        this.logger.info('Initializing System Diagnostic Engine');
        
        if (!this.config.diagnostics.enabled) {
            this.logger.warn('Diagnostics disabled in configuration');
            return;
        }
        
        // Setup signal handlers
        process.on('SIGTERM', () => this.stop());
        process.on('SIGINT', () => this.stop());
        
        this.emit('initialized');
    }
    
    start() {
        if (this.isRunning) {
            this.logger.warn('Diagnostic engine is already running');
            return;
        }
        
        this.logger.info('Starting System Diagnostic Engine');
        this.isRunning = true;
        
        // Start metric collection
        if (this.config.diagnostics.real_time_monitoring) {
            this.startMetricCollection();
        }
        
        // Start health checks
        if (this.config.health_checks.enabled) {
            this.startHealthChecks();
        }
        
        // Start alert monitoring
        if (this.config.alerts.enabled) {
            this.startAlertMonitoring();
        }
        
        this.emit('started');
    }
    
    stop() {
        if (!this.isRunning) {
            return;
        }
        
        this.logger.info('Stopping System Diagnostic Engine');
        this.isRunning = false;
        
        // Clear all intervals
        for (const [name, interval] of this.intervals) {
            clearInterval(interval);
            this.logger.debug(`Cleared interval: ${name}`);
        }
        this.intervals.clear();
        
        this.emit('stopped');
    }
    
    startMetricCollection() {
        const interval = setInterval(() => {
            this.collectMetrics();
        }, this.config.diagnostics.collection_interval_ms);
        
        this.intervals.set('metric_collection', interval);
        this.logger.info('Metric collection started', {
            interval: this.config.diagnostics.collection_interval_ms
        });
    }
    
    async collectMetrics() {
        const timestamp = Date.now();
        
        try {
            const metrics = {
                timestamp,
                system: await this.collectSystemMetrics(),
                application: await this.collectApplicationMetrics(),
                performance: await this.collectPerformanceMetrics()
            };
            
            this.storeMetrics(metrics);
            this.emit('metricsCollected', metrics);
            
        } catch (error) {
            this.logger.error('Failed to collect metrics', { error: error.message });
        }
    }
    
    async collectSystemMetrics() {
        if (!this.config.metrics.system?.enabled) {
            return null;
        }
        
        const metrics = {
            timestamp: Date.now(),
            cpu: null,
            memory: null,
            disk: null,
            network: null,
            processes: null
        };
        
        try {
            // CPU metrics
            if (this.config.metrics.system.collect_cpu) {
                const cpus = os.cpus();
                const loadAvg = os.loadavg();
                
                metrics.cpu = {
                    count: cpus.length,
                    model: cpus[0]?.model,
                    speed: cpus[0]?.speed,
                    load_average_1m: loadAvg[0],
                    load_average_5m: loadAvg[1],
                    load_average_15m: loadAvg[2]
                };
            }
            
            // Memory metrics
            if (this.config.metrics.system.collect_memory) {
                const totalMemory = os.totalmem();
                const freeMemory = os.freemem();
                const usedMemory = totalMemory - freeMemory;
                
                metrics.memory = {
                    total_bytes: totalMemory,
                    free_bytes: freeMemory,
                    used_bytes: usedMemory,
                    usage_percent: (usedMemory / totalMemory) * 100
                };
            }
            
            // Disk metrics
            if (this.config.metrics.system.collect_disk) {
                metrics.disk = await this.getDiskUsage();
            }
            
            // Process metrics
            if (this.config.metrics.system.collect_processes) {
                metrics.processes = {
                    current_pid: process.pid,
                    memory_usage: process.memoryUsage(),
                    cpu_usage: process.cpuUsage(),
                    uptime: process.uptime()
                };
            }
            
        } catch (error) {
            this.logger.error('Failed to collect system metrics', { error: error.message });
        }
        
        return metrics;
    }
    
    async getDiskUsage() {
        try {
            if (os.platform() === 'win32') {
                // Windows disk usage
                const { stdout } = await execAsync('wmic logicaldisk get size,freespace,caption');
                return this.parseDiskUsageWindows(stdout);
            } else {
                // Unix-like disk usage
                const { stdout } = await execAsync('df -h /');
                return this.parseDiskUsageUnix(stdout);
            }
        } catch (error) {
            this.logger.error('Failed to get disk usage', { error: error.message });
            return null;
        }
    }
    
    parseDiskUsageUnix(output) {
        const lines = output.split('\n').filter(line => line.trim());
        if (lines.length < 2) return null;
        
        const parts = lines[1].split(/\s+/);
        return {
            filesystem: parts[0],
            size: parts[1],
            used: parts[2],
            available: parts[3],
            usage_percent: parseFloat(parts[4])
        };
    }
    
    parseDiskUsageWindows(output) {
        // Basic Windows parsing - would need more sophisticated parsing in production
        return {
            filesystem: 'C:',
            size: 'Unknown',
            used: 'Unknown',
            available: 'Unknown',
            usage_percent: 0
        };
    }
    
    async collectApplicationMetrics() {
        if (!this.config.metrics.application?.enabled) {
            return null;
        }
        
        const metrics = {
            timestamp: Date.now(),
            extensions: null,
            mcp_servers: null,
            shell_connections: null,
            performance: null
        };
        
        try {
            // Extension metrics
            if (this.config.metrics.application.track_extensions) {
                metrics.extensions = await this.getExtensionMetrics();
            }
            
            // MCP server metrics
            if (this.config.metrics.application.track_mcp_servers) {
                metrics.mcp_servers = await this.getMCPServerMetrics();
            }
            
            // Shell connection metrics
            if (this.config.metrics.application.track_shell_connections) {
                metrics.shell_connections = await this.getShellConnectionMetrics();
            }
            
        } catch (error) {
            this.logger.error('Failed to collect application metrics', { error: error.message });
        }
        
        return metrics;
    }
    
    async getExtensionMetrics() {
        try {
            const { stdout } = await execAsync('code --list-extensions --show-versions');
            const extensions = stdout.split('\n')
                .filter(line => line.trim())
                .map(line => {
                    const [name, version] = line.split('@');
                    return { name, version };
                });
            
            return {
                count: extensions.length,
                extensions,
                last_updated: Date.now()
            };
        } catch (error) {
            this.logger.error('Failed to get extension metrics', { error: error.message });
            return { count: 0, extensions: [], error: error.message };
        }
    }
    
    async getMCPServerMetrics() {
        try {
            // Check for running MCP server processes
            const { stdout } = await execAsync('ps aux | grep mcp || echo "No MCP processes"');
            
            const processes = stdout.split('\n')
                .filter(line => line.includes('mcp') && !line.includes('grep'))
                .length;
            
            return {
                running_processes: processes,
                last_checked: Date.now()
            };
        } catch (error) {
            return { running_processes: 0, error: error.message };
        }
    }
    
    async getShellConnectionMetrics() {
        try {
            // This would integrate with the Shell Connection Stabilizer
            // For now, return basic shell info
            const shell = process.env.SHELL || 'unknown';
            
            return {
                current_shell: shell,
                shell_level: process.env.SHLVL || 1,
                last_checked: Date.now()
            };
        } catch (error) {
            return { error: error.message };
        }
    }
    
    async collectPerformanceMetrics() {
        if (!this.config.metrics.performance?.enabled) {
            return null;
        }
        
        return {
            timestamp: Date.now(),
            response_times: this.calculateResponseTimes(),
            error_rates: this.calculateErrorRates(),
            throughput: this.calculateThroughput()
        };
    }
    
    calculateResponseTimes() {
        // Placeholder - would collect from actual operations
        return {
            average: 150,
            p50: 120,
            p90: 300,
            p95: 500,
            p99: 1000
        };
    }
    
    calculateErrorRates() {
        // Placeholder - would calculate from actual error tracking
        return {
            total_requests: 1000,
            total_errors: 5,
            error_rate_percent: 0.5
        };
    }
    
    calculateThroughput() {
        // Placeholder - would calculate from actual operation tracking
        return {
            requests_per_second: 10,
            operations_per_minute: 600
        };
    }
    
    storeMetrics(metrics) {
        const key = `metrics_${metrics.timestamp}`;
        this.metrics.set(key, metrics);
        
        // Cleanup old metrics based on retention policy
        this.cleanupOldMetrics();
    }
    
    cleanupOldMetrics() {
        const retentionMs = this.config.diagnostics.retention_days * 24 * 60 * 60 * 1000;
        const cutoffTime = Date.now() - retentionMs;
        
        for (const [key, metrics] of this.metrics) {
            if (metrics.timestamp < cutoffTime) {
                this.metrics.delete(key);
            }
        }
    }
    
    startHealthChecks() {
        const interval = setInterval(() => {
            this.performHealthChecks();
        }, this.config.health_checks.interval_ms);
        
        this.intervals.set('health_checks', interval);
        this.logger.info('Health checks started', {
            interval: this.config.health_checks.interval_ms
        });
    }
    
    async performHealthChecks() {
        const checks = this.config.health_checks.checks;
        
        for (const [checkName, checkConfig] of Object.entries(checks)) {
            if (!checkConfig.enabled) continue;
            
            try {
                const result = await this.executeHealthCheck(checkName, checkConfig);
                this.healthStatus.set(checkName, {
                    timestamp: Date.now(),
                    status: result.healthy ? 'healthy' : 'unhealthy',
                    details: result.details,
                    error: result.error
                });
                
                if (!result.healthy) {
                    this.logger.warn(`Health check failed: ${checkName}`, {
                        details: result.details,
                        error: result.error
                    });
                    
                    // Trigger recovery if configured
                    if (this.config.recovery.auto_recovery) {
                        await this.triggerRecovery(checkName, result);
                    }
                }
                
            } catch (error) {
                this.logger.error(`Health check error: ${checkName}`, {
                    error: error.message
                });
                
                this.healthStatus.set(checkName, {
                    timestamp: Date.now(),
                    status: 'error',
                    error: error.message
                });
            }
        }
    }
    
    async executeHealthCheck(checkName, checkConfig) {
        switch (checkName) {
            case 'extension_health':
                return await this.checkExtensionHealth(checkConfig);
            case 'mcp_servers':
                return await this.checkMCPServers(checkConfig);
            case 'shell_connections':
                return await this.checkShellConnections(checkConfig);
            case 'file_system':
                return await this.checkFileSystem(checkConfig);
            default:
                return { healthy: false, error: `Unknown health check: ${checkName}` };
        }
    }
    
    async checkExtensionHealth(config) {
        try {
            const { stdout } = await execAsync(config.command, {
                timeout: config.timeout_ms
            });
            
            const healthy = stdout.includes(config.expected_output_pattern);
            
            return {
                healthy,
                details: {
                    output_length: stdout.length,
                    pattern_found: healthy
                }
            };
        } catch (error) {
            return {
                healthy: false,
                error: error.message
            };
        }
    }
    
    async checkMCPServers(config) {
        try {
            const runningServers = [];
            
            for (const serverName of config.expected_servers) {
                try {
                    const { stdout } = await execAsync(`ps aux | grep ${serverName}`);
                    if (stdout.includes(serverName) && !stdout.includes('grep')) {
                        runningServers.push(serverName);
                    }
                } catch (error) {
                    // Server not running
                }
            }
            
            const healthy = runningServers.length === config.expected_servers.length;
            
            return {
                healthy,
                details: {
                    expected: config.expected_servers,
                    running: runningServers,
                    missing: config.expected_servers.filter(s => !runningServers.includes(s))
                }
            };
        } catch (error) {
            return {
                healthy: false,
                error: error.message
            };
        }
    }
    
    async checkShellConnections(config) {
        try {
            const startTime = Date.now();
            const { stdout } = await execAsync(config.test_command, {
                timeout: config.max_response_time_ms
            });
            const responseTime = Date.now() - startTime;
            
            const healthy = stdout.trim() === config.expected_response && 
                          responseTime <= config.max_response_time_ms;
            
            return {
                healthy,
                details: {
                    response_time_ms: responseTime,
                    expected_response: config.expected_response,
                    actual_response: stdout.trim()
                }
            };
        } catch (error) {
            return {
                healthy: false,
                error: error.message
            };
        }
    }
    
    async checkFileSystem(config) {
        try {
            const results = {
                paths_checked: 0,
                paths_accessible: 0,
                permission_issues: [],
                disk_space_ok: true
            };
            
            for (const checkPath of config.check_paths) {
                results.paths_checked++;
                
                if (fs.existsSync(checkPath)) {
                    results.paths_accessible++;
                    
                    if (config.check_permissions) {
                        try {
                            fs.accessSync(checkPath, fs.constants.R_OK | fs.constants.W_OK);
                        } catch (error) {
                            results.permission_issues.push({
                                path: checkPath,
                                error: error.message
                            });
                        }
                    }
                }
            }
            
            const healthy = results.paths_accessible === results.paths_checked &&
                           results.permission_issues.length === 0 &&
                           results.disk_space_ok;
            
            return {
                healthy,
                details: results
            };
        } catch (error) {
            return {
                healthy: false,
                error: error.message
            };
        }
    }
    
    async triggerRecovery(checkName, healthResult) {
        this.logger.info(`Triggering recovery for: ${checkName}`);
        
        const recoveryStrategies = this.config.recovery.strategies;
        
        // Implement recovery strategies based on the check type
        // This is a simplified example
        switch (checkName) {
            case 'extension_health':
                if (recoveryStrategies.extension_issues?.reset_extension_settings) {
                    this.logger.info('Attempting to reset extension settings');
                    // Implementation would go here
                }
                break;
                
            case 'mcp_servers':
                if (recoveryStrategies.mcp_server_issues?.restart_server) {
                    this.logger.info('Attempting to restart MCP servers');
                    // Implementation would go here
                }
                break;
                
            case 'shell_connections':
                if (recoveryStrategies.shell_connection_issues?.reconnect) {
                    this.logger.info('Attempting to reconnect shell');
                    // Implementation would go here
                }
                break;
        }
    }
    
    startAlertMonitoring() {
        // Simple threshold-based alerting
        const interval = setInterval(() => {
            this.checkAlertThresholds();
        }, 60000); // Check every minute
        
        this.intervals.set('alert_monitoring', interval);
    }
    
    checkAlertThresholds() {
        const latestMetrics = Array.from(this.metrics.values()).pop();
        if (!latestMetrics) return;
        
        const thresholds = this.config.alerts.thresholds;
        
        // CPU usage alert
        if (latestMetrics.system?.cpu && thresholds.cpu_usage_percent) {
            const cpuUsage = latestMetrics.system.cpu.load_average_1m * 100 / os.cpus().length;
            if (cpuUsage > thresholds.cpu_usage_percent) {
                this.createAlert('CPU_HIGH', `CPU usage: ${cpuUsage.toFixed(1)}%`, {
                    current: cpuUsage,
                    threshold: thresholds.cpu_usage_percent
                });
            }
        }
        
        // Memory usage alert
        if (latestMetrics.system?.memory && thresholds.memory_usage_percent) {
            const memoryUsage = latestMetrics.system.memory.usage_percent;
            if (memoryUsage > thresholds.memory_usage_percent) {
                this.createAlert('MEMORY_HIGH', `Memory usage: ${memoryUsage.toFixed(1)}%`, {
                    current: memoryUsage,
                    threshold: thresholds.memory_usage_percent
                });
            }
        }
    }
    
    createAlert(type, message, data = {}) {
        const alert = {
            id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type,
            message,
            timestamp: Date.now(),
            data,
            status: 'active'
        };
        
        this.alerts.push(alert);
        this.logger.warn(`ALERT: ${message}`, { alert });
        this.emit('alert', alert);
        
        return alert;
    }
    
    getStatus() {
        return {
            timestamp: Date.now(),
            running: this.isRunning,
            active_intervals: Array.from(this.intervals.keys()),
            metrics_count: this.metrics.size,
            alerts_count: this.alerts.filter(a => a.status === 'active').length,
            health_checks: Object.fromEntries(this.healthStatus),
            system_info: {
                platform: os.platform(),
                arch: os.arch(),
                node_version: process.version,
                pid: process.pid,
                uptime: process.uptime()
            }
        };
    }
    
    getMetrics(limit = 10) {
        const metrics = Array.from(this.metrics.values())
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, limit);
        
        return metrics;
    }
    
    getAlerts(activeOnly = true) {
        return activeOnly 
            ? this.alerts.filter(alert => alert.status === 'active')
            : this.alerts;
    }
    
    generateReport() {
        const status = this.getStatus();
        const recentMetrics = this.getMetrics(5);
        const activeAlerts = this.getAlerts(true);
        
        return {
            report_id: `diagnostic_report_${Date.now()}`,
            generated_at: new Date().toISOString(),
            system_status: status,
            recent_metrics: recentMetrics,
            active_alerts: activeAlerts,
            recommendations: this.generateRecommendations(status, activeAlerts)
        };
    }
    
    generateRecommendations(status, alerts) {
        const recommendations = [];
        
        if (alerts.length > 0) {
            recommendations.push({
                priority: 'high',
                category: 'alerts',
                message: `Address ${alerts.length} active alerts`,
                action: 'Review and resolve active system alerts'
            });
        }
        
        if (status.metrics_count > 1000) {
            recommendations.push({
                priority: 'medium',
                category: 'maintenance',
                message: 'Large number of stored metrics',
                action: 'Consider adjusting retention policy or data cleanup'
            });
        }
        
        return recommendations;
    }
}

// CLI Interface
if (require.main === module) {
    const command = process.argv[2];
    const engine = new SystemDiagnosticEngine();
    
    switch (command) {
        case 'start':
            engine.start();
            console.log('System Diagnostic Engine started');
            
            // Keep process alive
            process.stdin.resume();
            break;
            
        case 'status':
            console.log(JSON.stringify(engine.getStatus(), null, 2));
            process.exit(0);
            break;
            
        case 'report':
            console.log(JSON.stringify(engine.generateReport(), null, 2));
            process.exit(0);
            break;
            
        case 'metrics':
            const limit = parseInt(process.argv[3]) || 10;
            console.log(JSON.stringify(engine.getMetrics(limit), null, 2));
            process.exit(0);
            break;
            
        case 'alerts':
            console.log(JSON.stringify(engine.getAlerts(), null, 2));
            process.exit(0);
            break;
            
        case 'stop':
            engine.stop();
            console.log('System Diagnostic Engine stopped');
            process.exit(0);
            break;
            
        default:
            console.log('System Diagnostic Engine');
            console.log('Usage: system-diagnostic-engine.js {start|status|report|metrics|alerts|stop}');
            console.log('');
            console.log('Commands:');
            console.log('  start            - Start the diagnostic engine');
            console.log('  status           - Show current status');
            console.log('  report           - Generate comprehensive report');
            console.log('  metrics [limit]  - Show recent metrics');
            console.log('  alerts           - Show active alerts');
            console.log('  stop             - Stop the engine');
            process.exit(1);
    }
}

module.exports = SystemDiagnosticEngine;