# 🚀 Startup Verification Checklist

## Quick Health Check Commands

Run these commands after starting the containers to verify everything is working:

```bash
# 1. Check if all containers are running
docker ps | grep -E "austa_backend|austa_frontend|austa_mysql|austa_redis"

# 2. Verify backend health
curl http://localhost:8000/api/health | jq .

# 3. Verify frontend is serving
curl -I http://localhost:3000 | head -1

# 4. Test authentication endpoint
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3000" \
  -d '{"email":"admin@omnihealth.com","password":"Admin@123"}'

# 5. Test gamification performance (should be < 0.2s)
time curl "http://localhost:8000/api/gamification/leaderboard?limit=10" -o /dev/null -s
```

## Permanent Fixes Applied

### ✅ Will Always Persist:
- **Code fixes** in all PHP/TypeScript files
- **Database migrations** (including performance indexes)
- **Frontend hydration fix** for greeting
- **Removed hardcoded credentials**
- **N+1 query optimizations**
- **Caching implementations**

### ⚠️ May Need Attention on Fresh Start:

1. **Backend .env Configuration**
   - Ensure using MySQL not SQLite
   - Check database credentials match docker-compose

2. **Storage Permissions** (if errors occur):
   ```bash
   docker exec austa_backend sh -c "chmod -R 775 storage bootstrap/cache"
   ```

3. **Clear Caches** (if configuration issues):
   ```bash
   docker exec austa_backend php artisan config:clear
   docker exec austa_backend php artisan cache:clear
   docker exec austa_backend php artisan config:cache
   ```

## Expected Performance Metrics

After all fixes are applied:
- Backend health check: < 200ms
- Frontend page load: < 2s
- Gamification endpoints: < 200ms
- Authentication: < 300ms

## If Issues Reappear

Most likely causes:
1. **Container rebuilt without volumes** - Re-run migrations
2. **Cache corruption** - Clear all caches
3. **Permission issues** - Run permission fix commands
4. **Database not ready** - Wait 30s after docker-compose up

## Startup Sequence

Correct startup order:
1. `docker-compose up -d`
2. Wait 30 seconds for MySQL to initialize
3. Run health check commands above
4. Access http://localhost:3000

All critical fixes are permanent and in the codebase. Only operational configurations might need re-applying on fresh container builds.