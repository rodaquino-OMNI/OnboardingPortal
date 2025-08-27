#!/usr/bin/env node

/**
 * Shell Connection Stabilizer - Manages stable shell connections with retry logic
 * Implements session persistence, connection monitoring, and automatic recovery
 */

const fs = require('fs');
const path = require('path');
const { spawn, exec } = require('child_process');
const EventEmitter = require('events');
const crypto = require('crypto');
const os = require('os');

class ShellConnectionStabilizer extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.options = {
            maxRetries: 5,
            retryDelay: 2000,
            exponentialBackoff: true,
            healthCheckInterval: 30000,
            sessionTimeout: 300000, // 5 minutes
            sessionDir: path.join(os.tmpdir(), 'shell-sessions'),
            logFile: path.join(process.cwd(), 'logs/shell-stabilizer.log'),
            enablePersistence: true,
            enableDiagnostics: true,
            ...options
        };
        
        this.sessions = new Map();
        this.connections = new Map();
        this.healthChecks = new Map();
        this.logger = this.createLogger();
        this.diagnostics = this.createDiagnostics();
        
        this.init();
    }
    
    init() {
        this.logger.info('Initializing Shell Connection Stabilizer');
        
        // Create necessary directories
        this.ensureDirectories();
        
        // Load existing sessions if persistence is enabled
        if (this.options.enablePersistence) {
            this.loadPersistedSessions();
        }
        
        // Start health monitoring
        this.startHealthMonitoring();
        
        // Setup cleanup handlers
        process.on('SIGTERM', () => this.cleanup());
        process.on('SIGINT', () => this.cleanup());
        process.on('beforeExit', () => this.cleanup());
        
        this.emit('initialized');
    }
    
    createLogger() {
        const logDir = path.dirname(this.options.logFile);
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
                    sessionId: data.sessionId,
                    connectionId: data.connectionId,
                    ...data
                };
                
                const logLine = JSON.stringify(logEntry) + '\n';
                
                try {
                    fs.appendFileSync(this.options.logFile, logLine);
                } catch (error) {
                    console.error('Failed to write log:', error.message);
                }
                
                if (level === 'ERROR' || level === 'WARN') {
                    console.log(`[${timestamp}] ${level}: ${message}`);
                }
            },
            info: (message, data) => this.log('INFO', message, data),
            warn: (message, data) => this.log('WARN', message, data),
            error: (message, data) => this.log('ERROR', message, data),
            debug: (message, data) => this.log('DEBUG', message, data)
        };
    }
    
    createDiagnostics() {
        return {
            connectionAttempts: 0,
            successfulConnections: 0,
            failedConnections: 0,
            totalRetries: 0,
            averageConnectionTime: 0,
            activeSessions: 0,
            healthCheckFailures: 0,
            lastDiagnosticRun: null,
            
            record: function(event, data = {}) {
                this[event] = (this[event] || 0) + 1;
                if (data.duration) {
                    this.averageConnectionTime = 
                        (this.averageConnectionTime + data.duration) / 2;
                }
            },
            
            getReport: function() {
                return {
                    ...this,
                    timestamp: new Date().toISOString(),
                    successRate: this.connectionAttempts > 0 
                        ? (this.successfulConnections / this.connectionAttempts) * 100 
                        : 0
                };
            }
        };
    }
    
    ensureDirectories() {
        const dirs = [
            this.options.sessionDir,
            path.dirname(this.options.logFile)
        ];
        
        dirs.forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        });
    }
    
    generateSessionId() {
        return 'shell_' + crypto.randomBytes(8).toString('hex');
    }
    
    async createConnection(command = '/bin/bash', args = [], options = {}) {
        const sessionId = this.generateSessionId();
        const connectionId = crypto.randomBytes(4).toString('hex');
        
        this.logger.info('Creating new shell connection', { sessionId, connectionId, command });
        this.diagnostics.record('connectionAttempts');
        
        const startTime = Date.now();
        
        try {
            const connection = await this.attemptConnection(
                sessionId, 
                connectionId, 
                command, 
                args, 
                options
            );
            
            const duration = Date.now() - startTime;
            this.diagnostics.record('successfulConnections', { duration });
            this.diagnostics.activeSessions++;
            
            this.logger.info('Shell connection established successfully', {
                sessionId,
                connectionId,
                duration
            });
            
            return connection;
            
        } catch (error) {
            this.diagnostics.record('failedConnections');
            this.logger.error('Failed to create shell connection', {
                sessionId,
                connectionId,
                error: error.message
            });
            throw error;
        }
    }
    
    async attemptConnection(sessionId, connectionId, command, args, options, attempt = 1) {
        return new Promise((resolve, reject) => {
            const connectionOptions = {
                stdio: 'pipe',
                shell: true,
                env: {
                    ...process.env,
                    SHELL_SESSION_ID: sessionId,
                    SHELL_CONNECTION_ID: connectionId,
                    ...options.env
                },
                cwd: options.cwd || process.cwd(),
                ...options
            };
            
            const child = spawn(command, args, connectionOptions);
            
            const session = {
                id: sessionId,
                connectionId,
                process: child,
                command,
                args,
                options: connectionOptions,
                createdAt: Date.now(),
                lastActivity: Date.now(),
                status: 'starting',
                retryCount: attempt - 1,
                outputBuffer: [],
                errorBuffer: []
            };
            
            // Store session
            this.sessions.set(sessionId, session);
            this.connections.set(connectionId, session);
            
            // Setup event handlers
            this.setupConnectionHandlers(session, resolve, reject, attempt);
            
            // Set connection timeout
            const timeout = setTimeout(() => {
                if (session.status === 'starting') {
                    session.status = 'timeout';
                    child.kill('SIGTERM');
                    reject(new Error('Connection timeout'));
                }
            }, 10000);
            
            session.timeout = timeout;
        });
    }
    
    setupConnectionHandlers(session, resolve, reject, attempt) {
        const { process: child, id: sessionId, connectionId } = session;
        
        child.on('spawn', () => {
            clearTimeout(session.timeout);
            session.status = 'connected';
            session.lastActivity = Date.now();
            
            this.logger.info('Shell process spawned successfully', { sessionId, connectionId });
            
            // Persist session if enabled
            if (this.options.enablePersistence) {
                this.persistSession(session);
            }
            
            resolve(session);
        });
        
        child.on('error', (error) => {
            clearTimeout(session.timeout);
            session.status = 'error';
            
            this.logger.error('Shell process error', {
                sessionId,
                connectionId,
                error: error.message,
                attempt
            });
            
            // Retry logic
            if (attempt < this.options.maxRetries) {
                this.diagnostics.record('totalRetries');
                
                const delay = this.options.exponentialBackoff
                    ? this.options.retryDelay * Math.pow(2, attempt - 1)
                    : this.options.retryDelay;
                
                this.logger.info('Retrying connection', {
                    sessionId,
                    connectionId,
                    attempt: attempt + 1,
                    delay
                });
                
                setTimeout(async () => {
                    try {
                        const retryConnection = await this.attemptConnection(
                            sessionId,
                            connectionId,
                            session.command,
                            session.args,
                            session.options,
                            attempt + 1
                        );
                        resolve(retryConnection);
                    } catch (retryError) {
                        reject(retryError);
                    }
                }, delay);
            } else {
                reject(error);
            }
        });
        
        child.on('exit', (code, signal) => {
            session.status = 'exited';
            session.exitCode = code;
            session.exitSignal = signal;
            
            this.logger.info('Shell process exited', {
                sessionId,
                connectionId,
                code,
                signal
            });
            
            // Clean up session
            this.cleanupSession(sessionId);
        });
        
        // Buffer output for diagnostics
        if (child.stdout) {
            child.stdout.on('data', (data) => {
                session.lastActivity = Date.now();
                session.outputBuffer.push({
                    timestamp: Date.now(),
                    data: data.toString()
                });
                
                // Keep only last 100 entries
                if (session.outputBuffer.length > 100) {
                    session.outputBuffer.shift();
                }
            });
        }
        
        if (child.stderr) {
            child.stderr.on('data', (data) => {
                session.lastActivity = Date.now();
                session.errorBuffer.push({
                    timestamp: Date.now(),
                    data: data.toString()
                });
                
                if (session.errorBuffer.length > 100) {
                    session.errorBuffer.shift();
                }
            });
        }
    }
    
    persistSession(session) {
        try {
            const sessionFile = path.join(
                this.options.sessionDir,
                `${session.id}.json`
            );
            
            const sessionData = {
                id: session.id,
                connectionId: session.connectionId,
                command: session.command,
                args: session.args,
                options: session.options,
                createdAt: session.createdAt,
                status: session.status,
                pid: session.process?.pid
            };
            
            fs.writeFileSync(sessionFile, JSON.stringify(sessionData, null, 2));
            
        } catch (error) {
            this.logger.error('Failed to persist session', {
                sessionId: session.id,
                error: error.message
            });
        }
    }
    
    loadPersistedSessions() {
        try {
            if (!fs.existsSync(this.options.sessionDir)) {
                return;
            }
            
            const sessionFiles = fs.readdirSync(this.options.sessionDir)
                .filter(file => file.endsWith('.json'));
            
            sessionFiles.forEach(file => {
                try {
                    const sessionPath = path.join(this.options.sessionDir, file);
                    const sessionData = JSON.parse(fs.readFileSync(sessionPath, 'utf8'));
                    
                    // Check if process is still alive
                    if (sessionData.pid && this.isProcessAlive(sessionData.pid)) {
                        this.logger.info('Restored active session', {
                            sessionId: sessionData.id
                        });
                        
                        // Note: Full restoration would require more complex logic
                        // This is a simplified version for demonstration
                    } else {
                        // Clean up stale session file
                        fs.unlinkSync(sessionPath);
                    }
                } catch (error) {
                    this.logger.warn('Failed to load persisted session', {
                        file,
                        error: error.message
                    });
                }
            });
            
        } catch (error) {
            this.logger.error('Failed to load persisted sessions', {
                error: error.message
            });
        }
    }
    
    isProcessAlive(pid) {
        try {
            process.kill(pid, 0);
            return true;
        } catch (error) {
            return false;
        }
    }
    
    startHealthMonitoring() {
        setInterval(() => {
            this.performHealthChecks();
        }, this.options.healthCheckInterval);
        
        this.logger.info('Health monitoring started', {
            interval: this.options.healthCheckInterval
        });
    }
    
    performHealthChecks() {
        const now = Date.now();
        
        for (const [sessionId, session] of this.sessions) {
            try {
                // Check if session has been inactive too long
                const inactiveTime = now - session.lastActivity;
                if (inactiveTime > this.options.sessionTimeout) {
                    this.logger.warn('Session timeout detected', {
                        sessionId,
                        inactiveTime
                    });
                    
                    this.cleanupSession(sessionId);
                    continue;
                }
                
                // Check if process is still alive
                if (session.process && !this.isProcessAlive(session.process.pid)) {
                    this.logger.warn('Dead process detected', {
                        sessionId,
                        pid: session.process.pid
                    });
                    
                    this.cleanupSession(sessionId);
                    continue;
                }
                
                // Record successful health check
                this.healthChecks.set(sessionId, {
                    timestamp: now,
                    status: 'healthy'
                });
                
            } catch (error) {
                this.diagnostics.record('healthCheckFailures');
                this.logger.error('Health check failed', {
                    sessionId,
                    error: error.message
                });
                
                this.healthChecks.set(sessionId, {
                    timestamp: now,
                    status: 'unhealthy',
                    error: error.message
                });
            }
        }
    }
    
    cleanupSession(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session) return;
        
        this.logger.info('Cleaning up session', { sessionId });
        
        try {
            // Kill process if still running
            if (session.process && this.isProcessAlive(session.process.pid)) {
                session.process.kill('SIGTERM');
            }
            
            // Remove from maps
            this.sessions.delete(sessionId);
            this.connections.delete(session.connectionId);
            this.healthChecks.delete(sessionId);
            
            // Remove persisted session file
            if (this.options.enablePersistence) {
                const sessionFile = path.join(this.options.sessionDir, `${sessionId}.json`);
                if (fs.existsSync(sessionFile)) {
                    fs.unlinkSync(sessionFile);
                }
            }
            
            this.diagnostics.activeSessions = Math.max(0, this.diagnostics.activeSessions - 1);
            
        } catch (error) {
            this.logger.error('Failed to cleanup session', {
                sessionId,
                error: error.message
            });
        }
    }
    
    getSession(sessionId) {
        return this.sessions.get(sessionId);
    }
    
    getConnection(connectionId) {
        return this.connections.get(connectionId);
    }
    
    getAllSessions() {
        return Array.from(this.sessions.values()).map(session => ({
            id: session.id,
            connectionId: session.connectionId,
            status: session.status,
            createdAt: session.createdAt,
            lastActivity: session.lastActivity,
            retryCount: session.retryCount,
            pid: session.process?.pid
        }));
    }
    
    getDiagnostics() {
        this.diagnostics.lastDiagnosticRun = Date.now();
        return this.diagnostics.getReport();
    }
    
    async cleanup() {
        this.logger.info('Cleaning up Shell Connection Stabilizer');
        
        // Clean up all sessions
        const sessionIds = Array.from(this.sessions.keys());
        sessionIds.forEach(sessionId => this.cleanupSession(sessionId));
        
        this.logger.info('Cleanup completed');
    }
}

// CLI Interface
if (require.main === module) {
    const command = process.argv[2];
    const stabilizer = new ShellConnectionStabilizer();
    
    switch (command) {
        case 'start':
            console.log('Shell Connection Stabilizer started');
            stabilizer.on('initialized', () => {
                console.log('Ready to manage shell connections');
            });
            
            // Keep process alive
            process.stdin.resume();
            break;
            
        case 'test':
            (async () => {
                try {
                    console.log('Creating test connection...');
                    const connection = await stabilizer.createConnection('echo', ['Hello, World!']);
                    console.log('Test connection created:', connection.id);
                    
                    setTimeout(() => {
                        console.log('Diagnostics:', stabilizer.getDiagnostics());
                        console.log('Sessions:', stabilizer.getAllSessions());
                        process.exit(0);
                    }, 2000);
                } catch (error) {
                    console.error('Test failed:', error.message);
                    process.exit(1);
                }
            })();
            break;
            
        case 'status':
            console.log('Sessions:', stabilizer.getAllSessions());
            console.log('Diagnostics:', stabilizer.getDiagnostics());
            process.exit(0);
            break;
            
        case 'cleanup':
            stabilizer.cleanup().then(() => {
                console.log('Cleanup completed');
                process.exit(0);
            });
            break;
            
        default:
            console.log('Usage: shell-connection-stabilizer.js {start|test|status|cleanup}');
            console.log('');
            console.log('Commands:');
            console.log('  start   - Start the connection stabilizer');
            console.log('  test    - Run a test connection');
            console.log('  status  - Show current status and diagnostics');
            console.log('  cleanup - Clean up all sessions and exit');
            process.exit(1);
    }
}

module.exports = ShellConnectionStabilizer;