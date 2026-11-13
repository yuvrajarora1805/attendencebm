import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../models/salary_model.dart';
import '../services/api_service.dart';
import '../theme/app_theme.dart';
import '../widgets/custom_badge.dart';

class SalaryScreen extends StatefulWidget {
  const SalaryScreen({super.key});

  @override
  State<SalaryScreen> createState() => _SalaryScreenState();
}

class _SalaryScreenState extends State<SalaryScreen> {
  final ApiService _api = ApiService();

  bool _loadingPeriods = true;
  bool _loadingEntries = false;
  String? _error;

  List<SalaryPeriodModel> _periods = [];
  SalaryPeriodModel? _selectedPeriod;
  List<SalaryEntryModel> _entries = [];
  List<SalaryEntryModel> _filteredEntries = [];
  final _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _loadPeriods();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _loadPeriods() async {
    setState(() => _loadingPeriods = true);
    try {
      final res = await _api.get('/salary/periods');
      if (res != null && res['data'] != null) {
        final list = (res['data'] as List<dynamic>)
            .map((p) => SalaryPeriodModel.fromJson(p as Map<String, dynamic>))
            .toList();
        setState(() {
          _periods = list;
          if (list.isNotEmpty) {
            _selectedPeriod = list.first;
            _loadEntries(_selectedPeriod!.id);
          }
          _loadingPeriods = false;
        });
      }
    } catch (e) {
      setState(() {
        _error = e.toString();
        _loadingPeriods = false;
      });
    }
  }

  Future<void> _loadEntries(int periodId) async {
    setState(() => _loadingEntries = true);
    try {
      final res = await _api.get('/salary/periods/$periodId/entries');
      if (res != null && res['data'] != null) {
        final list = (res['data'] as List<dynamic>)
            .map((e) => SalaryEntryModel.fromJson(e as Map<String, dynamic>))
            .toList();
        setState(() {
          _entries = list;
          _applySearch();
          _loadingEntries = false;
        });
      }
    } catch (_) {
      setState(() => _loadingEntries = false);
    }
  }

  void _applySearch() {
    final q = _searchController.text.trim().toLowerCase();
    setState(() {
      _filteredEntries = _entries.where((e) {
        return q.isEmpty || e.empName.toLowerCase().contains(q) || e.empCode.toLowerCase().contains(q);
      }).toList();
    });
  }

  Future<void> _handleCalculateSync() async {
    if (_selectedPeriod == null) return;
    setState(() => _loadingEntries = true);
    try {
      final res = await _api.post('/salary/periods/${_selectedPeriod!.id}/generate');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(res['message'] ?? 'Salary calculated and synced from attendance!'),
            backgroundColor: AppTheme.success,
          ),
        );
        _loadEntries(_selectedPeriod!.id);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString()), backgroundColor: AppTheme.danger),
        );
      }
    } finally {
      if (mounted) setState(() => _loadingEntries = false);
    }
  }

  void _showPayslipDialog(SalaryEntryModel entry) {
    List<String> cycleSplits = [];
    try {
      if (entry.snapshotJson != null && entry.snapshotJson!.isNotEmpty) {
        final snap = jsonDecode(entry.snapshotJson!);
        if (snap['cycle_deductions'] is List) {
          cycleSplits = (snap['cycle_deductions'] as List).map((s) => s.toString()).toList();
        }
      }
    } catch (_) {}

    if (cycleSplits.isEmpty && entry.deductionRemarks != null && entry.deductionRemarks!.contains('Cycle')) {
      final reg = RegExp(r'\((Cycle [^)]+)\)');
      final match = reg.firstMatch(entry.deductionRemarks!);
      if (match != null && match.group(1) != null) {
        cycleSplits = match.group(1)!.split('•').map((s) => s.trim()).toList();
      }
    }

    final grossEarnings = entry.basicSalary;
    final totalDeductions = entry.leavesAmount + entry.advanceDeduction;

    showDialog(
      context: context,
      builder: (ctx) => Dialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 620),
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                // Header
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('PAYSLIP', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900, letterSpacing: -0.02)),
                        Text('Period: ${_selectedPeriod?.month}/${_selectedPeriod?.year}', style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary)),
                      ],
                    ),
                    IconButton(
                      icon: const Icon(Icons.close),
                      onPressed: () => Navigator.pop(ctx),
                    ),
                  ],
                ),
                const Divider(height: 20),

                // Employee Metadata Strip
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppTheme.bgLight,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: AppTheme.borderColor),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('${entry.empName} (${entry.empCode})', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                          Text(entry.departmentName ?? 'Staff', style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary)),
                        ],
                      ),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Text('Present Days: ${entry.presentDays.toStringAsFixed(1)} d', style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 12)),
                          Text('Daily Rate: ₹${entry.salaryPerDay.toStringAsFixed(2)}/d', style: const TextStyle(fontSize: 11, color: AppTheme.textMuted)),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),

                // Earnings vs Deductions Grid
                Table(
                  border: TableBorder.all(color: AppTheme.borderColor, borderRadius: BorderRadius.circular(8)),
                  columnWidths: const {
                    0: FlexColumnWidth(2),
                    1: FlexColumnWidth(1.2),
                    2: FlexColumnWidth(2),
                    3: FlexColumnWidth(1.2),
                  },
                  children: [
                    const TableRow(
                      decoration: BoxDecoration(color: Color(0xFFF1F5F9)),
                      children: [
                        Padding(padding: EdgeInsets.all(8), child: Text('Earnings', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12))),
                        Padding(padding: EdgeInsets.all(8), child: Text('Amount (₹)', textAlign: TextAlign.right, style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12))),
                        Padding(padding: EdgeInsets.all(8), child: Text('Deductions', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12))),
                        Padding(padding: EdgeInsets.all(8), child: Text('Amount (₹)', textAlign: TextAlign.right, style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12))),
                      ],
                    ),
                    TableRow(
                      children: [
                        const Padding(padding: EdgeInsets.all(8), child: Text('Basic Salary', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600))),
                        Padding(padding: const EdgeInsets.all(8), child: Text(entry.basicSalary.toStringAsFixed(2), textAlign: TextAlign.right, style: const TextStyle(fontSize: 12))),
                        Padding(padding: const EdgeInsets.all(8), child: Text('Leaves Penalty (${entry.finalLeaves.toStringAsFixed(1)}d)', style: const TextStyle(fontSize: 12))),
                        Padding(padding: const EdgeInsets.all(8), child: Text(entry.leavesAmount.toStringAsFixed(2), textAlign: TextAlign.right, style: const TextStyle(fontSize: 12, color: AppTheme.danger))),
                      ],
                    ),
                    TableRow(
                      children: [
                        const Padding(padding: EdgeInsets.all(8), child: Text('Incentives / Bonus', style: TextStyle(fontSize: 12))),
                        const Padding(padding: EdgeInsets.all(8), child: Text('0.00', textAlign: TextAlign.right, style: TextStyle(fontSize: 12))),
                        Padding(padding: const EdgeInsets.all(8), child: Text('Advance Deduction', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: entry.advanceDeduction > 0 ? AppTheme.primaryNavy : null))),
                        Padding(padding: const EdgeInsets.all(8), child: Text(entry.advanceDeduction.toStringAsFixed(2), textAlign: TextAlign.right, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppTheme.danger))),
                      ],
                    ),
                    TableRow(
                      decoration: const BoxDecoration(color: AppTheme.bgLight),
                      children: [
                        const Padding(padding: EdgeInsets.all(8), child: Text('Gross Earnings', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12))),
                        Padding(padding: const EdgeInsets.all(8), child: Text(grossEarnings.toStringAsFixed(2), textAlign: TextAlign.right, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: AppTheme.success))),
                        const Padding(padding: EdgeInsets.all(8), child: Text('Total Deductions', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12))),
                        Padding(padding: const EdgeInsets.all(8), child: Text(totalDeductions.toStringAsFixed(2), textAlign: TextAlign.right, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: AppTheme.danger))),
                      ],
                    ),
                  ],
                ),
                const SizedBox(height: 16),

                // Net Payable Highlight Banner
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: AppTheme.successBg,
                    border: Border.all(color: AppTheme.successBorder),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('NET PAYABLE AMOUNT', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w900, color: Color(0xFF065F46))),
                          Text('Total Earnings − Total Deductions', style: TextStyle(fontSize: 11, color: AppTheme.success)),
                        ],
                      ),
                      Text(
                        '₹${NumberFormat('#,##0.00').format(entry.grossAmount)}',
                        style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: AppTheme.success),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 14),

                // Itemized Deductions & Advance Ledger Split Summary Card
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF8FAFC),
                    border: Border.all(color: AppTheme.borderColor),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text('📋 Itemized Deductions & Advance Split Summary', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 12)),
                          CustomBadge(
                            text: 'Advance C/F: ₹${entry.advanceCf.toStringAsFixed(2)}',
                            color: entry.advanceCf > 0 ? AppTheme.danger : AppTheme.success,
                            backgroundColor: entry.advanceCf > 0 ? AppTheme.dangerBg : AppTheme.successBg,
                            borderColor: entry.advanceCf > 0 ? AppTheme.dangerBorder : AppTheme.successBorder,
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Text('• Absence Leaves Penalty (${entry.finalLeaves.toStringAsFixed(1)} days @ ₹${entry.salaryPerDay.toStringAsFixed(2)}/d): − ₹${entry.leavesAmount.toStringAsFixed(2)}', style: const TextStyle(fontSize: 11, color: AppTheme.textSecondary)),
                      const SizedBox(height: 4),
                      if (cycleSplits.isNotEmpty)
                        ...cycleSplits.map((c) => Padding(
                              padding: const EdgeInsets.only(left: 8, top: 2),
                              child: Text('↳ $c', style: const TextStyle(fontSize: 11, color: AppTheme.primaryBlue, fontWeight: FontWeight.w600)),
                            ))
                      else if (entry.advanceDeduction > 0)
                        Padding(
                          padding: const EdgeInsets.only(left: 8, top: 2),
                          child: Text('↳ Advance payroll deduction cut: − ₹${entry.advanceDeduction.toStringAsFixed(2)}', style: const TextStyle(fontSize: 11, color: AppTheme.primaryBlue)),
                        ),
                      if (entry.deductionRemarks != null) ...[
                        const Divider(height: 14),
                        Text('Narration: ${entry.deductionRemarks}', style: const TextStyle(fontSize: 10, color: AppTheme.textMuted)),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.bgLight,
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Topbar
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Monthly Salary & Payroll Ledger', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, letterSpacing: -0.02)),
                    const SizedBox(height: 2),
                    Text(
                      'Multi-cycle advance recoveries, unexcused absence calculations, and payslip generation',
                      style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary),
                    ),
                  ],
                ),
                Row(
                  children: [
                    ElevatedButton.icon(
                      onPressed: _loadingEntries ? null : _handleCalculateSync,
                      icon: const Icon(Icons.sync_rounded, size: 16),
                      label: const Text('Calculate / Sync'),
                      style: ElevatedButton.styleFrom(backgroundColor: AppTheme.primaryBlue),
                    ),
                    const SizedBox(width: 10),
                    OutlinedButton.icon(
                      onPressed: () {
                        if (_selectedPeriod != null) _loadEntries(_selectedPeriod!.id);
                      },
                      icon: const Icon(Icons.refresh, size: 16),
                      label: const Text('Refresh'),
                    ),
                  ],
                ),
              ],
            ),
            const SizedBox(height: 20),

            // Period Selector & Status Bar
            Card(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                child: Row(
                  children: [
                    const Icon(Icons.calendar_month_rounded, color: AppTheme.primaryNavy),
                    const SizedBox(width: 10),
                    const Text('Salary Period:', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                    const SizedBox(width: 12),
                    DropdownButton<int>(
                      value: _selectedPeriod?.id,
                      underline: const SizedBox(),
                      items: _periods.map((p) {
                        return DropdownMenuItem<int>(
                          value: p.id,
                          child: Text('${p.groupName} (${p.month}/${p.year})', style: const TextStyle(fontWeight: FontWeight.bold)),
                        );
                      }).toList(),
                      onChanged: (id) {
                        if (id != null) {
                          final selected = _periods.firstWhere((p) => p.id == id);
                          setState(() => _selectedPeriod = selected);
                          _loadEntries(id);
                        }
                      },
                    ),
                    const SizedBox(width: 20),
                    if (_selectedPeriod != null)
                      CustomBadge(
                        text: _selectedPeriod!.isLocked ? '🔒 FINALIZED & LOCKED' : '📝 DRAFT / EDITABLE',
                        color: _selectedPeriod!.isLocked ? AppTheme.primaryNavy : AppTheme.warning,
                        backgroundColor: _selectedPeriod!.isLocked ? AppTheme.infoBg : AppTheme.warningBg,
                        borderColor: _selectedPeriod!.isLocked ? AppTheme.infoBorder : AppTheme.warningBorder,
                      ),
                    const Spacer(),
                    SizedBox(
                      width: 240,
                      child: TextField(
                        controller: _searchController,
                        decoration: const InputDecoration(
                          hintText: 'Search employee...',
                          prefixIcon: Icon(Icons.search, size: 16),
                          contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                        ),
                        onChanged: (_) => _applySearch(),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 20),

            // Salary Table Card
            Card(
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text('Payroll Entries (${_filteredEntries.length})', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                        Text('Showing ${_filteredEntries.length} employees', style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary)),
                      ],
                    ),
                    const Divider(height: 20),

                    if (_loadingEntries)
                      const Center(child: Padding(padding: EdgeInsets.all(40), child: CircularProgressIndicator()))
                    else if (_filteredEntries.isEmpty)
                      const Center(
                        child: Padding(
                          padding: EdgeInsets.all(40),
                          child: Text('No salary entries found for this cycle. Click "Calculate / Sync" to calculate from attendance.'),
                        ),
                      )
                    else
                      Table(
                        columnWidths: const {
                          0: FlexColumnWidth(2.2),
                          1: FlexColumnWidth(1.2),
                          2: FlexColumnWidth(1.2),
                          3: FlexColumnWidth(1.2),
                          4: FlexColumnWidth(1.4),
                          5: FlexColumnWidth(1.4),
                          6: FlexColumnWidth(1.2),
                          7: FlexColumnWidth(1.2),
                        },
                        children: [
                          TableRow(
                            decoration: const BoxDecoration(color: AppTheme.bgLight),
                            children: [
                              _th('Employee'),
                              _th('Basic Salary', align: TextAlign.right),
                              _th('Present', align: TextAlign.center),
                              _th('Leaves Cut', align: TextAlign.right),
                              _th('Advance Cut', align: TextAlign.right),
                              _th('Net Payable', align: TextAlign.right),
                              _th('Debt C/F', align: TextAlign.right),
                              _th('Payslip', align: TextAlign.center),
                            ],
                          ),
                          ..._filteredEntries.map((entry) {
                            return TableRow(
                              decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: AppTheme.borderColor))),
                              children: [
                                Padding(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(entry.empName, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                                      Text('${entry.empCode} • ${entry.departmentName ?? "Staff"}', style: const TextStyle(fontSize: 11, color: AppTheme.textMuted)),
                                    ],
                                  ),
                                ),
                                _td('₹${NumberFormat('#,##0.00').format(entry.basicSalary)}', align: TextAlign.right),
                                _td('${entry.presentDays.toStringAsFixed(1)} d', align: TextAlign.center),
                                _td('₹${entry.leavesAmount.toStringAsFixed(2)}', align: TextAlign.right, color: entry.leavesAmount > 0 ? AppTheme.danger : null),
                                _td('₹${NumberFormat('#,##0.00').format(entry.advanceDeduction)}', align: TextAlign.right, bold: true, color: entry.advanceDeduction > 0 ? AppTheme.primaryNavy : null),
                                _td('₹${NumberFormat('#,##0.00').format(entry.grossAmount)}', align: TextAlign.right, bold: true, color: AppTheme.success),
                                _td('₹${NumberFormat('#,##0.00').format(entry.advanceCf)}', align: TextAlign.right, color: entry.advanceCf > 0 ? AppTheme.danger : null),
                                Padding(
                                  padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 8),
                                  child: Center(
                                    child: OutlinedButton(
                                      onPressed: () => _showPayslipDialog(entry),
                                      style: OutlinedButton.styleFrom(
                                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                        minimumSize: const Size(60, 28),
                                      ),
                                      child: const Text('Payslip', style: TextStyle(fontSize: 11)),
                                    ),
                                  ),
                                ),
                              ],
                            );
                          }),
                        ],
                      ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _th(String label, {TextAlign align = TextAlign.left}) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
      child: Text(label, textAlign: align, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: AppTheme.textSecondary)),
    );
  }

  Widget _td(String val, {TextAlign align = TextAlign.left, bool bold = false, Color? color}) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 12),
      child: Text(val, textAlign: align, style: TextStyle(fontSize: 12, fontWeight: bold ? FontWeight.bold : FontWeight.normal, color: color ?? AppTheme.textPrimary)),
    );
  }
}
