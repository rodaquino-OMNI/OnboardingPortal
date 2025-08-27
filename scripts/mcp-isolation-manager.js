#!/usr/bin/env node

/**
 * MCP Isolation Manager - Manages MCP server conflicts and resource allocation
 * Implements port management, startup sequencing, and resource monitoring
 */

const fs = require('fs');
const path = require('path');
const net = require('net');
const { spawn, exec } = require('child_process');
const EventEmitter = require('events');

class MCPIsolationManager extends EventEmitter {
    constructor(configPath) {
        super();
        this.configPath = configPath || path.join(__dirname, '../config/mcp-isolation-config.json');
        this.config = this.loadConfig();
        this.servers = new Map();
        this.portAllocations = new Map();
        this.healthChecks = new Map();
        this.startupSequence = [];
        this.logger = this.createLogger();
        
        this.init();
    }
    
    loadConfig() {
        try {
            const configData = fs.readFileSync(this.configPath, 'utf8');
            return JSON.parse(configData);
        } catch (error) {
            console.error('Failed to load MCP isolation config:', error.message);
            return this.getDefaultConfig();
        }
    }
    
    getDefaultConfig() {
        return {
            isolation: { enabled: true, strategy: 'port_isolation' },
            port_management: { base_port: 3000, port_range: { start: 3000, end: 3100 } },
            resource_limits: { max_memory_mb: 512, max_cpu_percent: 25 },
            startup_sequence: { sequential_startup: true, phase_delay_ms: 3000 },
            health_monitoring: { enabled: true, check_interval_ms: 30000 },
            logging: { level: 'INFO', file: './logs/mcp-isolation.log' }
        };
    }
    
    createLogger() {
        const logDir = path.dirname(this.config.logging.file);
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
                    pid: process.pid,
                    ...data
                };
                
                const logLine = JSON.stringify(logEntry) + '\n';
                fs.appendFileSync(this.config.logging.file, logLine);
                
                if (this.config.development?.verbose_logging || level === 'ERROR') {
                    console.log(`[${timestamp}] ${level}: ${message}`);
                }
            },
            info: (message, data) => this.log('INFO', message, data),
            warn: (message, data) => this.log('WARN', message, data),
            error: (message, data) => this.log('ERROR', message, data),
            debug: (message, data) => this.log('DEBUG', message, data)
        };
    }
    
    init() {
        this.logger.info('Initializing MCP Isolation Manager');
        
        // Setup signal handlers
        process.on('SIGTERM', () => this.shutdown());
        process.on('SIGINT', () => this.shutdown());
        process.on('uncaughtException', (error) => {
            this.logger.error('Uncaught exception', { error: error.message, stack: error.stack });
            this.shutdown();
        });
        
        // Start health monitoring if enabled
        if (this.config.health_monitoring?.enabled) {
            this.startHealthMonitoring();
        }
        
        this.emit('initialized');
    }
    
    async allocatePort(serverId, preferredPort = null) {
        const { port_range, reserved_ports, auto_increment } = this.config.port_management;
        
        if (preferredPort && !reserved_ports.includes(preferredPort)) {
            const available = await this.isPortAvailable(preferredPort);
            if (available) {
                this.portAllocations.set(serverId, preferredPort);
                this.logger.info(`Allocated preferred port ${preferredPort} to ${serverId}`);
                return preferredPort;
            }
        }
        
        // Find available port in range
        for (let port = port_range.start; port <= port_range.end; port++) {
            if (reserved_ports.includes(port)) continue;
            if (Array.from(this.portAllocations.values()).includes(port)) continue;
            
            const available = await this.isPortAvailable(port);
            if (available) {
                this.portAllocations.set(serverId, port);
                this.logger.info(`Allocated port ${port} to ${serverId}`);
                return port;
            }
        }
        
        throw new Error(`No available ports in range ${port_range.start}-${port_range.end}`);
    }
    
    isPortAvailable(port) {
        return new Promise((resolve) => {
            const server = net.createServer();
            
            server.listen(port, () => {
                server.once('close', () => resolve(true));
                server.close();
            });
            
            server.on('error', () => resolve(false));
        });
    }
    
    async startServer(serverId, serverConfig) {
        try {
            this.logger.info(`Starting server ${serverId}`);
            
            // Allocate port
            const port = await this.allocatePort(serverId, serverConfig.port);
            
            // Apply resource limits
            const resourceLimits = this.buildResourceLimits(serverConfig);
            
            // Spawn server process
            const serverProcess = spawn(serverConfig.command, serverConfig.args || [], {
                env: {
                    ...process.env,
                    ...serverConfig.env,
                    PORT: port.toString(),
                    MCP_SERVER_ID: serverId,
                    MCP_RESOURCE_LIMITS: JSON.stringify(resourceLimits)
                },
                stdio: this.config.logging.include_server_logs ? 'pipe' : 'ignore',
                detached: false
            });
            
            // Store server info
            this.servers.set(serverId, {
                process: serverProcess,
                port,
                config: serverConfig,
                startTime: Date.now(),
                status: 'starting',
                restartCount: 0,
                lastHealthCheck: null
            });
            
            // Setup process event handlers
            this.setupServerProcessHandlers(serverId, serverProcess);
            
            // Wait for server to be ready
            await this.waitForServerReady(serverId);
            
            this.logger.info(`Server ${serverId} started successfully on port ${port}`);
            this.emit('serverStarted', { serverId, port });
            
            return { serverId, port, process: serverProcess };
            
        } catch (error) {
            this.logger.error(`Failed to start server ${serverId}`, { error: error.message });
            throw error;
        }
    }
    
    buildResourceLimits(serverConfig) {
        const limits = { ...this.config.resource_limits };
        
        // Apply server-specific overrides
        if (serverConfig.resource_limits) {
            Object.assign(limits, serverConfig.resource_limits);
        }
        
        return limits;
    }
    
    setupServerProcessHandlers(serverId, process) {
        process.on('exit', (code, signal) => {
            const server = this.servers.get(serverId);
            if (server) {
                server.status = 'stopped';
                this.logger.info(`Server ${serverId} exited`, { code, signal });
                
                // Auto-restart if configured
                if (this.config.recovery?.auto_restart && server.restartCount < this.config.recovery.max_restart_attempts) {
                    setTimeout(() => this.restartServer(serverId), this.config.recovery.restart_delay_ms);
                }
            }
        });
        
        process.on('error', (error) => {
            this.logger.error(`Server ${serverId} process error`, { error: error.message });
            this.emit('serverError', { serverId, error });
        });
        
        // Capture logs if enabled
        if (this.config.logging.include_server_logs) {
            process.stdout?.on('data', (data) => {
                this.logger.info(`[${serverId}] ${data.toString().trim()}`);
            });
            
            process.stderr?.on('data', (data) => {
                this.logger.error(`[${serverId}] ${data.toString().trim()}`);
            });
        }
    }
    
    async waitForServerReady(serverId, timeout = 15000) {
        const server = this.servers.get(serverId);
        if (!server) throw new Error(`Server ${serverId} not found`);
        
        const startTime = Date.now();
        
        while (Date.now() - startTime < timeout) {
            try {
                const isHealthy = await this.checkServerHealth(serverId);
                if (isHealthy) {
                    server.status = 'running';
                    return true;
                }
            } catch (error) {
                // Continue waiting
            }
            
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        throw new Error(`Server ${serverId} failed to become ready within ${timeout}ms`);
    }
    
    async checkServerHealth(serverId) {
        const server = this.servers.get(serverId);
        if (!server || server.status !== 'running') return false;
        
        try {
            // Simple TCP connection check
            const isConnectable = await this.isPortAvailable(server.port);
            const isHealthy = !isConnectable; // Port should be in use if server is running
            
            server.lastHealthCheck = Date.now();
            this.healthChecks.set(serverId, { timestamp: Date.now(), healthy: isHealthy });
            
            return isHealthy;
        } catch (error) {
            this.logger.error(`Health check failed for ${serverId}`, { error: error.message });
            return false;
        }
    }
    
    startHealthMonitoring() {
        const interval = this.config.health_monitoring.check_interval_ms;
        
        setInterval(async () => {
            for (const [serverId] of this.servers) {
                await this.checkServerHealth(serverId);
            }
        }, interval);
        
        this.logger.info(`Health monitoring started with ${interval}ms interval`);
    }
    
    async restartServer(serverId) {
        const server = this.servers.get(serverId);
        if (!server) return;
        
        server.restartCount++;
        this.logger.info(`Restarting server ${serverId} (attempt ${server.restartCount})`);
        
        try {
            // Stop current process
            await this.stopServer(serverId);
            
            // Wait for restart delay
            const delay = this.config.recovery.exponential_backoff 
                ? Math.min(this.config.recovery.restart_delay_ms * Math.pow(2, server.restartCount - 1), 60000)
                : this.config.recovery.restart_delay_ms;
                
            await new Promise(resolve => setTimeout(resolve, delay));
            
            // Start server again
            await this.startServer(serverId, server.config);
            
        } catch (error) {
            this.logger.error(`Failed to restart server ${serverId}`, { error: error.message });
        }
    }
    
    async stopServer(serverId) {
        const server = this.servers.get(serverId);
        if (!server || !server.process) return;
        
        this.logger.info(`Stopping server ${serverId}`);
        
        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                // Force kill if graceful shutdown fails
                server.process.kill('SIGKILL');
                resolve();
            }, this.config.isolation.graceful_shutdown_timeout);
            
            server.process.on('exit', () => {
                clearTimeout(timeout);
                server.status = 'stopped';
                this.portAllocations.delete(serverId);
                this.logger.info(`Server ${serverId} stopped`);
                resolve();
            });
            
            server.process.kill('SIGTERM');
        });
    }
    
    async startSequentialPhases(phases) {
        for (const phase of phases) {
            this.logger.info(`Starting phase: ${phase.name}`);
            
            const phasePromises = phase.servers.map(serverId => {
                const serverConfig = this.getServerConfig(serverId);
                return this.startServer(serverId, serverConfig);
            });
            
            if (phase.wait_for_health) {
                await Promise.all(phasePromises);
                
                // Additional wait for stability
                if (phase.timeout_ms) {
                    await new Promise(resolve => setTimeout(resolve, phase.timeout_ms));
                }
            } else {
                // Fire and forget
                phasePromises.catch(error => 
                    this.logger.error(`Phase ${phase.name} error`, { error: error.message })
                );
            }
            
            // Phase delay
            if (this.config.startup_sequence.phase_delay_ms) {
                await new Promise(resolve => 
                    setTimeout(resolve, this.config.startup_sequence.phase_delay_ms)
                );
            }
        }
    }
    
    getServerConfig(serverId) {
        // This would typically load from a servers configuration file
        // For now, return a basic config structure
        return {
            command: 'node',
            args: ['server.js'],
            env: {},
            resource_limits: {}
        };
    }
    
    async shutdown() {
        this.logger.info('Shutting down MCP Isolation Manager');
        
        const shutdownPromises = Array.from(this.servers.keys()).map(serverId => 
            this.stopServer(serverId)
        );
        
        await Promise.all(shutdownPromises);
        
        this.logger.info('All servers stopped, exiting');
        process.exit(0);
    }
    
    getStatus() {
        const status = {
            timestamp: new Date().toISOString(),
            isolation_enabled: this.config.isolation.enabled,
            total_servers: this.servers.size,
            servers: {},
            port_allocations: Object.fromEntries(this.portAllocations),
            health_checks: Object.fromEntries(this.healthChecks)
        };
        
        for (const [serverId, server] of this.servers) {
            status.servers[serverId] = {
                status: server.status,
                port: server.port,
                uptime_ms: Date.now() - server.startTime,
                restart_count: server.restartCount,
                last_health_check: server.lastHealthCheck
            };
        }
        
        return status;
    }
}

// CLI Interface
if (require.main === module) {
    const command = process.argv[2];
    const manager = new MCPIsolationManager();
    
    switch (command) {
        case 'start':
            manager.on('initialized', () => {
                console.log('MCP Isolation Manager started');
            });
            break;
            
        case 'status':
            console.log(JSON.stringify(manager.getStatus(), null, 2));
            process.exit(0);
            break;
            
        case 'stop':
            manager.shutdown();
            break;
            
        default:
            console.log('Usage: mcp-isolation-manager.js {start|status|stop}');
            console.log('');
            console.log('Commands:');
            console.log('  start  - Start the isolation manager');
            console.log('  status - Show current status');
            console.log('  stop   - Stop all servers and exit');
            process.exit(1);
    }
}

module.exports = MCPIsolationManager;