import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../services/api_service.dart';
import '../theme/app_theme.dart';
import '../widgets/custom_badge.dart';

class AttendanceScreen extends StatefulWidget {
  const AttendanceScreen({super.key});

  @override
  State<AttendanceScreen> createState() => _AttendanceScreenState();
}

class _AttendanceScreenState extends State<AttendanceScreen> {
  final ApiService _api = ApiService();
  DateTime _selectedDate = DateTime.now();

  bool _loading = true;
  String? _error;
  List<dynamic> _records = [];
  List<dynamic> _filteredRecords = [];

  String _statusFilter = 'all'; // all, present, absent, leave
  final _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _loadAttendance();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _loadAttendance() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final dateStr = DateFormat('yyyy-MM-dd').format(_selectedDate);
      final res = await _api.get('/attendance/today?date=$dateStr');
      if (res != null && res['data'] != null) {
        setState(() {
          _records = res['data'] as List<dynamic>;
          _applyFilters();
          _loading = false;
        });
      }
    } catch (e) {
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  void _applyFilters() {
    final q = _searchController.text.trim().toLowerCase();
    setState(() {
      _filteredRecords = _records.where((r) {
        final matchesQuery = q.isEmpty ||
            (r['name']?.toString().toLowerCase().contains(q) ?? false) ||
            (r['emp_name']?.toString().toLowerCase().contains(q) ?? false) ||
            (r['emp_code']?.toString().toLowerCase().contains(q) ?? false);

        final status = (r['status'] ?? 'absent').toString().toLowerCase();
        final matchesStatus = _statusFilter == 'all' ||
            (_statusFilter == 'present' && ['present', 'late', 'half_day'].contains(status)) ||
            (_statusFilter == 'absent' && status == 'absent') ||
            (_statusFilter == 'leave' && ['leave', 'on_leave', 'on-leave'].contains(status));

        return matchesQuery && matchesStatus;
      }).toList();
    });
  }

  Future<void> _selectDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _selectedDate,
      firstDate: DateTime(2020),
      lastDate: DateTime.now().add(const Duration(days: 30)),
    );
    if (picked != null && picked != _selectedDate) {
      setState(() => _selectedDate = picked);
      _loadAttendance();
    }
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
                    const Text('Daily Attendance & Biometric Log', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, letterSpacing: -0.02)),
                    const SizedBox(height: 2),
                    Text(
                      'Live employee punch roster for ${DateFormat('EEEE, d MMMM yyyy').format(_selectedDate)}',
                      style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary),
                    ),
                  ],
                ),
                Row(
                  children: [
                    OutlinedButton.icon(
                      onPressed: _selectDate,
                      icon: const Icon(Icons.calendar_today_rounded, size: 16),
                      label: Text(DateFormat('yyyy-MM-dd').format(_selectedDate)),
                    ),
                    const SizedBox(width: 10),
                    ElevatedButton.icon(
                      onPressed: _loadAttendance,
                      icon: const Icon(Icons.refresh, size: 16),
                      label: const Text('Refresh'),
                    ),
                  ],
                ),
              ],
            ),
            const SizedBox(height: 20),

            // Filter Bar
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Row(
                  children: [
                    Expanded(
                      flex: 2,
                      child: TextField(
                        controller: _searchController,
                        decoration: const InputDecoration(
                          hintText: 'Search attendance roster by staff name or code...',
                          prefixIcon: Icon(Icons.search, size: 20),
                        ),
                        onChanged: (_) => _applyFilters(),
                      ),
                    ),
                    const SizedBox(width: 16),
                    _chip('all', 'All (${_records.length})'),
                    const SizedBox(width: 8),
                    _chip('present', 'Present', color: AppTheme.success),
                    const SizedBox(width: 8),
                    _chip('absent', 'Absent', color: AppTheme.danger),
                    const SizedBox(width: 8),
                    _chip('leave', 'On Leave', color: AppTheme.warning),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 20),

            // Attendance Table Card
            Card(
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text('Attendance Records (${_filteredRecords.length})', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                        Text('Date: ${DateFormat('yyyy-MM-dd').format(_selectedDate)}', style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary)),
                      ],
                    ),
                    const Divider(height: 20),

                    if (_loading)
                      const Center(child: Padding(padding: EdgeInsets.all(40), child: CircularProgressIndicator()))
                    else if (_filteredRecords.isEmpty)
                      const Center(child: Padding(padding: EdgeInsets.all(40), child: Text('No attendance records found for this date.')))
                    else
                      Table(
                        columnWidths: const {
                          0: FlexColumnWidth(2.2),
                          1: FlexColumnWidth(1.6),
                          2: FlexColumnWidth(1.2),
                          3: FlexColumnWidth(1.2),
                          4: FlexColumnWidth(1.2),
                        },
                        children: [
                          TableRow(
                            decoration: const BoxDecoration(color: AppTheme.bgLight),
                            children: [
                              _th('Employee'),
                              _th('Department'),
                              _th('Punch IN', align: TextAlign.center),
                              _th('Punch OUT', align: TextAlign.center),
                              _th('Status', align: TextAlign.center),
                            ],
                          ),
                          ..._filteredRecords.map((r) {
                            final status = (r['status'] ?? 'absent').toString().toLowerCase();
                            final isPresent = ['present', 'late', 'half_day'].contains(status);
                            final punchIn = r['punch_in'] != null ? DateFormat('hh:mm a').format(DateTime.parse(r['punch_in'])) : '—';
                            final punchOut = r['punch_out'] != null ? DateFormat('hh:mm a').format(DateTime.parse(r['punch_out'])) : '—';

                            return TableRow(
                              decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: AppTheme.borderColor))),
                              children: [
                                Padding(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(r['name'] ?? r['emp_name'] ?? 'Staff', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                                      Text('Code: ${r['emp_code']}', style: const TextStyle(fontSize: 11, color: AppTheme.textMuted)),
                                    ],
                                  ),
                                ),
                                _td(r['department_name'] ?? 'Staff'),
                                _td(punchIn, align: TextAlign.center, color: punchIn != '—' ? AppTheme.success : null, bold: punchIn != '—'),
                                _td(punchOut, align: TextAlign.center, color: punchOut != '—' ? AppTheme.primaryBlue : null, bold: punchOut != '—'),
                                Padding(
                                  padding: const EdgeInsets.symmetric(vertical: 8),
                                  child: Center(
                                    child: CustomBadge(
                                      text: status.toUpperCase(),
                                      color: isPresent ? AppTheme.success : AppTheme.danger,
                                      backgroundColor: isPresent ? AppTheme.successBg : AppTheme.dangerBg,
                                      borderColor: isPresent ? AppTheme.successBorder : AppTheme.dangerBorder,
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

  Widget _chip(String status, String label, {Color color = AppTheme.primaryNavy}) {
    final active = _statusFilter == status;
    return InkWell(
      onTap: () {
        setState(() => _statusFilter = status);
        _applyFilters();
      },
      borderRadius: BorderRadius.circular(6),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: active ? color : Colors.transparent,
          borderRadius: BorderRadius.circular(6),
          border: Border.all(color: active ? color : AppTheme.borderColor),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: active ? Colors.white : AppTheme.textSecondary,
            fontWeight: active ? FontWeight.bold : FontWeight.w600,
            fontSize: 12,
          ),
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
