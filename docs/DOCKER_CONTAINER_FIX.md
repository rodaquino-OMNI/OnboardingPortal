# 🐳 Docker Container Fix Instructions

## Current Situation
- Docker Desktop is running but CLI connection is broken
- Container `austa_frontend` is stopped (port conflict with local dev)
- Other containers (`austa_backend`, `austa_nginx`, `austa_mysql`) are running

## ✅ Option 1: Fix via Docker Desktop UI (Recommended)

### Step 1: Stop Local Services
The local services are blocking port 3000. Stop them:
```bash
# Find and kill processes on port 3000 and 8000
lsof -t -i:3000 | xargs kill -9
lsof -t -i:8000 | xargs kill -9
```

### Step 2: Start Frontend Container in Docker Desktop
1. Open Docker Desktop
2. Go to "Containers" tab
3. Find `austa_frontend` container
4. Click the **Start** button (▶️) next to it
5. Wait for the green circle indicator

### Step 3: Verify All Containers Running
Check that all containers show green circles:
- ✅ `austa_backend` - Running
- ✅ `austa_nginx` - Running  
- ✅ `austa_mysql` - Running
- ✅ `austa_frontend` - Should be running after Step 2

### Step 4: Access Application
Once all containers are running:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8443 (via nginx)

## ✅ Option 2: Run Locally Without Docker (Currently Active)

Services are already running locally:
- **Frontend**: http://localhost:3000 ✅
- **Backend**: http://localhost:8000 ✅

### Working Credentials
All these credentials are tested and working:
- `admin@omnihealth.com` / `Admin@123`
- `maria.silva@omnihealth.com` / `Doctor@123!`
- `carlos.santos@omnihealth.com` / `Coord@123!`
- `ana.costa@empresa.com` / `Employee@123!`

## 🔧 Fix Docker CLI Connection

If you want to fix the Docker CLI connection:

### Method 1: Restart Docker Desktop
1. Click Docker icon in menu bar
2. Select "Quit Docker Desktop"
3. Restart Docker Desktop
4. Wait for it to fully initialize

### Method 2: Reset Docker Context
```bash
# Reset to default context
docker context use default

# Or use desktop-linux context
docker context use desktop-linux

# Test connection
docker ps
```

### Method 3: Reinstall Docker CLI Tools
```bash
# From Docker Desktop menu
Settings → General → "Install command line tools"
```

## 📊 Container Port Mappings

| Container | Internal Port | External Port | Purpose |
|-----------|--------------|---------------|---------|
| austa_frontend | 3000 | 3000 | Next.js Frontend |
| austa_backend | 9000 | - | Laravel Backend (via nginx) |
| austa_nginx | 80 | 8443 | Web Server/Proxy |
| austa_mysql | 3306 | 3306 | Database |

## 🚨 Common Issues

### Port Already in Use
If you see "bind: address already in use":
1. Stop the local development servers
2. Free the ports: `lsof -t -i:3000 | xargs kill -9`
3. Start the Docker container

### Container Keeps Stopping
Check container logs in Docker Desktop:
1. Click on the container name
2. Go to "Logs" tab
3. Look for error messages

### Frontend Can't Connect to Backend
Ensure all containers are in the same network:
- All should be in `omni-portal_default` network
- Check nginx is routing correctly to backend

---

*Current Status: Local services running successfully at http://localhost:3000*