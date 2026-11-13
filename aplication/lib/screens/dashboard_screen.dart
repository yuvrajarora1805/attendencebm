import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../services/api_service.dart';
import '../services/auth_provider.dart';
import '../theme/app_theme.dart';
import '../widgets/stat_card.dart';
import '../widgets/custom_badge.dart';

class DashboardScreen extends StatefulWidget {
  final Function(int)? onNavigate;
  const DashboardScreen({super.key, this.onNavigate});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  final ApiService _api = ApiService();
  bool _loading = true;
  String? _error;

  int _totalEmployees = 0;
  int _presentToday = 0;
  int _absentToday = 0;
  int _leaveToday = 0;
  int _pendingAdvances = 0;
  double _totalDebt = 0.0;
  List<dynamic> _recentPunches = [];

  @override
  void initState() {
    super.initState();
    _loadDashboardData();
  }

  Future<void> _loadDashboardData() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final now = DateTime.now();
      final dateStr = DateFormat('yyyy-MM-dd').format(now);

      // 1. Fetch Today's Attendance
      try {
        final attRes = await _api.get('/attendance/today?date=$dateStr');
        if (attRes != null && attRes['data'] != null) {
          final list = attRes['data'] as List<dynamic>;
          _recentPunches = list.take(8).toList();
          _presentToday = list.where((r) => ['present', 'late', 'half_day'].contains(r['status']?.toString().toLowerCase())).length;
          _absentToday = list.where((r) => r['status']?.toString().toLowerCase() == 'absent').length;
          _leaveToday = list.where((r) => ['leave', 'on_leave', 'on-leave'].contains(r['status']?.toString().toLowerCase())).length;
        }
      } catch (_) {}

      // 2. Fetch Employee Count
      try {
        final empRes = await _api.get('/employees?status=active');
        if (empRes != null && empRes['data'] != null) {
          _totalEmployees = (empRes['data'] as List<dynamic>).length;
        }
      } catch (_) {}

      // 3. Fetch Pending Advances
      try {
        final advRes = await _api.get('/advances/requests?status=pending');
        if (advRes != null && advRes['data'] != null) {
          _pendingAdvances = (advRes['data'] as List<dynamic>).length;
        }
      } catch (_) {}

      // 4. Fetch Advances Balance
      try {
        final sumRes = await _api.get('/advances');
        if (sumRes != null && sumRes['data'] != null) {
          final list = sumRes['data'] as List<dynamic>;
          double given = 0;
          double ded = 0;
          for (final t in list) {
            final amt = double.tryParse(t['amount']?.toString() ?? '0') ?? 0;
            if (t['type']?.toString().toLowerCase() == 'given') {
              given += amt;
            } else {
              ded += amt;
            }
          }
          _totalDebt = (given - ded).clamp(0, double.infinity);
        }
      } catch (_) {}

      setState(() => _loading = false);
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
    final user = auth.user;
    final now = DateTime.now();

    return Scaffold(
      backgroundColor: AppTheme.bgLight,
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _loadDashboardData,
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(24),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Header Bar
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Welcome back, ${user?.fullName ?? "Administrator"}',
                              style: const TextStyle(
                                fontSize: 22,
                                fontWeight: FontWeight.w800,
                                color: AppTheme.textPrimary,
                                letterSpacing: -0.02,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              'Shift Overview & Operational Attendance Ledger • ${DateFormat('EEEE, d MMMM yyyy').format(now)}',
                              style: const TextStyle(
                                fontSize: 13,
                                color: AppTheme.textSecondary,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ],
                        ),
                        Row(
                          children: [
                            OutlinedButton.icon(
                              onPressed: _loadDashboardData,
                              icon: const Icon(Icons.refresh_rounded, size: 16),
                              label: const Text('Refresh'),
                            ),
                            const SizedBox(width: 10),
                            ElevatedButton.icon(
                              onPressed: () => widget.onNavigate?.call(2), // Shift punch
                              icon: const Icon(Icons.fingerprint, size: 16),
                              label: const Text('Punch Attendance'),
                              style: ElevatedButton.styleFrom(
                                backgroundColor: AppTheme.primaryNavy,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                    const SizedBox(height: 24),

                    // Pending Advance Requests Banner
                    if (_pendingAdvances > 0)
                      Container(
                        margin: const EdgeInsets.only(bottom: 24),
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: AppTheme.warningBg,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: AppTheme.warningBorder, width: 1.5),
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Row(
                              children: [
                                Container(
                                  padding: const EdgeInsets.all(8),
                                  decoration: BoxDecoration(
                                    color: AppTheme.warning.withOpacity(0.15),
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: const Icon(Icons.warning_amber_rounded, color: AppTheme.warning, size: 22),
                                ),
                                const SizedBox(width: 14),
                                Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      '$_pendingAdvances Manager Advance Request(s) Awaiting Review',
                                      style: const TextStyle(
                                        fontSize: 14,
                                        fontWeight: FontWeight.w800,
                                        color: Color(0xFF92400E),
                                      ),
                                    ),
                                    const SizedBox(height: 2),
                                    const Text(
                                      'Shift managers have submitted staff advance requests under the 50% earned wage limit rule.',
                                      style: TextStyle(fontSize: 12, color: Color(0xFFB45309)),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                            ElevatedButton.icon(
                              onPressed: () => widget.onNavigate?.call(4), // Advances
                              icon: const Icon(Icons.arrow_forward_rounded, size: 16),
                              label: const Text('Review Advances'),
                              style: ElevatedButton.styleFrom(
                                backgroundColor: AppTheme.warning,
                                foregroundColor: Colors.white,
                              ),
                            ),
                          ],
                        ),
                      ),

                    // Metrics Grid
                    LayoutBuilder(
                      builder: (context, constraints) {
                        final isDesktop = constraints.maxWidth > 900;
                        final crossAxisCount = isDesktop ? 4 : 2;

                        return GridView.count(
                          crossAxisCount: crossAxisCount,
                          shrinkWrap: true,
                          physics: const NeverScrollableScrollPhysics(),
                          crossAxisSpacing: 16,
                          mainAxisSpacing: 16,
                          childAspectRatio: 1.8,
                          children: [
                            StatCard(
                              title: 'Total Active Staff',
                              value: '$_totalEmployees',
                              subtitle: 'Registered in system',
                              icon: Icons.people_outline,
                              iconColor: AppTheme.primaryBlue,
                              onTap: () => widget.onNavigate?.call(3),
                            ),
                            StatCard(
                              title: 'Present Today',
                              value: '$_presentToday',
                              subtitle: 'Active attendance',
                              icon: Icons.check_circle_outline,
                              iconColor: AppTheme.success,
                              valueColor: AppTheme.success,
                              onTap: () => widget.onNavigate?.call(1),
                            ),
                            StatCard(
                              title: 'Absents / Unexcused',
                              value: '$_absentToday',
                              subtitle: 'Requires leaves penalty',
                              icon: Icons.cancel_outlined,
                              iconColor: AppTheme.danger,
                              valueColor: AppTheme.danger,
                              onTap: () => widget.onNavigate?.call(1),
                            ),
                            StatCard(
                              title: 'Pending Advances',
                              value: '$_pendingAdvances',
                              subtitle: 'Manager requests awaiting',
                              icon: Icons.account_balance_wallet_outlined,
                              iconColor: AppTheme.warning,
                              valueColor: _pendingAdvances > 0 ? AppTheme.warning : null,
                              onTap: () => widget.onNavigate?.call(4),
                            ),
                          ],
                        );
                      },
                    ),
                    const SizedBox(height: 28),

                    // Quick Action & Attendance Preview Split
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Quick Punch Box
                        Expanded(
                          flex: 3,
                          child: Card(
                            child: Padding(
                              padding: const EdgeInsets.all(20),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    children: [
                                      const Text(
                                        'Recent Attendance Punches',
                                        style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                                      ),
                                      TextButton(
                                        onPressed: () => widget.onNavigate?.call(1),
                                        child: const Text('View Full Roster'),
                                      ),
                                    ],
                                  ),
                                  const Divider(height: 20),
                                  if (_recentPunches.isEmpty)
                                    const Padding(
                                      padding: EdgeInsets.symmetric(vertical: 24),
                                      child: Center(
                                        child: Text(
                                          'No punches logged yet today. Use Shift Punch Tool to record attendance.',
                                          style: TextStyle(color: AppTheme.textSecondary, fontSize: 13),
                                        ),
                                      ),
                                    )
                                  else
                                    ListView.separated(
                                      shrinkWrap: true,
                                      physics: const NeverScrollableScrollPhysics(),
                                      itemCount: _recentPunches.length,
                                      separatorBuilder: (_, __) => const Divider(height: 1),
                                      itemBuilder: (context, idx) {
                                        final punch = _recentPunches[idx];
                                        final isPresent = ['present', 'late', 'half_day'].contains(punch['status']?.toString().toLowerCase());

                                        return ListTile(
                                          dense: true,
                                          contentPadding: EdgeInsets.zero,
                                          leading: CircleAvatar(
                                            radius: 16,
                                            backgroundColor: isPresent ? AppTheme.successBg : AppTheme.dangerBg,
                                            child: Icon(
                                              isPresent ? Icons.check : Icons.close,
                                              size: 14,
                                              color: isPresent ? AppTheme.success : AppTheme.danger,
                                            ),
                                          ),
                                          title: Text(
                                            punch['name'] ?? punch['emp_name'] ?? 'Staff',
                                            style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                                          ),
                                          subtitle: Text(
                                            'Emp #${punch['emp_code']} • ${punch['department_name'] ?? 'Staff'}',
                                            style: const TextStyle(fontSize: 11, color: AppTheme.textMuted),
                                          ),
                                          trailing: CustomBadge(
                                            text: (punch['status'] ?? 'PRESENT').toString().toUpperCase(),
                                            color: isPresent ? AppTheme.success : AppTheme.danger,
                                            backgroundColor: isPresent ? AppTheme.successBg : AppTheme.dangerBg,
                                            borderColor: isPresent ? AppTheme.successBorder : AppTheme.dangerBorder,
                                          ),
                                        );
                                      },
                                    ),
                                ],
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 20),

                        // System Operations Panel
                        Expanded(
                          flex: 2,
                          child: Card(
                            child: Padding(
                              padding: const EdgeInsets.all(20),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Text(
                                    'Quick Enterprise Workflows',
                                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                                  ),
                                  const SizedBox(height: 4),
                                  const Text(
                                    'Access modules and automated calculations',
                                    style: TextStyle(fontSize: 12, color: AppTheme.textSecondary),
                                  ),
                                  const SizedBox(height: 16),
                                  _QuickActionTile(
                                    icon: Icons.flash_on_rounded,
                                    title: 'Batch Advance Checklist',
                                    subtitle: '50% earned wage limit rule checklist',
                                    color: AppTheme.primaryNavy,
                                    onTap: () => widget.onNavigate?.call(4),
                                  ),
                                  const SizedBox(height: 10),
                                  _QuickActionTile(
                                    icon: Icons.sync_rounded,
                                    title: 'Monthly Salary Calculate / Sync',
                                    subtitle: 'Process attendance & multi-cycle advances',
                                    color: AppTheme.primaryBlue,
                                    onTap: () => widget.onNavigate?.call(5),
                                  ),
                                  const SizedBox(height: 10),
                                  _QuickActionTile(
                                    icon: Icons.person_add_alt_1_outlined,
                                    title: 'Workforce Profiles & Tenure',
                                    subtitle: 'Track staff & < 6M probationary warnings',
                                    color: AppTheme.success,
                                    onTap: () => widget.onNavigate?.call(3),
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
            ),
    );
  }
}

class _QuickActionTile extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final Color color;
  final VoidCallback onTap;

  const _QuickActionTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(10),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          border: Border.all(color: AppTheme.borderColor),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: color.withOpacity(0.1),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(icon, size: 20, color: color),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                  const SizedBox(height: 2),
                  Text(subtitle, style: const TextStyle(fontSize: 11, color: AppTheme.textSecondary)),
                ],
              ),
            ),
            const Icon(Icons.chevron_right_rounded, size: 18, color: AppTheme.textMuted),
          ],
        ),
      ),
    );
  }
}
