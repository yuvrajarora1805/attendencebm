# AttendPro ERP - Dedicated Native Flutter Desktop Application

AttendPro ERP Desktop is a cross-platform Flutter application providing enterprise attendance, shift management, multi-cycle advance tracking, and payroll calculations with full parity to the web version.

---

## 🚀 Key Modules & Capabilities

1. **Authentication & Role-Based Access Control**:
   - Roles: `Admin`, `Manager`, `HR`, `Guard / Security`.
   - Dynamic backend server URL configuration directly from the login dialog (default `http://localhost:5000/api`).

2. **Enterprise Dashboard**:
   - Real-time attendance KPIs (Staff present, absent, on leave).
   - High-priority pending advance request alert banner.
   - Quick action shortcuts and live punch activity feed.

3. **Advance & Loan Ledger Management**:
   - **Individual Advance Disbursement Modal (`+ Disburse Advance`)**:
     - Live 50% earned wage limit rule calculation box (`Worked Days`, `Earned So Far`, `Standard Cap (50%)`, `Outstanding Debt`).
     - Distinct **⚠️ High-Risk Tenure Notice (`< 6M`)** badge for probationary staff.
     - Unconstrained numeric amount input (accepts ₹4,000 or any amount without browser step restrictions).
     - Automated recovery mode selection: **Full Upcoming Cycle** vs. **Fixed Monthly Installments** (`₹/month`).
   - **⚡ Batch Advance Checklist Modal**:
     - Fast multi-employee advance disbursement with real-time 50% earned wage limit caps and tenure warning badges.
   - **Requests & Approvals Workflow**:
     - Single request approval with custom recovery term.
     - Rejection with audit remarks.
     - Bulk approval for checkmarked requests.
   - **Disbursed Transactions Ledger**:
     - Complete historical audit log with debt balances and payment modes.

4. **Monthly Salary & Payroll**:
   - Period selector (`MM/YYYY`).
   - One-click **Calculate / Sync** payroll trigger with auto-recovery of active advance cycles.
   - **Itemized Payslip Dialog**:
     - Employee & Bank details.
     - Earnings vs. Deductions comparison table.
     - Leaves penalty days itemization.
     - Multi-cycle advance recovery itemized split (e.g., `Cycle 1 [Adv #1]: ₹1,000/mo`, `Cycle 2 [Adv #2]: ₹2,500/mo`).
     - Net Payable amount highlight banner and debt carried forward (`Advance C/F`).

5. **Shift Supervisor / Guard Punch Override**:
   - Live analog & digital clock.
   - Quick employee code lookup.
   - `AUTO`, `PUNCH IN`, and `PUNCH OUT` mode selectors.
   - Today's biometric punches ledger.

6. **Employee Directory & Detailed Profile**:
   - Tenure calculations, department filters, probationary `< 6M` indicators.
   - Profile view with active concurrent advance cycles strip and ledger history.

---

## 🛠️ Building & Compiling

### 🪟 Windows Desktop Executable (`attendpro.exe`)
To build the standalone Windows `.exe` on any Windows workstation:
1. Ensure Flutter SDK is installed (`flutter doctor`).
2. Run the provided build script or command:
   ```cmd
   build_windows.bat
   ```
   *Or via command line:*
   ```cmd
   flutter pub get
   flutter build windows --release
   ```
3. The executable will be generated at:
   ```text
   aplication\build\windows\x64\runner\Release\attendpro.exe
   ```

### 🐧 Linux Desktop Application
On Linux:
```bash
flutter pub get
flutter build linux --release
```
The binary will be generated at:
```text
aplication/build/linux/x64/release/bundle/attendpro
```

### 🌐 Running in Development Mode
```bash
# Run on Desktop (Linux / Windows)
flutter run -d linux   # or flutter run -d windows

# Run on Chrome
flutter run -d chrome
```

---

## ⚙️ Backend Connectivity
- Default URL: `http://localhost:5000/api`
- To connect to a remote server or local network IP (e.g. `http://192.168.1.100:5000/api`), click the **Gear Icon (⚙️ Server Settings)** on the Login Screen and enter your server IP. The setting persists across app restarts in secure local storage.
