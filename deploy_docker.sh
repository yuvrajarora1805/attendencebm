#!/bin/bash
# ========================================================
# AttendPro ERP - 1-Click Docker Deployment Script
# Configured for host port allocation:
# - Web Frontend: 3015
# - API Backend:  3016 (Internal 5050)
# - MySQL DB:     3311 (Internal 3306)
# ========================================================

set -e

echo "🚀 Preparing AttendPro Docker deployment..."

# 1. Build and start all containers in detached mode
echo "📦 Building and starting containers with docker compose..."
docker compose up -d --build

# 2. Wait for database and backend readiness
echo "⏳ Waiting for MySQL to become healthy..."
until [ "$(docker inspect -f {{.State.Health.Status}} attendpro-db-1 2>/dev/null)" == "healthy" ]; do
    sleep 2
    echo -n "."
done
echo ""
echo "✅ MySQL is ready and initialized."

# 3. Display running containers
echo "📋 Active AttendPro Containers:"
docker ps --filter "name=attendpro"

echo ""
echo "========================================================"
echo "🎉 AttendPro ERP is now successfully running in Docker!"
echo "========================================================"
echo "🌐 Web Application: http://localhost:3015"
echo "🔌 Backend REST API: http://localhost:3016/api"
echo "🗄️ MySQL Database:   localhost:3311 (DB: attendance_db)"
echo ""
echo "Default Administrator Login:"
echo "   Username: admin"
echo "   Password: admin123"
echo "========================================================"

