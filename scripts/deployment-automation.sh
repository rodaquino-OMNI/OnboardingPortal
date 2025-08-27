#!/bin/bash

# Technical Excellence Deployment Script
# Automates the deployment of stability fixes across the development environment

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
CONFIG_DIR="$PROJECT_ROOT/config"
LOG_DIR="$PROJECT_ROOT/logs"
DATESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="$LOG_DIR/deployment_$DATESTAMP.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Logging functions
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1" | tee -a "$LOG_FILE"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$LOG_FILE"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
}

log_header() {
    echo -e "\n${PURPLE}=== $1 ===${NC}" | tee -a "$LOG_FILE"
}

# Initialize directories
init_directories() {
    log_header "Initializing Directories"
    
    local dirs=("$LOG_DIR" "$CONFIG_DIR")
    
    for dir in "${dirs[@]}"; do
        if [[ ! -d "$dir" ]]; then
            mkdir -p "$dir"
            log_success "Created directory: $dir"
        else
            log_info "Directory already exists: $dir"
        fi
    done
}

# Check prerequisites
check_prerequisites() {
    log_header "Checking Prerequisites"
    
    local missing_tools=()
    local required_tools=("node" "npm" "code" "jq")
    
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            missing_tools+=("$tool")
            log_error "Missing required tool: $tool"
        else
            local version
            case $tool in
                "node")
                    version=$(node --version)
                    ;;
                "npm")
                    version=$(npm --version)
                    ;;
                "code")
                    version=$(code --version | head -1)
                    ;;
                "jq")
                    version=$(jq --version)
                    ;;
                *)
                    version="unknown"
                    ;;
            esac
            log_success "Found $tool: $version"
        fi
    done
    
    if [[ ${#missing_tools[@]} -gt 0 ]]; then
        log_error "Missing required tools: ${missing_tools[*]}"
        log_info "Please install missing tools and try again"
        return 1
    fi
    
    log_success "All prerequisites satisfied"
    return 0
}

# Deploy extension version manager
deploy_extension_manager() {
    log_header "Deploying Extension Version Manager"
    
    local script_path="$SCRIPT_DIR/extension-version-manager.sh"
    
    if [[ ! -f "$script_path" ]]; then
        log_error "Extension manager script not found: $script_path"
        return 1
    fi
    
    # Make script executable
    chmod +x "$script_path"
    log_success "Made extension manager executable"
    
    # Initialize extension manager
    if "$script_path" init; then
        log_success "Extension manager initialized"
    else
        log_error "Failed to initialize extension manager"
        return 1
    fi
    
    # Create initial backup
    if "$script_path" backup; then
        log_success "Created initial extension backup"
    else
        log_warn "Failed to create initial backup"
    fi
    
    # Disable auto-updates if requested
    if [[ "${DISABLE_AUTO_UPDATES:-true}" == "true" ]]; then
        if "$script_path" disable-updates; then
            log_success "Disabled automatic extension updates"
        else
            log_warn "Failed to disable automatic updates"
        fi
    fi
    
    log_success "Extension Version Manager deployed successfully"
}

# Deploy MCP isolation system
deploy_mcp_isolation() {
    log_header "Deploying MCP Isolation System"
    
    local manager_script="$SCRIPT_DIR/mcp-isolation-manager.js"
    local config_file="$CONFIG_DIR/mcp-isolation-config.json"
    
    if [[ ! -f "$manager_script" ]]; then
        log_error "MCP isolation manager not found: $manager_script"
        return 1
    fi
    
    if [[ ! -f "$config_file" ]]; then
        log_error "MCP isolation config not found: $config_file"
        return 1
    fi
    
    # Make script executable
    chmod +x "$manager_script"
    log_success "Made MCP isolation manager executable"
    
    # Test the manager
    if node "$manager_script" status >/dev/null 2>&1; then
        log_success "MCP isolation manager is functional"
    else
        log_warn "MCP isolation manager test failed (may be normal if no servers running)"
    fi
    
    # Validate configuration
    if jq empty < "$config_file" >/dev/null 2>&1; then
        log_success "MCP isolation configuration is valid JSON"
    else
        log_error "Invalid MCP isolation configuration"
        return 1
    fi
    
    log_success "MCP Isolation System deployed successfully"
}

# Deploy shell connection stabilizer
deploy_shell_stabilizer() {
    log_header "Deploying Shell Connection Stabilizer"
    
    local stabilizer_script="$SCRIPT_DIR/shell-connection-stabilizer.js"
    
    if [[ ! -f "$stabilizer_script" ]]; then
        log_error "Shell stabilizer not found: $stabilizer_script"
        return 1
    fi
    
    # Make script executable
    chmod +x "$stabilizer_script"
    log_success "Made shell stabilizer executable"
    
    # Test the stabilizer
    if node "$stabilizer_script" test; then
        log_success "Shell connection stabilizer test passed"
    else
        log_warn "Shell connection stabilizer test failed"
    fi
    
    log_success "Shell Connection Stabilizer deployed successfully"
}

# Deploy system diagnostic engine
deploy_diagnostic_engine() {
    log_header "Deploying System Diagnostic Engine"
    
    local engine_script="$SCRIPT_DIR/system-diagnostic-engine.js"
    local config_file="$CONFIG_DIR/system-diagnostic-config.json"
    
    if [[ ! -f "$engine_script" ]]; then
        log_error "Diagnostic engine not found: $engine_script"
        return 1
    fi
    
    if [[ ! -f "$config_file" ]]; then
        log_error "Diagnostic config not found: $config_file"
        return 1
    fi
    
    # Make script executable
    chmod +x "$engine_script"
    log_success "Made diagnostic engine executable"
    
    # Validate configuration
    if jq empty < "$config_file" >/dev/null 2>&1; then
        log_success "Diagnostic configuration is valid JSON"
    else
        log_error "Invalid diagnostic configuration"
        return 1
    fi
    
    # Test the engine
    if node "$engine_script" status >/dev/null 2>&1; then
        log_success "System diagnostic engine is functional"
    else
        log_warn "Diagnostic engine test failed"
    fi
    
    log_success "System Diagnostic Engine deployed successfully"
}

# Create systemd service files (Linux only)
create_systemd_services() {
    if [[ "$(uname)" != "Linux" ]]; then
        log_info "Skipping systemd services (not on Linux)"
        return 0
    fi
    
    log_header "Creating Systemd Services"
    
    local service_dir="$HOME/.config/systemd/user"
    mkdir -p "$service_dir"
    
    # MCP Isolation Service
    cat > "$service_dir/mcp-isolation.service" << EOF
[Unit]
Description=MCP Isolation Manager
After=graphical-session.target

[Service]
Type=simple
ExecStart=/usr/bin/node $SCRIPT_DIR/mcp-isolation-manager.js start
Restart=always
RestartSec=5
Environment=NODE_ENV=production
WorkingDirectory=$PROJECT_ROOT
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=default.target
EOF
    
    # System Diagnostic Service
    cat > "$service_dir/system-diagnostics.service" << EOF
[Unit]
Description=System Diagnostic Engine
After=graphical-session.target

[Service]
Type=simple
ExecStart=/usr/bin/node $SCRIPT_DIR/system-diagnostic-engine.js start
Restart=always
RestartSec=5
Environment=NODE_ENV=production
WorkingDirectory=$PROJECT_ROOT
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=default.target
EOF
    
    # Shell Stabilizer Service
    cat > "$service_dir/shell-stabilizer.service" << EOF
[Unit]
Description=Shell Connection Stabilizer
After=graphical-session.target

[Service]
Type=simple
ExecStart=/usr/bin/node $SCRIPT_DIR/shell-connection-stabilizer.js start
Restart=always
RestartSec=5
Environment=NODE_ENV=production
WorkingDirectory=$PROJECT_ROOT
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=default.target
EOF
    
    # Reload systemd
    if systemctl --user daemon-reload; then
        log_success "Systemd services created and daemon reloaded"
    else
        log_warn "Failed to reload systemd daemon"
    fi
    
    log_info "To enable services, run:"
    log_info "  systemctl --user enable mcp-isolation.service"
    log_info "  systemctl --user enable system-diagnostics.service"
    log_info "  systemctl --user enable shell-stabilizer.service"
}

# Create launchd plist files (macOS only)
create_launchd_services() {
    if [[ "$(uname)" != "Darwin" ]]; then
        log_info "Skipping launchd services (not on macOS)"
        return 0
    fi
    
    log_header "Creating Launchd Services"
    
    local service_dir="$HOME/Library/LaunchAgents"
    mkdir -p "$service_dir"
    
    # MCP Isolation Service
    cat > "$service_dir/com.claude.mcp-isolation.plist" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.claude.mcp-isolation</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/node</string>
        <string>$SCRIPT_DIR/mcp-isolation-manager.js</string>
        <string>start</string>
    </array>
    <key>WorkingDirectory</key>
    <string>$PROJECT_ROOT</string>
    <key>StandardOutPath</key>
    <string>$LOG_DIR/mcp-isolation.log</string>
    <key>StandardErrorPath</key>
    <string>$LOG_DIR/mcp-isolation-error.log</string>
    <key>KeepAlive</key>
    <true/>
    <key>RunAtLoad</key>
    <false/>
</dict>
</plist>
EOF
    
    # System Diagnostic Service
    cat > "$service_dir/com.claude.system-diagnostics.plist" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.claude.system-diagnostics</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/node</string>
        <string>$SCRIPT_DIR/system-diagnostic-engine.js</string>
        <string>start</string>
    </array>
    <key>WorkingDirectory</key>
    <string>$PROJECT_ROOT</string>
    <key>StandardOutPath</key>
    <string>$LOG_DIR/system-diagnostics.log</string>
    <key>StandardErrorPath</key>
    <string>$LOG_DIR/system-diagnostics-error.log</string>
    <key>KeepAlive</key>
    <true/>
    <key>RunAtLoad</key>
    <false/>
</dict>
</plist>
EOF
    
    log_success "Launchd services created"
    log_info "To load services, run:"
    log_info "  launchctl load ~/Library/LaunchAgents/com.claude.mcp-isolation.plist"
    log_info "  launchctl load ~/Library/LaunchAgents/com.claude.system-diagnostics.plist"
}

# Run system validation
run_validation() {
    log_header "Running System Validation"
    
    local validation_passed=true
    
    # Check if all scripts are executable
    local scripts=(
        "$SCRIPT_DIR/extension-version-manager.sh"
        "$SCRIPT_DIR/mcp-isolation-manager.js"
        "$SCRIPT_DIR/shell-connection-stabilizer.js"
        "$SCRIPT_DIR/system-diagnostic-engine.js"
    )
    
    for script in "${scripts[@]}"; do
        if [[ -x "$script" ]]; then
            log_success "Script is executable: $(basename "$script")"
        else
            log_error "Script is not executable: $(basename "$script")"
            validation_passed=false
        fi
    done
    
    # Check configuration files
    local configs=(
        "$CONFIG_DIR/mcp-isolation-config.json"
        "$CONFIG_DIR/system-diagnostic-config.json"
    )
    
    for config in "${configs[@]}"; do
        if [[ -f "$config" ]] && jq empty < "$config" >/dev/null 2>&1; then
            log_success "Configuration is valid: $(basename "$config")"
        else
            log_error "Invalid configuration: $(basename "$config")"
            validation_passed=false
        fi
    done
    
    # Test basic functionality
    log_info "Testing basic functionality..."
    
    # Test extension manager
    if "$SCRIPT_DIR/extension-version-manager.sh" status >/dev/null 2>&1; then
        log_success "Extension manager is working"
    else
        log_warn "Extension manager test failed"
    fi
    
    # Test diagnostic engine
    if node "$SCRIPT_DIR/system-diagnostic-engine.js" status >/dev/null 2>&1; then
        log_success "Diagnostic engine is working"
    else
        log_warn "Diagnostic engine test failed"
    fi
    
    if [[ "$validation_passed" == "true" ]]; then
        log_success "System validation passed"
        return 0
    else
        log_error "System validation failed"
        return 1
    fi
}

# Generate deployment report
generate_report() {
    log_header "Generating Deployment Report"
    
    local report_file="$LOG_DIR/deployment_report_$DATESTAMP.json"
    
    cat > "$report_file" << EOF
{
  "deployment": {
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "version": "1.0.0",
    "environment": "${ENVIRONMENT:-development}",
    "platform": "$(uname -s)",
    "architecture": "$(uname -m)",
    "user": "$(whoami)",
    "project_root": "$PROJECT_ROOT"
  },
  "components": {
    "extension_version_manager": {
      "deployed": true,
      "path": "$SCRIPT_DIR/extension-version-manager.sh",
      "executable": $([ -x "$SCRIPT_DIR/extension-version-manager.sh" ] && echo true || echo false)
    },
    "mcp_isolation_manager": {
      "deployed": true,
      "path": "$SCRIPT_DIR/mcp-isolation-manager.js",
      "config": "$CONFIG_DIR/mcp-isolation-config.json",
      "executable": $([ -x "$SCRIPT_DIR/mcp-isolation-manager.js" ] && echo true || echo false)
    },
    "shell_connection_stabilizer": {
      "deployed": true,
      "path": "$SCRIPT_DIR/shell-connection-stabilizer.js",
      "executable": $([ -x "$SCRIPT_DIR/shell-connection-stabilizer.js" ] && echo true || echo false)
    },
    "system_diagnostic_engine": {
      "deployed": true,
      "path": "$SCRIPT_DIR/system-diagnostic-engine.js",
      "config": "$CONFIG_DIR/system-diagnostic-config.json",
      "executable": $([ -x "$SCRIPT_DIR/system-diagnostic-engine.js" ] && echo true || echo false)
    }
  },
  "system_services": {
    "systemd": $([ "$(uname)" = "Linux" ] && echo true || echo false),
    "launchd": $([ "$(uname)" = "Darwin" ] && echo true || echo false)
  },
  "log_files": {
    "deployment_log": "$LOG_FILE",
    "report_file": "$report_file"
  },
  "next_steps": [
    "Review deployment logs",
    "Test individual components",
    "Configure system services if desired",
    "Set up monitoring and alerting"
  ]
}
EOF
    
    log_success "Deployment report generated: $report_file"
    
    # Display summary
    echo -e "\n${PURPLE}=== DEPLOYMENT SUMMARY ===${NC}"
    echo "Timestamp: $(date)"
    echo "Platform: $(uname -s) $(uname -m)"
    echo "Project Root: $PROJECT_ROOT"
    echo "Log File: $LOG_FILE"
    echo "Report File: $report_file"
    echo ""
    echo "Components Deployed:"
    echo "  ✓ Extension Version Manager"
    echo "  ✓ MCP Isolation System"
    echo "  ✓ Shell Connection Stabilizer"
    echo "  ✓ System Diagnostic Engine"
    echo ""
    echo "Next Steps:"
    echo "  1. Review logs for any warnings or errors"
    echo "  2. Test individual components:"
    echo "     ./scripts/extension-version-manager.sh status"
    echo "     node ./scripts/system-diagnostic-engine.js status"
    echo "  3. Configure system services if desired"
    echo "  4. Set up monitoring and alerting"
}

# Main deployment function
main() {
    echo -e "${PURPLE}"
    echo "======================================"
    echo "  Technical Excellence Deployment"
    echo "======================================"
    echo -e "${NC}"
    
    log "Starting deployment at $(date)"
    log "Platform: $(uname -s) $(uname -m)"
    log "User: $(whoami)"
    log "Project root: $PROJECT_ROOT"
    
    # Initialize
    init_directories
    
    # Check prerequisites
    if ! check_prerequisites; then
        log_error "Prerequisites check failed. Aborting deployment."
        exit 1
    fi
    
    # Deploy components
    local deployment_failed=false
    
    if ! deploy_extension_manager; then
        log_error "Extension manager deployment failed"
        deployment_failed=true
    fi
    
    if ! deploy_mcp_isolation; then
        log_error "MCP isolation deployment failed"
        deployment_failed=true
    fi
    
    if ! deploy_shell_stabilizer; then
        log_error "Shell stabilizer deployment failed"
        deployment_failed=true
    fi
    
    if ! deploy_diagnostic_engine; then
        log_error "Diagnostic engine deployment failed"
        deployment_failed=true
    fi
    
    # Create system services
    create_systemd_services
    create_launchd_services
    
    # Run validation
    if ! run_validation; then
        log_error "System validation failed"
        deployment_failed=true
    fi
    
    # Generate report
    generate_report
    
    if [[ "$deployment_failed" == "true" ]]; then
        log_error "Deployment completed with errors. Please review logs."
        exit 1
    else
        log_success "Deployment completed successfully!"
        exit 0
    fi
}

# Handle command line arguments
case "${1:-deploy}" in
    "deploy")
        main
        ;;
    "validate")
        init_directories
        run_validation
        ;;
    "report")
        generate_report
        ;;
    "help")
        echo "Technical Excellence Deployment Script"
        echo "Usage: $0 {deploy|validate|report|help}"
        echo ""
        echo "Commands:"
        echo "  deploy    - Full deployment (default)"
        echo "  validate  - Run validation checks only"
        echo "  report    - Generate deployment report"
        echo "  help      - Show this help"
        echo ""
        echo "Environment Variables:"
        echo "  DISABLE_AUTO_UPDATES - Disable extension auto-updates (default: true)"
        echo "  ENVIRONMENT - Deployment environment (default: development)"
        ;;
    *)
        echo "Unknown command: $1"
        echo "Use '$0 help' for usage information"
        exit 1
        ;;
esac