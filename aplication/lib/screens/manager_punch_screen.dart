import 'dart:async';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../services/api_service.dart';
import '../theme/app_theme.dart';
import '../widgets/custom_badge.dart';

class ManagerPunchScreen extends StatefulWidget {
  const ManagerPunchScreen({super.key});

  @override
  State<ManagerPunchScreen> createState() => _ManagerPunchScreenState();
}

class _ManagerPunchScreenState extends State<ManagerPunchScreen> {
  final ApiService _api = ApiService();
  final _empCodeController = TextEditingController();
  
  String _punchAction = 'auto'; // auto, in, out
  bool _submitting = false;
  DateTime _currentTime = DateTime.now();
  late Timer _clockTimer;

  List<dynamic> _employees = [];
  Map<String, dynamic>? _matchedEmp;
  List<dynamic> _todayPunches = [];
  bool _loadingPunches = false;

  @override
  void initState() {
    super.initState();
    _clockTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() => _currentTime = DateTime.now());
    });
    _loadEmployees();
    _loadTodayPunches();
  }

  @override
  void dispose() {
    _clockTimer.cancel();
    _empCodeController.dispose();
    super.dispose();
  }

  Future<void> _loadEmployees() async {
    try {
      final res = await _api.get('/employees?status=active');
      if (res != null && res['data'] != null) {
        setState(() => _employees = res['data'] as List<dynamic>);
      }
    } catch (_) {}
  }

  Future<void> _loadTodayPunches() async {
    setState(() => _loadingPunches = true);
    try {
      final dateStr = DateFormat('yyyy-MM-dd').format(DateTime.now());
      final res = await _api.get('/attendance/today?date=$dateStr');
      if (res != null && res['data'] != null) {
        setState(() => _todayPunches = res['data'] as List<dynamic>);
      }
    } catch (_) {}
    setState(() => _loadingPunches = false);
  }

  void _onCodeChanged(String val) {
    final query = val.trim().toUpperCase();
    if (query.isEmpty) {
      setState(() => _matchedEmp = null);
      return;
    }

    final match = _employees.firstWhere(
      (e) => e['emp_code']?.toString().toUpperCase() == query,
      orElse: () => null,
    );
    setState(() => _matchedEmp = match);
  }

  Future<void> _handlePunch() async {
    final code = _empCodeController.text.trim().toUpperCase();
    if (code.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please enter employee ID or code')),
      );
      return;
    }

    setState(() => _submitting = true);

    try {
      final res = await _api.post('/attendance/punch', {
        'emp_code': code,
        'action': _punchAction,
        'source': 'manager_desktop',
      });

      if (res['success'] == true) {
        final empName = res['employee']?['name'] ?? _matchedEmp?['name'] ?? 'Staff';
        final punchType = res['punch_type']?.toString().toUpperCase() ?? _punchAction.toUpperCase();
        final timeStr = DateFormat('hh:mm a').format(DateTime.now());

        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('✓ Verified $punchType recorded for $empName at $timeStr'),
              backgroundColor: AppTheme.success,
              behavior: SnackBarBehavior.floating,
            ),
          );
          _empCodeController.clear();
          setState(() => _matchedEmp = null);
          _loadTodayPunches();
        }
      } else {
        throw ApiException(res['message']?.toString() ?? 'Failed to punch');
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e.toString()),
            backgroundColor: AppTheme.danger,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final timeStr = DateFormat('HH:mm:ss').format(_currentTime);
    final dateStr = DateFormat('EEEE, d MMMM yyyy').format(_currentTime);

    return Scaffold(
      backgroundColor: AppTheme.bgLight,
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Topbar with Live Clock
            Card(
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: AppTheme.primaryNavy,
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: const Icon(Icons.fingerprint, color: Colors.white, size: 28),
                        ),
                        const SizedBox(width: 16),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'Shift Supervisor Punch Override Tool',
                              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: AppTheme.textPrimary),
                            ),
                            const SizedBox(height: 2),
                            const Text(
                              'Direct biometric punch override for shift workers and security gates',
                              style: TextStyle(fontSize: 12, color: AppTheme.textSecondary),
                            ),
                          ],
                        ),
                      ],
                    ),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Text(
                          timeStr,
                          style: const TextStyle(
                            fontSize: 28,
                            fontWeight: FontWeight.w900,
                            color: AppTheme.primaryNavy,
                            letterSpacing: 0.05,
                          ),
                        ),
                        Text(
                          dateStr,
                          style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary, fontWeight: FontWeight.w500),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 24),

            // Two-Column Grid: Punch Box + Today's Log
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Punch Form Box
                ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 420),
                  child: Card(
                    child: Padding(
                      padding: const EdgeInsets.all(24),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Enter Punch Information',
                            style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
                          ),
                          const SizedBox(height: 16),

                          // Mode Selector
                          Container(
                            padding: const EdgeInsets.all(4),
                            decoration: BoxDecoration(
                              color: AppTheme.bgLight,
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(color: AppTheme.borderColor),
                            ),
                            child: Row(
                              children: [
                                _modeBtn('AUTO', 'auto', Icons.flash_on_rounded),
                                _modeBtn('IN', 'in', Icons.login_rounded),
                                _modeBtn('OUT', 'out', Icons.logout_rounded),
                              ],
                            ),
                          ),
                          const SizedBox(height: 20),

                          // Employee Code Input
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              const Text('Employee Code / ID *', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                              if (_matchedEmp != null)
                                Text(
                                  '✓ ${_matchedEmp!['name']}',
                                  style: const TextStyle(fontSize: 12, color: AppTheme.success, fontWeight: FontWeight.bold),
                                ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          TextField(
                            controller: _empCodeController,
                            decoration: const InputDecoration(
                              hintText: 'Enter Emp Code (e.g. 15046)...',
                              prefixIcon: Icon(Icons.badge_outlined),
                            ),
                            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, letterSpacing: 0.05),
                            textCapitalization: TextCapitalization.characters,
                            onChanged: _onCodeChanged,
                            onSubmitted: (_) => _handlePunch(),
                          ),

                          if (_matchedEmp != null) ...[
                            const SizedBox(height: 12),
                            Container(
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: AppTheme.successBg,
                                borderRadius: BorderRadius.circular(8),
                                border: Border.all(color: AppTheme.successBorder),
                              ),
                              child: Row(
                                children: [
                                  const Icon(Icons.check_circle_rounded, color: AppTheme.success, size: 20),
                                  const SizedBox(width: 10),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          _matchedEmp!['name']?.toString() ?? '',
                                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                                        ),
                                        Text(
                                          '${_matchedEmp!['department_name'] ?? 'Staff'} • ${_matchedEmp!['job_role'] ?? 'Employee'}',
                                          style: const TextStyle(fontSize: 11, color: AppTheme.textSecondary),
                                        ),
                                      ],
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                          const SizedBox(height: 24),

                          // Punch Button
                          SizedBox(
                            width: double.infinity,
                            height: 48,
                            child: ElevatedButton.icon(
                              onPressed: _submitting ? null : _handlePunch,
                              icon: _submitting
                                  ? const SizedBox(
                                      width: 18,
                                      height: 18,
                                      child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                                    )
                                  : const Icon(Icons.touch_app_rounded),
                              label: Text(
                                _submitting ? 'Recording Punch...' : 'Submit $_punchAction Punch',
                                style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
                              ),
                              style: ElevatedButton.styleFrom(
                                backgroundColor: _punchAction == 'in'
                                    ? AppTheme.success
                                    : _punchAction == 'out'
                                        ? AppTheme.primaryBlue
                                        : AppTheme.primaryNavy,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 24),

                // Live Punch Feed Table
                Expanded(
                  child: Card(
                    child: Padding(
                      padding: const EdgeInsets.all(20),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(
                                "Today's Verified Punches (${_todayPunches.length})",
                                style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                              ),
                              OutlinedButton.icon(
                                onPressed: _loadTodayPunches,
                                icon: const Icon(Icons.refresh, size: 14),
                                label: const Text('Refresh'),
                              ),
                            ],
                          ),
                          const Divider(height: 20),

                          if (_loadingPunches)
                            const Center(child: Padding(padding: EdgeInsets.all(32), child: CircularProgressIndicator()))
                          else if (_todayPunches.isEmpty)
                            const Center(
                              child: Padding(
                                padding: EdgeInsets.all(32),
                                child: Text('No verified punches recorded yet for today.'),
                              ),
                            )
                          else
                            ListView.separated(
                              shrinkWrap: true,
                              physics: const NeverScrollableScrollPhysics(),
                              itemCount: _todayPunches.length.clamp(0, 15),
                              separatorBuilder: (_, __) => const Divider(height: 1),
                              itemBuilder: (context, idx) {
                                final p = _todayPunches[idx];
                                final isPresent = ['present', 'late', 'half_day'].contains(p['status']?.toString().toLowerCase());

                                return ListTile(
                                  dense: true,
                                  title: Text(
                                    p['emp_name'] ?? p['name'] ?? 'Staff',
                                    style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                                  ),
                                  subtitle: Text(
                                    'Code: ${p['emp_code']} • ${p['department_name'] ?? 'Staff'}',
                                    style: const TextStyle(fontSize: 11, color: AppTheme.textMuted),
                                  ),
                                  trailing: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      if (p['punch_in'] != null)
                                        Text(
                                          'IN: ${DateFormat('hh:mm a').format(DateTime.parse(p['punch_in']))}  ',
                                          style: const TextStyle(fontSize: 12, color: AppTheme.success, fontWeight: FontWeight.w600),
                                        ),
                                      if (p['punch_out'] != null)
                                        Text(
                                          'OUT: ${DateFormat('hh:mm a').format(DateTime.parse(p['punch_out']))}  ',
                                          style: const TextStyle(fontSize: 12, color: AppTheme.primaryBlue, fontWeight: FontWeight.w600),
                                        ),
                                      CustomBadge(
                                        text: (p['status'] ?? 'PRESENT').toString().toUpperCase(),
                                        color: isPresent ? AppTheme.success : AppTheme.danger,
                                        backgroundColor: isPresent ? AppTheme.successBg : AppTheme.dangerBg,
                                        borderColor: isPresent ? AppTheme.successBorder : AppTheme.dangerBorder,
                                      ),
                                    ],
                                  ),
                                );
                              },
                            ),
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _modeBtn(String label, String action, IconData icon) {
    final active = _punchAction == action;
    return Expanded(
      child: InkWell(
        onTap: () => setState(() => _punchAction = action),
        borderRadius: BorderRadius.circular(6),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 8),
          decoration: BoxDecoration(
            color: active ? AppTheme.primaryNavy : Colors.transparent,
            borderRadius: BorderRadius.circular(6),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, size: 14, color: active ? Colors.white : AppTheme.textSecondary),
              const SizedBox(width: 6),
              Text(
                label,
                style: TextStyle(
                  color: active ? Colors.white : AppTheme.textSecondary,
                  fontWeight: active ? FontWeight.bold : FontWeight.w600,
                  fontSize: 12,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

