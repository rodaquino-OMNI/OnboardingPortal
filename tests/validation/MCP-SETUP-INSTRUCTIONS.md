# MCP Server Setup Instructions

## Quick Setup

1. Install Claude Desktop if not already installed
2. Copy the MCP configuration:
   
   ```bash
   # For macOS/Linux
   mkdir -p ~/.config/claude
   cp mcp-config-sample.json ~/.config/claude/mcp.json
   
   # For Windows
   mkdir "%APPDATA%\Claude"
   copy mcp-config-sample.json "%APPDATA%\Claude\mcp.json"
   ```

3. Restart Claude Desktop
4. Test MCP servers:
   
   ```bash
   # Test individual servers
   npx ruv-swarm@latest --help
   npx claude-flow@alpha --help
   npx flow-nexus@alpha --help
   ```

## Manual Registration (Alternative)

If CLI is available:

```bash
claude mcp add ruv-swarm npx ruv-swarm@latest mcp start
claude mcp add claude-flow npx claude-flow@alpha mcp start
claude mcp add flow-nexus npx flow-nexus@alpha mcp start
```

## Verification

Run the validation test to verify setup:
```bash
node tests/validation/quick-validation-check.js
```
