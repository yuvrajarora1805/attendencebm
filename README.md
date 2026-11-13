# AttendPro — Complete Salary, Attendance & Data Control System

> **Full-stack employee management system** built with React + TypeScript (frontend), Node.js + Express (backend), and MySQL (database). Supports role-based access, security-guard attendance punching, salary processing, data archiving, backup/restore, and a complete audit trail.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Technology Stack](#2-technology-stack)
3. [Project Structure](#3-project-structure)
4. [Database Schema](#4-database-schema)
5. [How the System Works — Data Flow](#5-how-the-system-works--data-flow)
6. [All Pages & Interfaces](#6-all-pages--interfaces)
7. [API Reference](#7-api-reference)
8. [Role Permissions Matrix](#8-role-permissions-matrix)
9. [Salary Calculation Engine](#9-salary-calculation-engine)
10. [Data Control Center — 5-Step Protected Delete](#10-data-control-center--5-step-protected-delete)
11. [Backup & Restore System](#11-backup--restore-system)
12. [Security Architecture](#12-security-architecture)
13. [Build Status — What's Done vs Remaining](#13-build-status--whats-done-vs-remaining)
14. [Setup & Installation](#14-setup--installation)
15. [VPS Deployment with Nginx (Subdomains)](#15-vps-deployment-with-nginx-subdomains)
16. [Environment Variables](#16-environment-variables)
17. [Default Credentials](#17-default-credentials)

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Your VPS / Local Machine                    │
│                                                                     │
│   ┌─────────────────────┐       ┌──────────────────────────────┐   │
│   │  Main App (Port 5173)│       │  Guard Punch (Port 5174)     │   │
│   │  attendance.domain  │       │  punch.domain.com            │   │
│   │                     │       │                              │   │
│   │  Admin / HR /        │       │  Security Guard ONLY         │   │
│   │  Payroll / Viewer    │       │  Enter EMP Code → Punch In/  │   │
│   │  Full sidebar        │       │  Out. No other access.       │   │
│   └────────┬────────────┘       └──────────┬───────────────────┘   │
│            │                               │                        │
│            └──────────────┬────────────────┘                        │
│                           ▼                                         │
│              ┌────────────────────────┐                             │
│              │  Express API (Port 5000)│                             │
│              │  Node.js + TypeScript   │                             │
│              │                        │                             │
│              │  /api/auth             │                             │
│              │  /api/employees        │                             │
│              │  /api/attendance       │  ← rate-limited (30/min)   │
│              │  /api/salary           │                             │
│              │  /api/data-control     │  ← admin-only              │
│              │  /api/dashboard        │                             │
│              │  /api/users            │  ← admin-only              │
│              └────────────┬───────────┘                             │
│                           ▼                                         │
│              ┌────────────────────────┐                             │
│              │     MySQL Database      │                             │
│              │     attendance_db       │                             │
│              │   13 tables, all FK-    │                             │
│              │   linked, audit logged  │                             │
│              └────────────────────────┘                             │
│                                                                     │
│              ┌────────────────────────┐                             │
│              │   /backups/ directory  │                             │
│              │   ZIP archives + SHA-  │                             │
│              │   256 checksums        │                             │
│              └────────────────────────┘                             │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend** | React 18 + TypeScript + Vite | Main app UI |
| **Guard UI** | React 18 + TypeScript + Vite | Separate locked-down punch screen |
| **Styling** | Vanilla CSS (Dark Glassmorphism) | No framework dependency |
| **API Client** | Axios | HTTP requests + JWT auto-attach |
| **Backend** | Node.js + Express + TypeScript | REST API server |
| **Database** | MySQL 8+ via `mysql2/promise` | Primary data store |
| **Auth** | JWT (`jsonwebtoken`) + `bcryptjs` | Stateless authentication |
| **Security** | `helmet` + `express-rate-limit` + CORS | HTTP hardening |
| **Archives** | `archiver` (ZIP) + `crypto` SHA-256 | Backup creation & verification |
| **Reports** | `xlsx` + `jspdf` + `html2canvas` | Excel & PDF export |
| **Charts** | `recharts` | Dashboard visualizations |
| **Icons** | `lucide-react` | UI icons |
| **Fonts** | Outfit + Plus Jakarta Sans (Google) | Typography |

---

## 3. Project Structure

```
attendance/
│
├── package.json                  ← Root: runs both server + client together
│
├── server/                       ← Express + MySQL backend
│   ├── package.json
│   ├── tsconfig.json
│   ├── .env.example              ← Copy to .env and fill in
│   └── src/
│       ├── index.ts              ← Main server entry point
│       │
│       ├── db/
│       │   ├── connection.ts     ← MySQL connection pool
│       │   ├── schema.sql        ← Full database schema + seed data
│       │   └── init.ts           ← Run once: npm run db:init
│       │
│       ├── middleware/
│       │   └── auth.ts           ← JWT authentication + role guards
│       │
│       ├── routes/
│       │   ├── auth.ts           ← Login, logout, change password
│       │   ├── employees.ts      ← Employee CRUD + stats
│       │   ├── attendance.ts     ← Punch in/out, monthly summary, corrections
│       │   ├── salary.ts         ← Periods, generation, entries, finalize
│       │   ├── advances.ts       ← Advance transactions         [TODO]
│       │   ├── dataControl.ts    ← Archive, delete, restore, audit logs
│       │   ├── dashboard.ts      ← Stats, alerts, recent activity
│       │   ├── backup.ts         ← Full DB snapshots            [TODO]
│       │   ├── reports.ts        ← Excel / PDF export           [TODO]
│       │   └── users.ts          ← User management (admin only)
│       │
│       └── utils/
│           └── auditLogger.ts    ← Writes every action to audit_logs table
│
├── client/                       ← React + Vite main application
│   ├── package.json
│   ├── vite.config.ts
│   ├── index.html
│   └── src/
│       ├── main.tsx
│       ├── App.tsx               ← Router + layout               [TODO]
│       ├── index.css             ← Complete design system (done)
│       │
│       ├── api/
│       │   └── client.ts         ← Axios instance with JWT
│       │
│       ├── context/
│       │   └── AuthContext.tsx   ← User state, login/logout, hasRole()
│       │
│       ├── pages/
│       │   ├── LoginPage.tsx     ← Login screen (done)
│       │   ├── GuardPunchPage.tsx← Guard punch screen (done)
│       │   ├── DashboardPage.tsx ← Overview stats + alerts       [TODO]
│       │   ├── EmployeesPage.tsx ← Employee list + CRUD          [TODO]
│       │   ├── AttendancePage.tsx← Monthly attendance management [TODO]
│       │   ├── SalaryPage.tsx    ← Monthly salary processing     [TODO]
│       │   ├── ReportsPage.tsx   ← Export salary/attendance      [TODO]
│       │   ├── DataControlPage.tsx← 5-step archive/delete/restore[TODO]
│       │   ├── BackupPage.tsx    ← DB snapshots + archives       [TODO]
│       │   ├── AuditPage.tsx     ← Full audit log viewer         [TODO]
│       │   └── UsersPage.tsx     ← User + role management        [TODO]
│       │
│       └── components/
│           ├── Sidebar.tsx       ← Navigation sidebar            [TODO]
│           ├── Topbar.tsx        ← Page header + user menu       [TODO]
│           ├── StatCard.tsx      ← Metric card                   [TODO]
│           ├── DataTable.tsx     ← Searchable table              [TODO]
│           ├── ConfirmDialog.tsx ← Dangerous-action modal        [TODO]
│           ├── DateRangePicker.tsx← Date filter                  [TODO]
│           ├── SalarySlipPDF.tsx ← Printable payslip             [TODO]
│           └── EmployeeModal.tsx ← Add/edit employee form        [TODO]
│
└── README.md                     ← This file
```

---

## 4. Database Schema

### Tables at a Glance

| Table | Rows Represent | Key Columns |
|---|---|---|
| `users` | Login accounts | username, password_hash, role |
| `departments` | Department list | name |
| `employees` | Employee profiles | emp_code, name, basic_salary, salary_per_day, status |
| `work_schedules` | Shift timings | work_start, work_end, late_threshold_minutes |
| `attendance_records` | Daily punch records | emp_id, date, punch_in, punch_out, status, is_late, overtime_hours |
| `leave_records` | Leave applications | emp_id, leave_type, from_date, to_date, status |
| `salary_periods` | Month/year pay cycle | month, year, status (draft/finalized/paid), is_locked |
| `salary_entries` | One row per employee per month | all 15 salary columns + snapshot_json |
| `advance_transactions` | Advance given / deducted | emp_id, type, amount, date |
| `data_archives` | ZIP archive metadata | module, date_from, date_to, checksum, status |
| `backup_snapshots` | Full DB backup records | file_path, checksum, verified |
| `audit_logs` | Every action ever taken | user_id, action, module, record_id, reason, timestamp |
| `system_settings` | App-wide config | setting_key, setting_value |

### Important Design Rules

- `salary_entries.snapshot_json` stores a JSON copy of all inputs **at the time of calculation** so changing an employee's current salary never rewrites past months.
- `attendance_records` has a **UNIQUE(emp_id, date)** key — one record per employee per day.
- `salary_periods.is_locked = 1` means the period is finalized; edits require admin override.
- `data_archives.checksum` (SHA-256) is re-verified **before every delete and before every restore**.
- `audit_logs` captures the `reason` text for all destructive operations.

---

## 5. How the System Works — Data Flow

### Daily Attendance Flow

```
Guard / HR enters EMP code
        ↓
POST /api/attendance/punch { emp_code, action: "in"|"out" }
        ↓
Server: Find employee → check work schedule → detect late/overtime
        ↓
INSERT/UPDATE attendance_records (emp_id, date, punch_in/out, is_late, late_minutes)
        ↓
Today's list refreshes in guard screen (live, every 30s)
```

### Monthly Salary Flow

```
HR opens Salary Processing page → selects month/year
        ↓
POST /api/salary/periods/:id/generate
        ↓
Server reads attendance_records for that month per employee:
  - Count present/absent/late/leave days
  - Fetch advance opening balance (C/F from last month)
  - Fetch advance_transactions for this month
        ↓
INSERT salary_entries (all 15 columns auto-calculated)
        ↓
HR reviews each row, adjusts final_leaves, advance_deduction, incentives
        ↓
POST /api/salary/periods/:id/finalize  (Payroll Approver role required)
        ↓
salary_periods.is_locked = 1 → period frozen
        ↓
Generate PDF payslips / Excel salary sheet
```

### Data Archive & Delete Flow

```
Admin opens Data Control Center
        ↓
Step 1 — Select: module + date range + employee
        ↓
Step 2 — POST /api/data-control/preview → see record counts + affected employees
        ↓
Step 3 — POST /api/data-control/archive → creates ZIP with JSON export + SHA-256 checksum
        ↓
Step 4 — Admin reviews checksum confirmation screen, types "DELETE CONFIRMED" + reason
        ↓
Step 5 — POST /api/data-control/delete-archived → re-verifies checksum → deletes live records
        ↓
audit_logs entry written with archive_ref, reason, operator, timestamp
```

---

## 6. All Pages & Interfaces

### Page 1 — Login Screen ✅ Built
- Username + password form
- Role-based JWT issued (guard gets restricted token)
- Error messages, loading state
- Auto-redirect on 401

---

### Page 2 — Guard Punch Screen ✅ Built
**URL:** `http://localhost:5174` (or `punch.yourdomain.com`)

What the guard sees:
- **Live digital clock** (HH:MM:SS)
- **Large employee code input** (uppercase, barcode-scanner friendly)
- **Punch In / Punch Out toggle**
- Instant result: employee name, time, late warning with minutes, overtime hours
- **Today's live attendance list** (auto-refreshes every 30 seconds)
- Zero access to any other module

---

### Page 3 — Dashboard 🔲 Remaining
**URL:** `/dashboard`

| Section | Data shown |
|---|---|
| Employee Summary | Total, Active, Inactive, Resigned (4 stat cards) |
| Today's Attendance | Present / Absent / Late counts with live pulse |
| Monthly Salary | Total payable, total advances, unpaid amount |
| Department Breakdown | Bar chart — employees per department |
| Alert Bar | Late arrivals, absent count, unprocessed payroll warnings |
| Quick Actions | Punch Attendance, Process Salary, Export Report |
| Recent Activity | Last 10 audit log entries |

**API calls:**
- `GET /api/dashboard/stats`
- `GET /api/dashboard/recent-activity`

---

### Page 4 — Employee Management 🔲 Remaining
**URL:** `/employees`

| Feature | Detail |
|---|---|
| Employee table | Code, Name, Department, Role, Basic Salary, Salary/Day, Status, Joining Date |
| Search + Filter | By name/code, department, status (active/inactive/resigned) |
| Add Employee | Modal form: all fields including emp_code auto-suggest |
| Edit Employee | Same modal pre-filled |
| Deactivate | Changes status → resigned, logged to audit |
| Employee Detail | Click row → see attendance history, advance balance, last salary |
| Department selector | Pulled from `departments` table |

**Who can access:**
- View: Admin, HR, Payroll Operator, Viewer
- Add/Edit: Admin, HR
- Delete/Deactivate: Admin only

**API calls:**
- `GET /api/employees?status=active&search=...`
- `GET /api/employees/:id/stats`
- `POST /api/employees`
- `PUT /api/employees/:id`
- `DELETE /api/employees/:id` (with reason)
- `GET /api/employees/departments/list`

---

### Page 5 — Attendance Management 🔲 Remaining
**URL:** `/attendance`

| Tab | What it shows |
|---|---|
| **Monthly Summary** | Grid — every employee's present/absent/late/leave/OT for selected month |
| **Daily View** | Punch records for a selected date — who's in, who's out, who's absent |
| **Corrections** | List of corrected records with original vs corrected values |
| **Mark Absent** | One-click mark all no-punch employees as absent for a date |

Filters: Month/Year picker, Employee search, Department filter, Status filter

**API calls:**
- `GET /api/attendance/monthly?month=&year=&emp_id=`
- `GET /api/attendance/today`
- `PUT /api/attendance/:id/correct` (HR/Admin + reason required)
- `POST /api/attendance/mark-absent`

---

### Page 6 — Salary Processing 🔲 Remaining
**URL:** `/salary`

This is the core payroll page. Layout: period selector at top, full salary table below.

**Columns in the salary table (all 15):**

| # | Column | Editable | Auto-calculated |
|---|---|---|---|
| 1 | Employee Code | — | from employee |
| 2 | Employee Name | — | from employee |
| 3 | Basic Salary | ✓ | default from employee |
| 4 | Salary Per Day | ✓ | default from employee |
| 5 | Actual Leaves | ✓ | from attendance |
| 6 | Final Leaves | ✓ | HR override |
| 7 | Leaves Amount | — | Final Leaves × Salary/Day |
| 8 | O/P Balance | ✓ | C/F from last month |
| 9 | Advance Given | ✓ | from advance_transactions |
| 10 | Advance Deduction | ✓ | entered by HR |
| 11 | Advance C/F | — | OP + Given − Deduction |
| 12 | Net Salary | — | Basic − Leaves Amt − Other Deduction + Incentives |
| 13 | Other Deduction | ✓ | entered by HR |
| 14 | Other Incentives | ✓ | entered by HR |
| 15 | Gross Amount | — | Net Salary − Advance Deduction |
| 16 | D.O.P. | ✓ | Date of Payment |
| 17 | Remarks | ✓ | free text |

**Action buttons:**
- **Generate Salaries** — auto-fills from attendance + last month's advance C/F
- **Save Entry** — inline save per row
- **Finalize Period** — locks the period (Payroll Approver role)
- **Print Salary Sheet** — full sheet PDF
- **Print Payslip** — individual payslip PDF per employee
- **Export Excel** — full salary sheet `.xlsx`
- **Mark as Paid** — per employee or bulk

**API calls:**
- `GET /api/salary/periods`
- `POST /api/salary/periods` (create period)
- `POST /api/salary/periods/:id/generate`
- `GET /api/salary/periods/:id/entries`
- `PUT /api/salary/entries/:id`
- `POST /api/salary/periods/:id/finalize`

---

### Page 7 — Reports & Exports 🔲 Remaining
**URL:** `/reports`

| Report | Format | Description |
|---|---|---|
| Salary Sheet | Excel + PDF | All employees, selected month, all 15 columns |
| Salary Slip | PDF | Individual payslip, printable A4 format |
| Attendance Report | Excel + PDF | Present/absent/late per employee per month |
| Advance Ledger | Excel | All advances and deductions per employee |
| Department Summary | PDF | Headcount, total salary per department |
| Audit Report | Excel | All actions in a date range |

Filters: Month/Year, Employee, Department, Date Range

**API calls (to be built):**
- `GET /api/reports/salary-sheet?period_id=&format=xlsx`
- `GET /api/reports/salary-slip/:emp_id?period_id=`
- `GET /api/reports/attendance?month=&year=&format=pdf`

---

### Page 8 — Data Control Center 🔲 Remaining
**URL:** `/data-control`

This page runs the **5-step protected workflow** for archiving and deleting records.

```
┌─────────────────────────────────────────────────────────────┐
│  STEP 1 — SELECT RECORDS                                    │
│  Module: [Attendance ▼]  Employee: [All ▼]                 │
│  Date From: [──────]  Date To: [──────]                    │
│  Status: [Active ▼]                                         │
│                              [ Preview Records → ]          │
├─────────────────────────────────────────────────────────────┤
│  STEP 2 — PREVIEW IMPACT                                    │
│  Attendance records: 1,247    Salary entries: 0             │
│  Affected employees: 23       Payroll periods: Jan–Dec 2024 │
│                              [ Create Archive → ]           │
├─────────────────────────────────────────────────────────────┤
│  STEP 3 — ARCHIVE CREATED                                   │
│  File: archive_attendance_2024-01-01_2024-12-31_a3b4c5.zip  │
│  Size: 2.4 MB    Records: 1,247                             │
│  SHA-256: 9a3f8b2c...                ✅ Verified            │
│                              [ Proceed to Delete → ]        │
├─────────────────────────────────────────────────────────────┤
│  STEP 4 — CONFIRM DELETION                                  │
│  ⚠️  You are about to delete 1,247 attendance records.      │
│  This action cannot be undone without the archive file.     │
│  Type "DELETE CONFIRMED" to proceed:  [──────────────────]  │
│  Reason: [──────────────────────────────────────────────]   │
│                              [ ❌ Delete Records ]          │
├─────────────────────────────────────────────────────────────┤
│  STEP 5 — COMPLETE                                          │
│  ✅ 1,247 records removed from active data.                 │
│  Archive retained at: /backups/archive_....zip              │
│  Audit entry written at: 19 Oct 2026 12:45 by admin        │
└─────────────────────────────────────────────────────────────┘
```

**Archive Browser Tab** — lists all past archives:

| Column | Detail |
|---|---|
| Archive Name | File identifier |
| Module | attendance / salary / all |
| Date Coverage | From → To |
| Records | Count |
| Size | MB |
| Checksum | SHA-256 (truncated) |
| Status | ready / deleted / restored |
| Actions | View · Restore · Delete Archive File |

**Restore Flow:**
- Select archive → verify checksum → preview conflicts → restore with reason

**API calls:**
- `POST /api/data-control/preview`
- `POST /api/data-control/archive`
- `POST /api/data-control/delete-archived`
- `POST /api/data-control/restore`
- `GET /api/data-control/archives`
- `GET /api/data-control/audit-logs`

---

### Page 9 — Backup & Restore 🔲 Remaining
**URL:** `/backup`

Two sections:

**A. Full Database Snapshots**

```
[ 📦 Create Full Backup Now ]

Backup Name          Date           Size     Status     Action
──────────────────────────────────────────────────────────────
backup_2026-10-19    19 Oct 2026    18 MB    ✅ Verified  Restore / Download
backup_2026-10-01     1 Oct 2026    17 MB    ✅ Verified  Restore / Download
backup_2026-09-01     1 Sep 2026    15 MB    ✅ Verified  Restore / Download
```

Full backup uses `mysqldump` (spawned as child process) → compressed → checksum stored in `backup_snapshots`.

**B. Selective Archive Browser** — same as Data Control but read-only view for browsing and restoring specific periods.

**Restore Safeguards:**
- Checksum verified before restore begins
- Conflict report shows which records are newer than the backup
- User chooses: Skip conflicts / Overwrite conflicts
- Full audit log entry on restore

**API calls (to be built):**
- `POST /api/backup/create-snapshot`
- `GET /api/backup/snapshots`
- `POST /api/backup/restore-snapshot`
- `GET /api/backup/verify/:id`

---

### Page 10 — Audit Log Viewer 🔲 Remaining
**URL:** `/audit`

Full searchable table of every action ever taken:

| Column | Detail |
|---|---|
| Timestamp | Exact datetime |
| User | Who did it |
| Action | create / edit / delete / archive / restore / login / finalize |
| Module | attendance / salary / employees / auth |
| Record | Which record was affected |
| Reason | Required text for destructive actions |
| Status | success / failed |
| IP Address | For VPS deployments |

Filters: Date range, User, Action type, Module, Status

Export: Excel download of filtered audit logs

---

### Page 11 — Security & Users 🔲 Remaining
**URL:** `/users`

Admin-only page for managing system users:

| Feature | Detail |
|---|---|
| User list | Username, Full Name, Role, Last Login, Active status |
| Create User | Username, full name, role, initial password |
| Edit User | Change role, activate/deactivate, reset password |
| Role selector | admin / hr / payroll_operator / payroll_approver / viewer / security_guard |
| Password rules | Min 6 chars enforced, bcrypt hash stored |

---

## 7. API Reference

### Authentication

| Method | Endpoint | Auth | Body | Description |
|---|---|---|---|---|
| POST | `/api/auth/login` | None | `{username, password}` | Get JWT token |
| POST | `/api/auth/change-password` | None | `{username, old_password, new_password}` | Change password |

### Employees

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/employees` | Any | List employees (filter: status, department_id, search) |
| GET | `/api/employees/:id` | Any | Single employee |
| GET | `/api/employees/:id/stats` | Any | Attendance stats + advance balance + last salary |
| POST | `/api/employees` | Admin/HR | Create employee |
| PUT | `/api/employees/:id` | Admin/HR | Update employee |
| DELETE | `/api/employees/:id` | Admin | Deactivate (with reason) |
| GET | `/api/employees/departments/list` | Any | All departments |

### Attendance

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/attendance/punch` | Admin/HR/Guard | Punch in or out |
| GET | `/api/attendance/today` | Any | Today's full list + summary |
| GET | `/api/attendance/monthly` | Any | Monthly summary per employee |
| GET | `/api/attendance/employee/:id` | Any | Employee's records for a period |
| PUT | `/api/attendance/:id/correct` | Admin/HR | Correct with reason |
| POST | `/api/attendance/mark-absent` | Admin/HR | Mark all no-punch as absent |

### Salary

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/salary/periods` | Any | All salary periods |
| POST | `/api/salary/periods` | Admin/Payroll Op | Create period |
| GET | `/api/salary/periods/:id/entries` | Any | Entries for period (filter: search, paid) |
| POST | `/api/salary/periods/:id/generate` | Admin/Payroll Op | Auto-generate from attendance |
| PUT | `/api/salary/entries/:id` | Admin/Payroll Op | Update single entry |
| POST | `/api/salary/periods/:id/finalize` | Admin/Payroll Approver | Lock period |
| GET | `/api/salary/dashboard-stats` | Any | Current month totals |

### Data Control

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/data-control/preview` | Admin | Preview record counts |
| POST | `/api/data-control/archive` | Admin | Create ZIP archive |
| POST | `/api/data-control/delete-archived` | Admin | Delete after checksum verify |
| POST | `/api/data-control/restore` | Admin | Restore from archive |
| GET | `/api/data-control/archives` | Admin | List all archives |
| GET | `/api/data-control/audit-logs` | Admin/Viewer | Full audit log |

### Dashboard

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/dashboard/stats` | Any | Employees, attendance, salary summary |
| GET | `/api/dashboard/recent-activity` | Any | Last 10 audit entries |

### Reports *(to be built)*

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/reports/salary-sheet` | Any | Excel/PDF salary sheet |
| GET | `/api/reports/salary-slip/:emp_id` | Any | PDF payslip |
| GET | `/api/reports/attendance` | Any | Excel/PDF attendance report |
| GET | `/api/reports/advance-ledger` | Any | Excel advance ledger |

### Backup *(to be built)*

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/backup/create-snapshot` | Admin | Run mysqldump + compress |
| GET | `/api/backup/snapshots` | Admin | List all snapshots |
| POST | `/api/backup/restore-snapshot` | Admin | Restore a snapshot |
| GET | `/api/backup/verify/:id` | Admin | Re-verify checksum |

---

## 8. Role Permissions Matrix

| Action | Admin | HR | Payroll Op | Payroll Approver | Viewer | Guard |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| Login | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| View Dashboard | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| Punch Attendance | ✅ | ✅ | — | — | — | ✅ |
| Correct Attendance | ✅ | ✅ | — | — | — | — |
| Mark Absent | ✅ | ✅ | — | — | — | — |
| View Employees | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| Add / Edit Employees | ✅ | ✅ | — | — | — | — |
| Deactivate Employees | ✅ | — | — | — | — | — |
| View Attendance | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| Process Salary | ✅ | — | ✅ | — | — | — |
| Edit Salary Entries | ✅ | — | ✅ | — | — | — |
| Finalize / Lock Period | ✅ | — | — | ✅ | — | — |
| Generate Reports | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| Archive Records | ✅ | — | — | — | — | — |
| Delete After Archive | ✅ | — | — | — | — | — |
| Restore Archives | ✅ | — | — | — | — | — |
| Create Backups | ✅ | — | — | — | — | — |
| Restore Backups | ✅ | — | — | — | — | — |
| View Audit Logs | ✅ | — | — | — | ✅ | — |
| Manage Users | ✅ | — | — | — | — | — |

---

## 9. Salary Calculation Engine

Every time a salary entry is saved or auto-generated, these formulas run:

```
Leaves Amount     = Final Leaves × Salary Per Day

Advance C/F       = O/P Balance + Advance Given − Advance Deduction

Net Salary        = Basic Salary
                  − Leaves Amount
                  − Other Deduction
                  + Other Incentives

Gross Amount      = Net Salary − Advance Deduction
```

**Notes:**
- `salary_entries.snapshot_json` stores a complete JSON copy of all inputs at calculation time. If you later change the employee's `basic_salary`, old entries are **never rewritten**.
- The formulas live in `server/src/routes/salary.ts` inside the `calculateSalary()` function — easy to adjust without touching the database.
- Finalized periods (`is_locked = 1`) block edits for Payroll Operators. Admin can still edit with audit logging.

---

## 10. Data Control Center — 5-Step Protected Delete

```
Step 1 ─ SELECT
         Choose: module / employee / date_from / date_to / status
         ↓
Step 2 ─ PREVIEW
         Server returns: record counts per module, affected employees list
         Nothing is changed yet.
         ↓
Step 3 ─ ARCHIVE
         Server creates ZIP: JSON export of all matching records
         SHA-256 checksum computed and stored in data_archives table
         File saved to /backups/ directory
         ↓
Step 4 ─ CONFIRM
         UI requires typing "DELETE CONFIRMED" exactly
         User must enter a reason (stored in audit_logs)
         ↓
Step 5 ─ DELETE
         Server re-reads archive file
         Re-computes SHA-256 → must match stored checksum
         If mismatch → DELETE BLOCKED (archive may be corrupted)
         If match → live records deleted from database
         audit_logs entry written with archive_ref
```

**Safeguards that cannot be bypassed:**
- No delete without a verified archive on disk
- Finalized salary periods need admin role even for admin-level users
- Restoring detects duplicates: newer record in DB → skip (not overwrite)
- All 5 steps are logged individually in `audit_logs`

---

## 11. Complete Backup & External Drive Storage Architecture

### The Client vs. Server Hosting Reality
When AttendPro is hosted on a VPS/cloud server, the server is remote. Physical USB flash drives and external hard drives are plugged into the **user's computer / laptop**, not the remote data center server.

Therefore, the backup system is designed with a **Hybrid Two-Tier Architecture**:

```
┌────────────────────────────────────────────────────────────────────────┐
│                   CLIENT BROWSER (Your PC / Laptop)                    │
│                                                                        │
│   [Attached USB Drive / External HDD] (E:\, /media/yuvraj/USB, etc.)   │
│                 ▲                                                      │
│                 │ (Native Browser File System Access API)              │
│                 ▼                                                      │
│   ┌──────────────────────────────────────────────────────────────┐     │
│   │ Client USB Drive Manager (ConnectedDevices.tsx)             │     │
│   │ • 1-Click: "Select USB Drive / Folder" (Native OS dialog)   │     │
│   │ • Save backup file directly onto attached USB drive         │     │
│   │ • Read and display existing backups stored on USB drive     │     │
│   │ • 1-Click Restore: send backup from USB directly to website │     │
│   └──────────────────────────────┬───────────────────────────────┘     │
└──────────────────────────────────┼─────────────────────────────────────┘
                                   │ HTTPS / REST API
┌──────────────────────────────────▼─────────────────────────────────────┐
│                 REMOTE SERVER / VPS (attendance_db)                    │
│                                                                        │
│   • /api/backup/create     → Full snapshot of all 10 tables + SHA-256  │
│   • /api/backup/restore/:id→ Re-verifies hash + restores database      │
│   • /api/backup/upload     → Receives external backup from USB drive   │
│   • /api/backup/download   → Direct file download                      │
│   • Local server disk      → /backups/ directory mirror                │
└────────────────────────────────────────────────────────────────────────┘
```

### Features
1. **Client-side USB Drive Selection**:
   - Uses the browser's `showDirectoryPicker()` API to allow the user to choose their external hard drive or USB thumb drive.
   - Once selected, the browser directly writes complete backups to the USB drive and reads existing backups from it.
2. **Server-side Automatic Snapshot Mirror**:
   - Generates full JSON snapshots of all 10 database tables with SHA-256 integrity verification.
3. **Disaster Recovery**:
   - Re-installing on a new PC or cloud server? Plug in your USB drive, click "Select USB Drive", and click "Restore". All data, employees, and salaries are instantly recovered.

---

## 12. Security Architecture

| Layer | Mechanism |
|---|---|
| **Transport** | HTTPS via Let's Encrypt (Nginx, VPS deployment) |
| **Authentication** | JWT signed with `JWT_SECRET`. Guard tokens use a separate `JWT_GUARD_SECRET` |
| **Token scope** | Guard JWT only authorizes `POST /api/attendance/punch` |
| **Password hashing** | `bcryptjs` with salt rounds = 10 |
| **Rate limiting** | Auth: 20 req/15min · Punch: 30 req/min · General: 500 req/15min |
| **HTTP headers** | `helmet` sets CSP, HSTS, X-Frame-Options, etc. |
| **CORS** | Explicit whitelist of frontend origins only |
| **Audit trail** | Every action writes to `audit_logs` with user, IP, reason, timestamp |
| **Period locking** | `salary_periods.is_locked` blocks edits at DB query level |
| **Delete protection** | SHA-256 checksum verified twice (on archive + on delete) |

---

## 13. Build Status — What's Done vs Remaining

### ✅ Completed

| File | What it does |
|---|---|
| `server/src/db/schema.sql` | Full MySQL schema — 13 tables, indexes, FK constraints, seed data |
| `server/src/db/connection.ts` | MySQL connection pool |
| `server/src/db/init.ts` | One-time DB initializer script |
| `server/src/middleware/auth.ts` | JWT auth + role guards + guard-specific middleware |
| `server/src/utils/auditLogger.ts` | Writes to audit_logs table |
| `server/src/routes/auth.ts` | Login, change-password |
| `server/src/routes/employees.ts` | Full CRUD + stats + department list |
| `server/src/routes/attendance.ts` | Punch in/out + late detection + monthly summary + corrections |
| `server/src/routes/salary.ts` | Periods, auto-generation, 15-column entries, finalize/lock |
| `server/src/routes/dataControl.ts` | 5-step archive/delete/restore + audit log viewer |
| `server/src/routes/dashboard.ts` | Stats, alerts, recent activity |
| `server/src/routes/users.ts` | User CRUD (admin only) |
| `server/src/index.ts` | Express server with all routes + security middleware |
| `client/src/index.css` | Complete dark glassmorphism design system |
| `client/src/api/client.ts` | Axios instance with JWT auto-attach |
| `client/src/context/AuthContext.tsx` | Auth state + login/logout + hasRole() |
| `client/src/pages/LoginPage.tsx` | Login screen |
| `client/src/pages/GuardPunchPage.tsx` | Guard punch screen with live clock + today's list |

---

| `server/src/routes/advances.ts` | CRUD for advance_transactions (given & deduction) |
| `server/src/routes/reports.ts` | Excel (xlsx) exports + payslip data endpoints |
| `server/src/routes/backup.ts` | Full DB snapshots + SHA-256 verification + downloads |
| `client/package.json` | React 18, Vite, Lucide, Recharts, jsPDF, Axios |
| `client/vite.config.ts` | Vite configuration + Express API proxy on port 5000 |
| `client/index.html` | App container with Google fonts & metadata |
| `client/src/main.tsx` | App bootstrap with AuthProvider wrapper |
| `client/src/App.tsx` | Router + role-based ProtectedRoute layout |
| `client/src/components/Sidebar.tsx` | Role-filtered glassmorphic sidebar |
| `client/src/components/Topbar.tsx` | Header bar with role badge & active dates |
| `client/src/components/DataTable.tsx` | Searchable, paginated data grid |
| `client/src/components/ConfirmDialog.tsx` | Fail-safe confirmation modal with reason log |
| `client/src/components/DateRangePicker.tsx` | Quick date preset selector |
| `client/src/components/EmployeeModal.tsx` | Add/Edit employee profile form |
| `client/src/components/SalarySlipPDF.tsx` | Printable payslip view with breakdown |
| `client/src/pages/DashboardPage.tsx` | Overview KPI stat cards + recent audit logs |
| `client/src/pages/EmployeesPage.tsx` | Workforce management with CRUD & search |
| `client/src/pages/AttendancePage.tsx` | Monthly attendance grid + supervisor corrections |
| `client/src/pages/SalaryTable.tsx` | 15-column live calculation table with inputs |
| `client/src/pages/SalaryPage.tsx` | Salary cycle engine with period locking |
| `client/src/pages/ReportsPage.tsx` | Instant Excel downloads for payroll & audit |
| `client/src/pages/DataControlPage.tsx` | 5-step protected archive & delete wizard |
| `client/src/pages/BackupPage.tsx` | Full database snapshots & hash verification |
| `client/src/pages/AuditPage.tsx` | Complete searchable system audit trail |
| `client/src/pages/UsersPage.tsx` | User role provisioning & access control |
| `server/.env` | Environment configuration for MySQL & JWT |

---

### 📏 File Size Compliance (All Files Under 200–250 lines)

Every single source file in both the server and client codebase adheres strictly to the maximum 200–250 lines constraint for maintainability:
- All pages and components split modularly (e.g. `SalaryPage.tsx` & `SalaryTable.tsx`, `EmployeeModal.tsx`, `ConfirmDialog.tsx`)
- Zero oversized monolith files.

---

### 🔲 Next Operational Steps (Deployment & Running)

1. **Database initialization**: Ensure MySQL is running and execute:
   ```bash
   cd server && npm run db:init
   ```
2. **Install all packages**:
   ```bash
   npm run install:all
   ```
3. **Launch servers**:
   ```bash
   npm run dev
   ```

---

## 14. Setup & Installation

### Prerequisites

- Node.js 18+ and npm
- MySQL 8+ running locally
- Git

### Step 1 — Clone & install

```bash
git clone <your-repo-url> attendance
cd attendance
npm install
cd server && npm install
cd ../client && npm install
cd ..
```

### Step 2 — Configure environment

```bash
cd server
cp .env.example .env
# Edit .env with your MySQL credentials
nano .env
```

### Step 3 — Create the database

```bash
# Make sure MySQL is running, then:
cd server
npm run db:init
```

This runs `src/db/init.ts` which reads `schema.sql` and creates all tables + seed data.

### Step 4 — Start development

```bash
# From project root — runs both server (port 5000) and client (port 5173)
npm run dev
```

Or separately:
```bash
npm run dev:server    # Express on port 5000
npm run dev:client    # Vite on port 5173
```

### Step 5 — Login

Open `http://localhost:5173` → login with `admin` / `admin123`

> ⚠️ **Change the default password immediately after first login!**

---

## 15. VPS Deployment with Nginx (Subdomains)

Once the app is ready for production, configure Nginx to serve two subdomains:

### Nginx configuration

```nginx
# Main application — attendance.yourdomain.com
server {
    listen 443 ssl http2;
    server_name attendance.yourdomain.com;

    ssl_certificate     /etc/letsencrypt/live/attendance.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/attendance.yourdomain.com/privkey.pem;

    # Serve built React app
    root /var/www/attendance/client/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy API calls to Express
    location /api {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Guard punch screen — punch.yourdomain.com
server {
    listen 443 ssl http2;
    server_name punch.yourdomain.com;

    ssl_certificate     /etc/letsencrypt/live/punch.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/punch.yourdomain.com/privkey.pem;

    # Serve built Guard React app
    root /var/www/attendance/guard/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy API — guard can only hit /api/attendance/punch and /api/auth/login
    location /api/auth/login {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /api/attendance {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Block all other API routes from guard subdomain
    location /api {
        return 403;
    }
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name attendance.yourdomain.com punch.yourdomain.com;
    return 301 https://$host$request_uri;
}
```

### Get SSL certificates (free)

```bash
sudo certbot --nginx -d attendance.yourdomain.com -d punch.yourdomain.com
```

### Production build

```bash
cd client && npm run build        # outputs to client/dist/
cd ../guard && npm run build      # outputs to guard/dist/    [guard app, TBD]
```

### Run server with PM2

```bash
npm install -g pm2
cd server
npm run build
pm2 start dist/index.js --name "attendance-server"
pm2 save
pm2 startup
```

---

## 16. Environment Variables

**`server/.env`**

```env
# Server
PORT=5000

# MySQL
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password_here
DB_NAME=attendance_db

# JWT
JWT_SECRET=change_this_to_a_long_random_string_minimum_32_chars
JWT_GUARD_SECRET=different_secret_for_guard_tokens
JWT_EXPIRES_IN=8h
JWT_GUARD_EXPIRES_IN=12h

# Backup storage
BACKUP_DIR=./backups

# CORS — frontend origins
FRONTEND_URL=http://localhost:5173
GUARD_FRONTEND_URL=http://localhost:5174

# Production example:
# FRONTEND_URL=https://attendance.yourdomain.com
# GUARD_FRONTEND_URL=https://punch.yourdomain.com

NODE_ENV=development
```

**`client/.env`**

```env
VITE_API_URL=http://localhost:5000/api
```

**`guard/.env`**

```env
VITE_API_URL=http://localhost:5000/api
```

---

## 17. Default Credentials

| Role | Username | Password | Access |
|---|---|---|---|
| Administrator | `admin` | `admin123` | Full system access |
| Shift Manager | `manager` | `manager123` | Section Attendance, Shift Punches & Employee Enrollment |
| Security Guard | `guard` | `admin123` | Punch terminal screen only |

> 🔴 **Change these immediately after first login via the Users page or `/api/auth/change-password`**

---

## 18. Contribution Guidelines

Please follow the instructions below to make a contribution:

- **Adding to the list**: Please add content to `README.md` and ensure the edited list remains in **alphabetical order**. Submit a pull request.
- **Removing from the list**: If you encounter issues accessing any listed resource, let us know via an issue or pull request.

### Contributors
- [IamHDT](https://github.com/IamHDT)

---

*AttendPro v1.0.0 — Built with React + Node.js + MySQL*
