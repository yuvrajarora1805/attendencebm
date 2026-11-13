# 🐳 AttendPro ERP - Docker Multi-Container Deployment Guide

This guide explains how to build, deploy, and manage AttendPro ERP in Docker on a shared host running multiple existing containerized projects (`salemanager`, `dishdash`, `bklohia`, `verum`, `computercorner`, `excellent_solar`).

---

## 🧭 Host Port Mapping Architecture

Based on your active host containers (`docker ps`), the following ports are mapped to avoid any conflict with existing services:

| Service | Container Name | Host Port | Internal Port | Description |
| :--- | :--- | :--- | :--- | :--- |
| **Web Frontend** | `attendpro-web-1` | **`3015`** | `80` (Nginx) | React 18 SPA + Vite (Next port after 3014) |
| **API Backend** | `attendpro-server-1` | **`3016`** | `5050` (Express) | Express Node.js REST API |
| **Database** | `attendpro-db-1` | **`3311`** | `3306` (MySQL) | MySQL 8.0 (Next port after 3310) |

---

## 🚀 1-Click Deployment Instructions

### Method 1: Using the Deployment Script
From your attendance project root directory, run:
```bash
./deploy_docker.sh
```

### Method 2: Using Standard Docker Compose
```bash
# 1. Build and launch all services in background
docker compose up -d --build

# 2. Check running status
docker compose ps

# 3. View live server logs
docker compose logs -f attendpro-server
```

---

## 🌐 Accessing the Application

* **Web Portal**: [http://localhost:3015](http://localhost:3015) *(or `http://<your-vps-ip>:3015`)*
* **Backend API**: [http://localhost:3016/api](http://localhost:3016/api)
* **API Health Check**: [http://localhost:3015/health](http://localhost:3015/health) *(routed via Nginx)*
* **Database Host Direct Access**: `localhost:3311` *(User: `root`, Password: `attendpro_root_password_2026`)*

### Default Login Credentials
* **Administrator**:
  * **Username**: `admin`
  * **Password**: `admin123`
* **Security Guard**:
  * **Username**: `guard`
  * **Password**: `admin123`

---

## 🛠️ Management & Maintenance Commands

### Restart Services
```bash
docker compose restart
```

### Stop Services
```bash
docker compose down
```

### Update Code & Rebuild
```bash
git pull   # or after editing files
docker compose up -d --build
```

### Import Existing Database Dump
If you want to migrate data from your local XAMPP/MySQL database to the Docker container:
```bash
docker exec -i attendpro-db-1 mysql -u root -pattendpro_root_password_2026 attendance_db < backup.sql
```

### Export Database Dump from Container
```bash
docker exec attendpro-db-1 mysqldump -u root -pattendpro_root_password_2026 attendance_db > attendpro_backup_$(date +%F).sql
```

