import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../services/api_service.dart';
import '../services/auth_provider.dart';
import '../theme/app_theme.dart';
import '../widgets/custom_badge.dart';

class EmployeeProfileScreen extends StatefulWidget {
  final int employeeId;
  const EmployeeProfileScreen({super.key, required this.employeeId});

  @override
  State<EmployeeProfileScreen> createState() => _EmployeeProfileScreenState();
}

class _EmployeeProfileScreenState extends State<EmployeeProfileScreen> {
  final ApiService _api = ApiService();
  bool _loading = true;
  String? _error;

  Map<String, dynamic>? _profile;
  List<dynamic> _advanceHistory = [];
  List<dynamic> _activeCycles = [];
  List<dynamic> _salaryHistory = [];

  @override
  void initState() {
    super.initState();
    _loadProfile();
  }

  Future<void> _loadProfile() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final res = await _api.get('/employees/${widget.employeeId}');
      if (res != null && res['data'] != null) {
        final data = res['data'];
        setState(() {
          _profile = data['employee'] ?? data;
          _advanceHistory = (data['advance_history'] as List<dynamic>?) ?? [];
          _activeCycles = (data['active_cycles'] as List<dynamic>?) ?? [];
          _salaryHistory = (data['salary_history'] as List<dynamic>?) ?? [];
          _loading = false;
        });
      } else {
        throw ApiException('Failed to load profile');
      }
    } catch (e) {
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final isAdmin = auth.isAdmin;

    return Scaffold(
      backgroundColor: AppTheme.bgLight,
      appBar: AppBar(
        title: Text(_profile?['name'] ?? 'Employee Profile'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _loadProfile,
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(child: Text(_error!, style: const TextStyle(color: AppTheme.danger)))
              : SingleChildScrollView(
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Employee Header Card
                      _buildHeaderCard(),
                      const SizedBox(height: 20),

                      // Active Advance Cycles Strip (Multi-Cycle Recovery e.g. 1000/mo, 2500/mo, 2000/mo)
                      if (_activeCycles.isNotEmpty) ...[
                        _buildActiveCyclesCard(),
                        const SizedBox(height: 20),
                      ],

                      // Advance Ledger Table
                      _buildAdvanceHistoryCard(),
                      const SizedBox(height: 20),

                      // Salary Payroll History
                      if (isAdmin) _buildSalaryHistoryCard(),
                    ],
                  ),
                ),
    );
  }

  Widget _buildHeaderCard() {
    final emp = _profile!;
    final isNewJoining = emp['is_new_joining'] == 1 || emp['is_new_joining'] == true;
    final tenureDays = int.tryParse(emp['tenure_days']?.toString() ?? '0') ?? 0;
    final tenureYears = (tenureDays / 365).toStringAsFixed(1);
    final basicSalary = double.tryParse(emp['basic_salary']?.toString() ?? '0') ?? 0.0;
    final perDayRate = double.tryParse(emp['salary_per_day']?.toString() ?? '0') ?? (basicSalary / 30);
    final activeDebt = double.tryParse(emp['current_advance_balance']?.toString() ?? '0') ?? 0.0;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          children: [
            Row(
              children: [
                CircleAvatar(
                  radius: 32,
                  backgroundColor: AppTheme.primaryNavy,
                  child: Text(
                    (emp['name']?.toString() ?? 'E')[0].toUpperCase(),
                    style: const TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.bold),
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Text(
                            emp['name']?.toString() ?? '',
                            style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800),
                          ),
                          const SizedBox(width: 8),
                          Text(
                            '(${emp['emp_code']})',
                            style: const TextStyle(fontSize: 16, color: AppTheme.textSecondary, fontWeight: FontWeight.w600),
                          ),
                          const SizedBox(width: 10),
                          if (isNewJoining) CustomBadge.newJoiner(),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '${emp['department_name'] ?? emp['dept_name'] ?? 'Staff'} • ${emp['job_role'] ?? 'Worker'} • Status: ${(emp['status'] ?? 'active').toString().toUpperCase()}',
                        style: const TextStyle(fontSize: 13, color: AppTheme.textSecondary),
                      ),
                    ],
                  ),
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    const Text('Total Outstanding Debt', style: TextStyle(fontSize: 11, color: AppTheme.textSecondary, fontWeight: FontWeight.bold)),
                    Text(
                      '₹${NumberFormat('#,##0.00').format(activeDebt)}',
                      style: TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.w900,
                        color: activeDebt > 0 ? AppTheme.danger : AppTheme.success,
                      ),
                    ),
                  ],
                ),
              ],
            ),
            const Divider(height: 24),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                _metaCol('Date of Joining', emp['joining_date']?.toString().split('T')[0] ?? '—'),
                _metaCol('Tenure / Service', '$tenureYears Yrs ($tenureDays days)'),
                _metaCol('Monthly Advance Cut', '₹${emp['monthly_advance_deduction'] ?? "0"}/mo'),
                if (context.read<AuthProvider>().isAdmin) ...[
                  _metaCol('Basic Salary', '₹${NumberFormat('#,##0.00').format(basicSalary)}'),
                  _metaCol('Salary Per Day', '₹${NumberFormat('#,##0.00').format(perDayRate)}'),
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _metaCol(String label, String value) {
    return Column(
      children: [
        Text(label, style: const TextStyle(fontSize: 11, color: AppTheme.textMuted, fontWeight: FontWeight.w600)),
        const SizedBox(height: 4),
        Text(value, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
      ],
    );
  }

  Widget _buildActiveCyclesCard() {
    return Card(
      color: const Color(0xFFEFF6FF),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: const BorderSide(color: Color(0xFFBFDBFE)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.sync_alt_rounded, color: AppTheme.primaryBlue, size: 20),
                const SizedBox(width: 8),
                const Text(
                  'Active Concurrent Salary Advance Recovery Cycles',
                  style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: Color(0xFF1E3A8A)),
                ),
                const Spacer(),
                Text(
                  '${_activeCycles.length} Active Cycle(s)',
                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppTheme.primaryBlue),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 12,
              runSpacing: 8,
              children: _activeCycles.map((c) {
                final remBal = double.tryParse(c['remaining_balance']?.toString() ?? '0') ?? 0.0;
                final term = double.tryParse(c['monthly_deduction']?.toString() ?? '0') ?? 0.0;
                final principal = double.tryParse(c['amount']?.toString() ?? '0') ?? 0.0;

                return Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: const Color(0xFF93C5FD)),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.subdirectory_arrow_right_rounded, size: 16, color: AppTheme.primaryBlue),
                      const SizedBox(width: 6),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Adv #${c['id']} • Principal: ₹${principal.toStringAsFixed(0)}',
                            style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppTheme.textPrimary),
                          ),
                          Text(
                            term > 0 ? 'Cut: ₹${term.toStringAsFixed(0)}/mo  •  Rem Bal: ₹${remBal.toStringAsFixed(0)}' : 'Full Deduction  •  Rem Bal: ₹${remBal.toStringAsFixed(0)}',
                            style: const TextStyle(fontSize: 11, color: AppTheme.primaryBlue, fontWeight: FontWeight.bold),
                          ),
                        ],
                      ),
                    ],
                  ),
                );
              }).toList(),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildAdvanceHistoryCard() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'Advance & Loan Ledger History',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                ),
                Text(
                  '${_advanceHistory.length} transaction(s)',
                  style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary),
                ),
              ],
            ),
            const Divider(height: 20),
            if (_advanceHistory.isEmpty)
              const Center(
                child: Padding(
                  padding: EdgeInsets.all(24),
                  child: Text('No advance transactions recorded for this employee.'),
                ),
              )
            else
              Table(
                columnWidths: const {
                  0: FlexColumnWidth(1.2),
                  1: FlexColumnWidth(1),
                  2: FlexColumnWidth(1.2),
                  3: FlexColumnWidth(1),
                  4: FlexColumnWidth(1.4),
                  5: FlexColumnWidth(2.5),
                },
                children: [
                  TableRow(
                    decoration: const BoxDecoration(color: AppTheme.bgLight),
                    children: [
                      _th('Date'),
                      _th('Type'),
                      _th('Amount', align: TextAlign.right),
                      _th('Mode'),
                      _th('Monthly Cut'),
                      _th('Narration / Remarks'),
                    ],
                  ),
                  ..._advanceHistory.map((tx) {
                    final isGiven = tx['type']?.toString().toLowerCase() == 'given';
                    final amt = double.tryParse(tx['amount']?.toString() ?? '0') ?? 0.0;
                    final cut = double.tryParse(tx['monthly_deduction']?.toString() ?? '0') ?? 0.0;

                    return TableRow(
                      decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: AppTheme.borderColor))),
                      children: [
                        _td(tx['date']?.toString().split('T')[0] ?? '—'),
                        Padding(
                          padding: const EdgeInsets.symmetric(vertical: 8),
                          child: CustomBadge(
                            text: isGiven ? 'GIVEN' : 'DEDUCTED',
                            color: isGiven ? AppTheme.warning : AppTheme.success,
                            backgroundColor: isGiven ? AppTheme.warningBg : AppTheme.successBg,
                            borderColor: isGiven ? AppTheme.warningBorder : AppTheme.successBorder,
                          ),
                        ),
                        _td('₹${NumberFormat('#,##0.00').format(amt)}', align: TextAlign.right, bold: true, color: isGiven ? AppTheme.warning : AppTheme.success),
                        _td(tx['mode']?.toString().toUpperCase() ?? 'CASH'),
                        _td(cut > 0 ? '₹${cut.toStringAsFixed(0)}/mo' : '—'),
                        _td(tx['remarks']?.toString() ?? '—'),
                      ],
                    );
                  }),
                ],
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildSalaryHistoryCard() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Past Monthly Payroll History',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
            ),
            const Divider(height: 20),
            if (_salaryHistory.isEmpty)
              const Center(child: Padding(padding: EdgeInsets.all(20), child: Text('No salary records found.')))
            else
              Table(
                columnWidths: const {
                  0: FlexColumnWidth(1),
                  1: FlexColumnWidth(1),
                  2: FlexColumnWidth(1),
                  3: FlexColumnWidth(1),
                  4: FlexColumnWidth(1.2),
                  5: FlexColumnWidth(1.2),
                },
                children: [
                  TableRow(
                    decoration: const BoxDecoration(color: AppTheme.bgLight),
                    children: [
                      _th('Period'),
                      _th('Present'),
                      _th('Leaves Penalty'),
                      _th('Advance Cut'),
                      _th('Net Payable', align: TextAlign.right),
                      _th('Advance C/F', align: TextAlign.right),
                    ],
                  ),
                  ..._salaryHistory.map((s) {
                    final net = double.tryParse(s['gross_amount']?.toString() ?? '0') ?? 0.0;
                    final advDed = double.tryParse(s['advance_deduction']?.toString() ?? '0') ?? 0.0;
                    final cf = double.tryParse(s['advance_cf']?.toString() ?? '0') ?? 0.0;

                    return TableRow(
                      decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: AppTheme.borderColor))),
                      children: [
                        _td('${s['month']}/${s['year']}'),
                        _td('${s['present_days'] ?? 0} d'),
                        _td('₹${s['leaves_amount'] ?? "0"}'),
                        _td('₹${NumberFormat('#,##0.00').format(advDed)}', color: advDed > 0 ? AppTheme.danger : null),
                        _td('₹${NumberFormat('#,##0.00').format(net)}', align: TextAlign.right, bold: true, color: AppTheme.success),
                        _td('₹${NumberFormat('#,##0.00').format(cf)}', align: TextAlign.right),
                      ],
                    );
                  }),
                ],
              ),
          ],
        ),
      ),
    );
  }

  Widget _th(String label, {TextAlign align = TextAlign.left}) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
      child: Text(
        label,
        textAlign: align,
        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: AppTheme.textSecondary),
      ),
    );
  }

  Widget _td(String val, {TextAlign align = TextAlign.left, bool bold = false, Color? color}) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
      child: Text(
        val,
        textAlign: align,
        style: TextStyle(
          fontSize: 12,
          fontWeight: bold ? FontWeight.bold : FontWeight.normal,
          color: color ?? AppTheme.textPrimary,
        ),
      ),
    );
  }
}
