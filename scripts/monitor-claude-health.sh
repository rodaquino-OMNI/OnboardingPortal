#!/bin/bash

# Claude Code Health Monitoring Script
# Provides real-time monitoring of system health

echo "🏥 Claude Code Health Monitor"
echo "=============================="
echo ""

while true; do
    clear
    echo "🏥 Claude Code Health Monitor - $(date)"
    echo "=============================="
    echo ""
    
    # Extension Status
    echo "📦 Extension Status:"
    EXTENSION_COUNT=$(ls -d ~/.vscode/extensions/anthropic.claude-code* 2>/dev/null | wc -l)
    if [ "$EXTENSION_COUNT" -eq 1 ]; then
        echo "   ✅ Single version installed (healthy)"
        EXTENSION_VERSION=$(ls -d ~/.vscode/extensions/anthropic.claude-code* | xargs basename | cut -d'-' -f3-)
        echo "   📌 Version: $EXTENSION_VERSION"
    else
        echo "   ⚠️  Multiple versions detected: $EXTENSION_COUNT"
    fi
    echo ""
    
    # MCP Server Status
    echo "🖥️  MCP Server Status:"
    MCP_COUNT=$(ps aux | grep -E "(mcp start)" | grep -v grep | wc -l)
    CLAUDE_FLOW_COUNT=$(ps aux | grep "claude-flow" | grep -v grep | wc -l)
    RUV_SWARM_COUNT=$(ps aux | grep "ruv-swarm" | grep -v grep | wc -l)
    FLOW_NEXUS_COUNT=$(ps aux | grep "flow-nexus" | grep -v grep | wc -l)
    
    echo "   • MCP Servers: $MCP_COUNT"
    echo "   • Claude Flow: $CLAUDE_FLOW_COUNT"
    echo "   • RUV Swarm: $RUV_SWARM_COUNT"
    echo "   • Flow Nexus: $FLOW_NEXUS_COUNT"
    
    TOTAL_MCP=$((MCP_COUNT + CLAUDE_FLOW_COUNT + RUV_SWARM_COUNT + FLOW_NEXUS_COUNT))
    if [ "$TOTAL_MCP" -le 3 ]; then
        echo "   ✅ Resource usage normal"
    else
        echo "   ⚠️  High resource usage detected"
    fi
    echo ""
    
    # Resource Usage
    echo "📊 Resource Usage:"
    # CPU usage of top Claude processes
    ps aux | grep -E "(claude|mcp|node)" | grep -v grep | head -5 | awk '{printf "   • %s: CPU %.1f%% MEM %.1f%%\n", substr($11,1,20), $3, $4}'
    echo ""
    
    # File System Health
    echo "📁 File System:"
    TODO_COUNT=$(ls -1 ~/.claude/todos 2>/dev/null | wc -l)
    echo "   • Todo Files: $TODO_COUNT"
    if [ "$TODO_COUNT" -gt 100 ]; then
        echo "     ⚠️  Consider cleanup (>100 files)"
    else
        echo "     ✅ Normal"
    fi
    
    # Port Usage
    echo ""
    echo "🔌 Port Usage (3000-3200):"
    lsof -i :3000-3200 2>/dev/null | grep LISTEN | awk '{printf "   • Port %s: %s\n", $9, $1}' | head -5
    
    # Configuration Status
    echo ""
    echo "⚙️  Configuration:"
    if [ -f "$HOME/.claude/mcp_settings.json" ]; then
        echo "   ✅ MCP configuration exists"
    else
        echo "   ⚠️  MCP configuration missing"
    fi
    
    if [ -f "$HOME/.claude/extension-lock.json" ]; then
        echo "   ✅ Extension lock active"
    else
        echo "   ⚠️  Extension lock missing"
    fi
    
    # Overall Health Score
    echo ""
    echo "═══════════════════════════════"
    HEALTH_SCORE=100
    [ "$EXTENSION_COUNT" -ne 1 ] && HEALTH_SCORE=$((HEALTH_SCORE - 25))
    [ "$TOTAL_MCP" -gt 5 ] && HEALTH_SCORE=$((HEALTH_SCORE - 25))
    [ "$TODO_COUNT" -gt 100 ] && HEALTH_SCORE=$((HEALTH_SCORE - 15))
    [ ! -f "$HOME/.claude/mcp_settings.json" ] && HEALTH_SCORE=$((HEALTH_SCORE - 20))
    
    if [ "$HEALTH_SCORE" -ge 80 ]; then
        echo "🟢 Overall Health: $HEALTH_SCORE% - System Healthy"
    elif [ "$HEALTH_SCORE" -ge 60 ]; then
        echo "🟡 Overall Health: $HEALTH_SCORE% - Minor Issues"
    else
        echo "🔴 Overall Health: $HEALTH_SCORE% - Attention Required"
    fi
    echo "═══════════════════════════════"
    echo ""
    echo "Press Ctrl+C to exit | Refreshing in 10s..."
    sleep 10
done