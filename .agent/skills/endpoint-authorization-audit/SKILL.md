---
name: endpoint-authorization-audit
description: Comprehensive checklist and guidelines to audit AttendPro REST API endpoints for session authentication, token verification, role-based authorization (RBAC), data masking, and sensitive operation protection.
---

# 🛡️ AttendPro Endpoint Authorization & Security Audit Guide

This skill provides an exhaustive checklist, testing procedures, and remediation guidelines to ensure every API endpoint in AttendPro ERP is protected against unauthorized access, session token bypassing, privilege escalation, and sensitive data leakage.

---

## 📋 1. Endpoint Authorization Checklist

### A. Authentication & Session Validation
- [ ] **Bearer Token Required**: Does every non-public endpoint enforce `authenticate` middleware?
- [ ] **Valid Header Format**: Rejects requests lacking `Authorization: Bearer <token>` with `401 Unauthorized`.
- [ ] **Active Account Check**: Tokens are verified against `is_active = 1` in the database to prevent deactivated/former staff from utilizing lingering JWTs.
- [ ] **Credential Modifications**: Endpoints modifying credentials (e.g. `/api/auth/change-password`) **MUST** require `authenticate` and only allow users to change their own password (unless caller is `admin`).

### B. Role-Based Access Control (RBAC)
- [ ] **State-Changing Operations (`POST`, `PUT`, `PATCH`, `DELETE`)**:
  - Must explicitly declare `authorizeRoles(...)`.
  - Roles must follow strict organizational hierarchy:
    - `admin`: Full administrative control across all tables and settings.
    - `hr` / `payroll_operator`: Staff and payroll operations; strictly no user management or backup access.
    - `manager`: Shift scheduling, shift punch overrides, advance requests, employee status updates. **Strictly NO access to salary sheets, basic salaries, or database backups.**
    - `security_guard` / `guard`: Terminal punch IN/OUT operations only. **Zero access to financial data, salaries, or reporting.**
    - `viewer`: Read-only operational views.
- [ ] **No Implicit Trust**: Never rely solely on frontend menu hiding; the Express router must return `403 Forbidden` if an unauthorized role requests the endpoint.

### C. Financial & Confidential Data Masking (Need-to-Know Principle)
- [ ] **Salary Confidentiality**:
  - `basic_salary`, `salary_per_day`, `initial_basic_salary`, `net_salary`, and `gross_amount` must be masked (`"Confidential"` or `null`) for all non-payroll roles (`manager`, `security_guard`, `viewer`).
  - Whitelist check: ONLY `admin`, `hr`, and `payroll_operator` receive raw numbers.
- [ ] **Dashboard Aggregates**:
  - Company payroll totals (`total_salary`, `total_advances`, `unpaid_salary`) in `/api/dashboard/stats` must be hidden or masked for `manager` and `security_guard`.
  - Pending salary approval employee cards must not leak basic salaries to managers or guards.
- [ ] **Banking Privacy**:
  - `bank_account`, `bank_name`, and `ifsc_code` must be masked or restricted to `admin` and `hr`.

### D. Object-Level Access (BOLA / IDOR Prevention)
- [ ] `GET /api/reports/payslip/:entryId` must require `authorizeRoles('admin', 'hr', 'payroll_operator', 'payroll_approver')`.
- [ ] `GET /api/salary/periods/:id/entries` must require `authorizeRoles('admin', 'hr', 'payroll_operator', 'payroll_approver', 'manager')`, and mask all salary fields when queried by a manager.

### E. Microservices & Satellite Terminals
- [ ] Any secondary port (e.g., Gate Guard Terminal on port `5051` in `guardService.ts`) must require authentication (`authenticateGuard` or terminal token) on `/api/punch` and `/api/today`.

---

## 🔍 2. Audit Scan Commands

```bash
# 1. Find any route lacking authorizeRoles:
grep -rn "router\.\(get\|post\|put\|patch\|delete\)" server/src/routes/ | grep -v "authorizeRoles"

# 2. Check for missing authenticate imports:
grep -rL "authenticate" server/src/routes/

# 3. Verify middleware mount order:
head -n 15 server/src/routes/*.ts
```

---

## 🛠️ 3. Standard Remediation Patterns

### Pattern 1: Protected Route with RBAC
```typescript
router.get(
  '/periods/:id/entries',
  authorizeRoles('admin', 'hr', 'payroll_operator', 'payroll_approver'),
  async (req: Request, res: Response) => { ... }
);
```

### Pattern 2: Whitelisted Financial Masking
```typescript
const canViewSalary = ['admin', 'hr', 'payroll_operator'].includes(req.user?.role || '');

const processedEmployees = employees.map(emp => {
  if (!canViewSalary) {
    return {
      ...emp,
      basic_salary: 'Confidential',
      salary_per_day: 'Confidential',
      bank_account: emp.bank_account ? `****${emp.bank_account.slice(-4)}` : null,
      _is_salary_hidden: true
    };
  }
  return emp;
});
```

### Pattern 3: Authenticated Password Modification
```typescript
router.post('/change-password', authenticate, async (req: Request, res: Response) => {
  const caller = req.user!;
  const { old_password, new_password, username } = req.body;
  
  // Only admin can change passwords for other users
  const targetUsername = (caller.role === 'admin' && username) ? username : caller.username;
  ...
});
```

