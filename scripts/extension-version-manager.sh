#!/bin/bash

# Extension Version Manager - Lock and manage VSCode extension versions
# Prevents automatic updates and provides controlled update mechanisms

set -euo pipefail

# Configuration
CONFIG_DIR="$HOME/.vscode/extensions-version-lock"
BACKUP_DIR="$CONFIG_DIR/backups"
LOCK_FILE="$CONFIG_DIR/version-lock.json"
LOG_FILE="$CONFIG_DIR/extension-manager.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

# Initialize extension manager
init_extension_manager() {
    log "Initializing Extension Version Manager"
    mkdir -p "$CONFIG_DIR" "$BACKUP_DIR"
    
    if [[ ! -f "$LOCK_FILE" ]]; then
        echo '{
  "locked_extensions": {},
  "auto_update_disabled": false,
  "last_backup": null,
  "version": "1.0.0"
}' > "$LOCK_FILE"
        log "Created initial lock file"
    fi
}

# Get current extension versions
get_extension_versions() {
    log "Scanning current extension versions"
    code --list-extensions --show-versions | while IFS='@' read -r name version; do
        echo "  $name: $version"
    done
}

# Lock extension to current version
lock_extension() {
    local extension_id="$1"
    local current_version
    
    current_version=$(code --list-extensions --show-versions | grep "^$extension_id@" | cut -d'@' -f2)
    
    if [[ -z "$current_version" ]]; then
        echo -e "${RED}Extension $extension_id not found${NC}"
        return 1
    fi
    
    # Update lock file
    jq --arg ext "$extension_id" --arg ver "$current_version" \
       '.locked_extensions[$ext] = $ver' "$LOCK_FILE" > "$LOCK_FILE.tmp" && \
       mv "$LOCK_FILE.tmp" "$LOCK_FILE"
    
    log "Locked $extension_id to version $current_version"
    echo -e "${GREEN}Extension $extension_id locked to version $current_version${NC}"
}

# Unlock extension
unlock_extension() {
    local extension_id="$1"
    
    jq --arg ext "$extension_id" 'del(.locked_extensions[$ext])' "$LOCK_FILE" > "$LOCK_FILE.tmp" && \
       mv "$LOCK_FILE.tmp" "$LOCK_FILE"
    
    log "Unlocked $extension_id"
    echo -e "${GREEN}Extension $extension_id unlocked${NC}"
}

# Create backup of current extensions
backup_extensions() {
    local backup_name="extensions-$(date +%Y%m%d_%H%M%S)"
    local backup_path="$BACKUP_DIR/$backup_name.json"
    
    log "Creating extension backup: $backup_name"
    
    {
        echo '{'
        echo '  "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",'
        echo '  "extensions": ['
        
        local first=true
        code --list-extensions --show-versions | while IFS='@' read -r name version; do
            if [[ "$first" == "true" ]]; then
                first=false
            else
                echo ','
            fi
            echo -n "    {\"id\": \"$name\", \"version\": \"$version\"}"
        done
        
        echo ''
        echo '  ]'
        echo '}'
    } > "$backup_path"
    
    # Update lock file with backup info
    jq --arg backup "$backup_name" '.last_backup = $backup' "$LOCK_FILE" > "$LOCK_FILE.tmp" && \
       mv "$LOCK_FILE.tmp" "$LOCK_FILE"
    
    log "Backup created: $backup_path"
    echo -e "${GREEN}Backup created: $backup_name${NC}"
}

# Restore from backup
restore_extensions() {
    local backup_name="$1"
    local backup_path="$BACKUP_DIR/$backup_name.json"
    
    if [[ ! -f "$backup_path" ]]; then
        echo -e "${RED}Backup $backup_name not found${NC}"
        return 1
    fi
    
    log "Restoring from backup: $backup_name"
    
    # Parse backup and reinstall extensions
    jq -r '.extensions[] | .id + "@" + .version' "$backup_path" | while read -r ext_spec; do
        echo "Installing $ext_spec..."
        code --install-extension "$ext_spec" --force
    done
    
    log "Restore completed from $backup_name"
    echo -e "${GREEN}Extensions restored from $backup_name${NC}"
}

# Disable auto-updates globally
disable_auto_updates() {
    log "Disabling automatic extension updates"
    
    # VSCode settings
    local settings_file="$HOME/.vscode/settings.json"
    
    if [[ -f "$settings_file" ]]; then
        # Update existing settings
        jq '."extensions.autoUpdate" = false | ."extensions.autoCheckUpdates" = false' "$settings_file" > "$settings_file.tmp" && \
           mv "$settings_file.tmp" "$settings_file"
    else
        # Create new settings file
        mkdir -p "$(dirname "$settings_file")"
        echo '{
  "extensions.autoUpdate": false,
  "extensions.autoCheckUpdates": false
}' > "$settings_file"
    fi
    
    # Update lock file
    jq '.auto_update_disabled = true' "$LOCK_FILE" > "$LOCK_FILE.tmp" && \
       mv "$LOCK_FILE.tmp" "$LOCK_FILE"
    
    log "Auto-updates disabled"
    echo -e "${GREEN}Automatic extension updates disabled${NC}"
}

# Enable auto-updates
enable_auto_updates() {
    log "Enabling automatic extension updates"
    
    local settings_file="$HOME/.vscode/settings.json"
    
    if [[ -f "$settings_file" ]]; then
        jq '."extensions.autoUpdate" = true | ."extensions.autoCheckUpdates" = true' "$settings_file" > "$settings_file.tmp" && \
           mv "$settings_file.tmp" "$settings_file"
    fi
    
    # Update lock file
    jq '.auto_update_disabled = false' "$LOCK_FILE" > "$LOCK_FILE.tmp" && \
       mv "$LOCK_FILE.tmp" "$LOCK_FILE"
    
    log "Auto-updates enabled"
    echo -e "${GREEN}Automatic extension updates enabled${NC}"
}

# Check for conflicts and validate versions
validate_extensions() {
    log "Validating extension versions and checking for conflicts"
    
    local conflicts_found=false
    
    # Check locked versions vs installed
    jq -r '.locked_extensions | to_entries[] | .key + ":" + .value' "$LOCK_FILE" | while IFS=':' read -r ext_id locked_version; do
        local current_version
        current_version=$(code --list-extensions --show-versions | grep "^$ext_id@" | cut -d'@' -f2 || echo "NOT_INSTALLED")
        
        if [[ "$current_version" != "$locked_version" ]]; then
            echo -e "${YELLOW}WARNING: $ext_id version mismatch${NC}"
            echo "  Locked: $locked_version, Current: $current_version"
            conflicts_found=true
        fi
    done
    
    if [[ "$conflicts_found" == "false" ]]; then
        echo -e "${GREEN}All locked extensions are at correct versions${NC}"
    fi
}

# Show status
show_status() {
    echo -e "${BLUE}Extension Version Manager Status${NC}"
    echo "==============================="
    
    local auto_disabled
    auto_disabled=$(jq -r '.auto_update_disabled' "$LOCK_FILE")
    echo "Auto-updates disabled: $auto_disabled"
    
    local last_backup
    last_backup=$(jq -r '.last_backup // "None"' "$LOCK_FILE")
    echo "Last backup: $last_backup"
    
    echo -e "\n${BLUE}Locked Extensions:${NC}"
    jq -r '.locked_extensions | to_entries[] | "  " + .key + " @ " + .value' "$LOCK_FILE"
    
    echo -e "\n${BLUE}Available Backups:${NC}"
    if ls "$BACKUP_DIR"/*.json >/dev/null 2>&1; then
        ls -1 "$BACKUP_DIR"/*.json | xargs -I {} basename {} .json | sed 's/^/  /'
    else
        echo "  None"
    fi
}

# Main function
main() {
    init_extension_manager
    
    case "${1:-status}" in
        "init")
            echo "Extension Version Manager initialized"
            ;;
        "lock")
            if [[ -z "${2:-}" ]]; then
                echo "Usage: $0 lock <extension-id>"
                exit 1
            fi
            lock_extension "$2"
            ;;
        "unlock")
            if [[ -z "${2:-}" ]]; then
                echo "Usage: $0 unlock <extension-id>"
                exit 1
            fi
            unlock_extension "$2"
            ;;
        "backup")
            backup_extensions
            ;;
        "restore")
            if [[ -z "${2:-}" ]]; then
                echo "Usage: $0 restore <backup-name>"
                exit 1
            fi
            restore_extensions "$2"
            ;;
        "disable-updates")
            disable_auto_updates
            ;;
        "enable-updates")
            enable_auto_updates
            ;;
        "validate")
            validate_extensions
            ;;
        "versions")
            get_extension_versions
            ;;
        "status")
            show_status
            ;;
        "help")
            echo "Extension Version Manager"
            echo "Usage: $0 {init|lock|unlock|backup|restore|disable-updates|enable-updates|validate|versions|status|help}"
            echo ""
            echo "Commands:"
            echo "  init                 - Initialize extension manager"
            echo "  lock <ext-id>        - Lock extension to current version"
            echo "  unlock <ext-id>      - Unlock extension"
            echo "  backup              - Create backup of all extensions"
            echo "  restore <name>      - Restore from backup"
            echo "  disable-updates     - Disable automatic updates"
            echo "  enable-updates      - Enable automatic updates"
            echo "  validate            - Check for version conflicts"
            echo "  versions            - List all extension versions"
            echo "  status              - Show manager status"
            echo "  help                - Show this help"
            ;;
        *)
            echo "Unknown command: $1"
            echo "Use '$0 help' for usage information"
            exit 1
            ;;
    esac
}

main "$@"