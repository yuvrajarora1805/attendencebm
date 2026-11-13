import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../models/advance_model.dart';
import '../models/employee_model.dart';
import '../services/api_service.dart';
import '../services/auth_provider.dart';
import '../theme/app_theme.dart';
import '../widgets/custom_badge.dart';
import '../widgets/stat_card.dart';

class AdvancesScreen extends StatefulWidget {
  const AdvancesScreen({super.key});

  @override
  State<AdvancesScreen> createState() => _AdvancesScreenState();
}

class _AdvancesScreenState extends State<AdvancesScreen> with SingleTickerProviderStateMixin {
  final ApiService _api = ApiService();
  late TabController _tabController;

  bool _loadingRequests = true;
  bool _loadingLedger = true;
  String? _error;

  List<AdvanceRequestModel> _requests = [];
  List<AdvanceTransactionModel> _transactions = [];

  String _requestStatusFilter = 'all'; // all, pending, approved, rejected

  double _totalGiven = 0.0;
  double _totalDeducted = 0.0;
  double _netOutstanding = 0.0;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _loadAll();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _loadAll() async {
    _loadRequests();
    _loadLedger();
  }

  Future<void> _loadRequests() async {
    setState(() => _loadingRequests = true);
    try {
      final res = await _api.get('/advances/requests');
      if (res != null && res['data'] != null) {
        final list = (res['data'] as List<dynamic>)
            .map((e) => AdvanceRequestModel.fromJson(e as Map<String, dynamic>))
            .toList();
        setState(() {
          _requests = list;
          _loadingRequests = false;
        });
      }
    } catch (e) {
      setState(() {
        _error = e.toString();
        _loadingRequests = false;
      });
    }
  }

  Future<void> _loadLedger() async {
    setState(() => _loadingLedger = true);
    try {
      final res = await _api.get('/advances');
      if (res != null && res['data'] != null) {
        final list = (res['data'] as List<dynamic>)
            .map((e) => AdvanceTransactionModel.fromJson(e as Map<String, dynamic>))
            .toList();

        double given = 0;
        double ded = 0;
        for (final t in list) {
          if (t.isGiven) {
            given += t.amount;
          } else {
            ded += t.amount;
          }
        }

        setState(() {
          _transactions = list;
          _totalGiven = given;
          _totalDeducted = ded;
          _netOutstanding = (given - ded).clamp(0, double.infinity);
          _loadingLedger = false;
        });
      }
    } catch (_) {
      setState(() => _loadingLedger = false);
    }
  }

  List<AdvanceRequestModel> get _filteredRequests {
    if (_requestStatusFilter == 'all') return _requests;
    return _requests.where((r) => r.status == _requestStatusFilter).toList();
  }

  void _showSingleApproveDialog(AdvanceRequestModel item) {
    final amountController = TextEditingController(text: item.amount.toStringAsFixed(0));
    final deductionController = TextEditingController(
      text: item.monthlyDeduction > 0 ? item.monthlyDeduction.toStringAsFixed(0) : '2000',
    );
    final notesController = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Row(
          children: [
            const Icon(Icons.verified_user_rounded, color: AppTheme.success, size: 24),
            const SizedBox(width: 10),
            Text('Approve Advance: ${item.empName}', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          ],
        ),
        content: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 480),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (item.isNewJoining)
                Container(
                  padding: const EdgeInsets.all(10),
                  margin: const EdgeInsets.only(bottom: 14),
                  decoration: BoxDecoration(
                    color: AppTheme.warningBg,
                    border: Border.all(color: AppTheme.warningBorder),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Row(
                    children: [
                      Icon(Icons.warning_amber_rounded, color: AppTheme.warning, size: 20),
                      SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          'Probationary Alert: Employee worked less than 6 months. High risk advance.',
                          style: TextStyle(fontSize: 12, color: Color(0xFF92400E), fontWeight: FontWeight.w600),
                        ),
                      ),
                    ],
                  ),
                ),
              Text('Employee Code: ${item.empCode} • Department: ${item.departmentName}', style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary)),
              Text('Reason: "${item.reason}" • Requested by: ${item.requestedByName}', style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary)),
              const Divider(height: 20),
              TextField(
                controller: amountController,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(
                  labelText: 'Approved Payout Amount (₹) *',
                  prefixText: '₹ ',
                ),
              ),
              const SizedBox(height: 14),
              TextField(
                controller: deductionController,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(
                  labelText: 'Monthly Salary Recovery Cut (₹/month)',
                  prefixText: '₹ ',
                  helperText: 'Auto-deducted from upcoming salary sheets until debt is recovered',
                ),
              ),
              const SizedBox(height: 14),
              TextField(
                controller: notesController,
                decoration: const InputDecoration(
                  labelText: 'Admin Approval Notes (Optional)',
                  hintText: 'e.g. Approved for medical emergency',
                ),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppTheme.success),
            onPressed: () async {
              try {
                final amt = double.tryParse(amountController.text) ?? item.amount;
                final cut = double.tryParse(deductionController.text) ?? 0.0;
                final res = await _api.post('/advances/requests/${item.id}/approve', {
                  'amount': amt,
                  'monthly_deduction': cut,
                  'admin_notes': notesController.text.trim(),
                });
                if (mounted) {
                  Navigator.pop(ctx);
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text(res['message'] ?? 'Advance approved & disbursed!'), backgroundColor: AppTheme.success),
                  );
                  _loadAll();
                }
              } catch (e) {
                ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString()), backgroundColor: AppTheme.danger));
              }
            },
            child: const Text('Approve & Disburse'),
          ),
        ],
      ),
    );
  }

  void _showRejectDialog(AdvanceRequestModel item) {
    final reasonController = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Reject Advance Request: ${item.empName}', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Please provide a reason for declining this request:'),
            const SizedBox(height: 12),
            TextField(
              controller: reasonController,
              decoration: const InputDecoration(
                labelText: 'Rejection Reason',
                hintText: 'e.g. Already has unpaid debt / Exceeds tenure limits',
              ),
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppTheme.danger),
            onPressed: () async {
              try {
                final res = await _api.post('/advances/requests/${item.id}/reject', {
                  'reason': reasonController.text.trim(),
                });
                if (mounted) {
                  Navigator.pop(ctx);
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text(res['message'] ?? 'Request rejected'), backgroundColor: AppTheme.danger),
                  );
                  _loadRequests();
                }
              } catch (e) {
                ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString()), backgroundColor: AppTheme.danger));
              }
            },
            child: const Text('Reject Request'),
          ),
        ],
      ),
    );
  }

  void _showDisburseAdvanceDialog(bool isAdmin) {
    showDialog(
      context: context,
      builder: (_) => _DisburseAdvanceDialog(isAdmin: isAdmin, onSuccess: _loadAll),
    );
  }

  void _showBatchChecklistModal() async {
    showDialog(
      context: context,
      builder: (_) => _BatchAdvanceDialog(onSuccess: _loadAll),
    );
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final isAdmin = auth.isAdmin;
    final pendingCount = _requests.where((r) => r.isPending).length;

    return Scaffold(
      backgroundColor: AppTheme.bgLight,
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Topbar & Actions
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Advance & Loan Ledger Management',
                      style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, letterSpacing: -0.02),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '50% earned wage limit rule checklist, multi-cycle recovery tracking, and Admin authorization',
                      style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary),
                    ),
                  ],
                ),
                Row(
                  children: [
                    ElevatedButton.icon(
                      onPressed: () => _showDisburseAdvanceDialog(isAdmin),
                      icon: const Icon(Icons.add_circle_outline, size: 16),
                      label: Text(isAdmin ? '+ Disburse Employee Advance' : '+ Request Advance'),
                      style: ElevatedButton.styleFrom(backgroundColor: AppTheme.primaryBlue),
                    ),
                    const SizedBox(width: 10),
                    ElevatedButton.icon(
                      onPressed: _showBatchChecklistModal,
                      icon: const Icon(Icons.flash_on_rounded, size: 16),
                      label: const Text('⚡ Batch Advance Checklist'),
                      style: ElevatedButton.styleFrom(backgroundColor: AppTheme.primaryNavy),
                    ),
                    const SizedBox(width: 10),
                    OutlinedButton.icon(
                      onPressed: _loadAll,
                      icon: const Icon(Icons.refresh, size: 16),
                      label: const Text('Refresh'),
                    ),
                  ],
                ),
              ],
            ),
            const SizedBox(height: 20),

            if (_error != null)
              Container(
                margin: const EdgeInsets.only(bottom: 16),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppTheme.dangerBg,
                  border: Border.all(color: AppTheme.dangerBorder),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(_error!, style: const TextStyle(color: AppTheme.danger, fontSize: 13)),
              ),

            // Financial Summary KPI Tiles (Hidden if manager)
            if (isAdmin) ...[
              LayoutBuilder(
                builder: (context, constraints) {
                  return GridView.count(
                    crossAxisCount: constraints.maxWidth > 900 ? 3 : 1,
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    crossAxisSpacing: 16,
                    mainAxisSpacing: 16,
                    childAspectRatio: 2.5,
                    children: [
                      StatCard(
                        title: 'Total Advances Disbursed',
                        value: '₹${NumberFormat('#,##0.00').format(_totalGiven)}',
                        subtitle: 'All-time company advance ledger',
                        icon: Icons.arrow_outward_rounded,
                        iconColor: AppTheme.warning,
                      ),
                      StatCard(
                        title: 'Total Recovered from Salary',
                        value: '₹${NumberFormat('#,##0.00').format(_totalDeducted)}',
                        subtitle: 'Recovered via payroll deductions',
                        icon: Icons.subdirectory_arrow_left_rounded,
                        iconColor: AppTheme.success,
                      ),
                      StatCard(
                        title: 'Net Active Debt Balance',
                        value: '₹${NumberFormat('#,##0.00').format(_netOutstanding)}',
                        subtitle: 'Unrecovered active staff debt',
                        icon: Icons.account_balance_wallet_outlined,
                        iconColor: AppTheme.primaryBlue,
                        valueColor: _netOutstanding > 0 ? AppTheme.primaryBlue : null,
                      ),
                    ],
                  );
                },
              ),
              const SizedBox(height: 20),
            ],

            // Tabs Header
            Card(
              child: Padding(
                padding: const EdgeInsets.all(8),
                child: TabBar(
                  controller: _tabController,
                  labelColor: AppTheme.primaryBlue,
                  unselectedLabelColor: AppTheme.textSecondary,
                  indicatorColor: AppTheme.primaryBlue,
                  tabs: [
                    Tab(
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(Icons.assignment_turned_in_outlined, size: 18),
                          const SizedBox(width: 8),
                          Text('Advance Requests & Approvals (${_requests.length}${pendingCount > 0 ? " • $pendingCount Pending" : ""})'),
                        ],
                      ),
                    ),
                    const Tab(
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.history_edu_rounded, size: 18),
                          SizedBox(width: 8),
                          Text('Disbursed Transactions Ledger'),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),

            // Tab Content Box
            SizedBox(
              height: 600,
              child: TabBarView(
                controller: _tabController,
                children: [
                  _buildRequestsTab(isAdmin),
                  _buildLedgerTab(),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildRequestsTab(bool isAdmin) {
    if (_loadingRequests) {
      return const Center(child: CircularProgressIndicator());
    }

    final filtered = _filteredRequests;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Filter Pills
            Row(
              children: [
                _filterChip('all', 'All (${_requests.length})'),
                const SizedBox(width: 8),
                _filterChip('pending', '⏳ Pending (${_requests.where((r) => r.isPending).length})', color: AppTheme.warning),
                const SizedBox(width: 8),
                _filterChip('approved', '✓ Approved (${_requests.where((r) => r.isApproved).length})', color: AppTheme.success),
                const SizedBox(width: 8),
                _filterChip('rejected', '✕ Rejected (${_requests.where((r) => r.isRejected).length})', color: AppTheme.danger),
              ],
            ),
            const Divider(height: 24),

            if (filtered.isEmpty)
              const Center(
                child: Padding(
                  padding: EdgeInsets.all(40),
                  child: Text('No advance requests found for the selected filter.'),
                ),
              )
            else
              Expanded(
                child: SingleChildScrollView(
                  child: Table(
                    columnWidths: {
                      0: const FlexColumnWidth(1.1),
                      1: const FlexColumnWidth(2.2),
                      2: const FlexColumnWidth(1.2),
                      3: const FlexColumnWidth(1.2),
                      4: const FlexColumnWidth(1),
                      5: const FlexColumnWidth(2),
                      6: const FlexColumnWidth(1.4),
                      if (isAdmin) 7: const FlexColumnWidth(1.8),
                    },
                    children: [
                      TableRow(
                        decoration: const BoxDecoration(color: AppTheme.bgLight),
                        children: [
                          _th('Date'),
                          _th('Employee & Joining'),
                          _th('Requested By'),
                          _th('Amount', align: TextAlign.right),
                          _th('Mode'),
                          _th('Reason / Purpose'),
                          _th('Status', align: TextAlign.center),
                          if (isAdmin) _th('Admin Action', align: TextAlign.center),
                        ],
                      ),
                      ...filtered.map((req) {
                        return TableRow(
                          decoration: BoxDecoration(
                            color: req.isNewJoining ? const Color(0xFFFFFBEB) : null,
                            border: const Border(bottom: BorderSide(color: AppTheme.borderColor)),
                          ),
                          children: [
                            _td(req.createdAt?.split('T')[0] ?? '—'),
                            Padding(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    children: [
                                      Text(req.empName, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                                      const SizedBox(width: 6),
                                      if (req.isNewJoining) CustomBadge.newJoiner(),
                                    ],
                                  ),
                                  Text('${req.empCode} • ${req.departmentName}', style: const TextStyle(fontSize: 11, color: AppTheme.textMuted)),
                                  if (req.currentAdvanceBalance > 0)
                                    Text('Debt: ₹${req.currentAdvanceBalance.toStringAsFixed(0)}', style: const TextStyle(fontSize: 10, color: AppTheme.danger, fontWeight: FontWeight.bold)),
                                ],
                              ),
                            ),
                            _td(req.requestedByName ?? 'Shift Manager'),
                            _td('₹${NumberFormat('#,##0.00').format(req.amount)}', align: TextAlign.right, bold: true, color: AppTheme.warning),
                            _td(req.mode),
                            _td(req.reason),
                            Padding(
                              padding: const EdgeInsets.symmetric(vertical: 8),
                              child: Center(
                                child: req.isApproved
                                    ? CustomBadge.success('✓ APPROVED')
                                    : req.isRejected
                                        ? CustomBadge.danger('✕ REJECTED')
                                        : CustomBadge.warning('⏳ PENDING'),
                              ),
                            ),
                            if (isAdmin)
                              Padding(
                                padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 4),
                                child: req.isPending
                                    ? Row(
                                        mainAxisAlignment: MainAxisAlignment.center,
                                        children: [
                                          ElevatedButton(
                                            onPressed: () => _showSingleApproveDialog(req),
                                            style: ElevatedButton.styleFrom(
                                              backgroundColor: AppTheme.success,
                                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                                              minimumSize: const Size(64, 28),
                                            ),
                                            child: const Text('Approve', style: TextStyle(fontSize: 11)),
                                          ),
                                          const SizedBox(width: 6),
                                          OutlinedButton(
                                            onPressed: () => _showRejectDialog(req),
                                            style: OutlinedButton.styleFrom(
                                              foregroundColor: AppTheme.danger,
                                              side: const BorderSide(color: AppTheme.danger),
                                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                                              minimumSize: const Size(60, 28),
                                            ),
                                            child: const Text('Reject', style: TextStyle(fontSize: 11)),
                                          ),
                                        ],
                                      )
                                    : Text(
                                        req.adminNotes ?? (req.isApproved ? 'Approved by Admin' : 'Rejected'),
                                        textAlign: TextAlign.center,
                                        style: const TextStyle(fontSize: 11, color: AppTheme.textMuted),
                                      ),
                              ),
                          ],
                        );
                      }),
                    ],
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildLedgerTab() {
    if (_loadingLedger) return const Center(child: CircularProgressIndicator());

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: _transactions.isEmpty
            ? const Center(child: Text('No advance transactions found.'))
            : ListView.separated(
                itemCount: _transactions.length,
                separatorBuilder: (_, __) => const Divider(height: 1),
                itemBuilder: (context, idx) {
                  final t = _transactions[idx];
                  return ListTile(
                    dense: true,
                    leading: CircleAvatar(
                      radius: 16,
                      backgroundColor: t.isGiven ? AppTheme.warningBg : AppTheme.successBg,
                      child: Icon(
                        t.isGiven ? Icons.arrow_outward_rounded : Icons.subdirectory_arrow_left_rounded,
                        size: 16,
                        color: t.isGiven ? AppTheme.warning : AppTheme.success,
                      ),
                    ),
                    title: Text(t.empName ?? 'Emp #${t.empId}', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                    subtitle: Text(
                      '${t.date.split("T")[0]} • ${t.remarks} ${t.monthlyDeduction > 0 ? "• ₹${t.monthlyDeduction.toStringAsFixed(0)}/mo" : ""}',
                      style: const TextStyle(fontSize: 11, color: AppTheme.textMuted),
                    ),
                    trailing: Text(
                      '${t.isGiven ? "+" : "-"}₹${NumberFormat("#,##0.00").format(t.amount)}',
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 13,
                        color: t.isGiven ? AppTheme.warning : AppTheme.success,
                      ),
                    ),
                  );
                },
              ),
      ),
    );
  }

  Widget _filterChip(String status, String label, {Color color = AppTheme.primaryNavy}) {
    final active = _requestStatusFilter == status;
    return InkWell(
      onTap: () => setState(() => _requestStatusFilter = status),
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

// Batch Advance Checklist Dialog Modal
class _BatchAdvanceDialog extends StatefulWidget {
  final VoidCallback onSuccess;
  const _BatchAdvanceDialog({required this.onSuccess});

  @override
  State<_BatchAdvanceDialog> createState() => _BatchAdvanceDialogState();
}

class _BatchAdvanceDialogState extends State<_BatchAdvanceDialog> {
  final ApiService _api = ApiService();
  bool _loading = true;
  bool _submitting = false;
  List<dynamic> _employees = [];
  final Set<int> _selectedIds = {};
  final Map<int, String> _customAmounts = {};
  String _recoveryMode = 'installment'; // installment, full
  final _monthlyCutController = TextEditingController(text: '2000');

  @override
  void initState() {
    super.initState();
    _loadList();
  }

  @override
  void dispose() {
    _monthlyCutController.dispose();
    super.dispose();
  }

  Future<void> _loadList() async {
    try {
      final res = await _api.get('/advances/eligibility-list');
      if (res != null && res['data'] != null) {
        setState(() {
          _employees = res['data'] as List<dynamic>;
          for (final e in _employees) {
            _customAmounts[e['id']] = (e['max_advance_allowed'] ?? 0).toString();
          }
          _loading = false;
        });
      }
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  Future<void> _submitBatch() async {
    if (_selectedIds.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Please select at least one employee')));
      return;
    }

    setState(() => _submitting = true);
    final cutAmt = _recoveryMode == 'installment' ? (double.tryParse(_monthlyCutController.text) ?? 2000.0) : 0.0;

    final items = _selectedIds.map((id) {
      final emp = _employees.firstWhere((e) => e['id'] == id);
      final amt = double.tryParse(_customAmounts[id] ?? '') ?? (emp['max_advance_allowed'] ?? 0.0);
      final isUnder6M = emp['is_new_joining'] == 1 || emp['is_new_joining'] == true;

      return {
        'emp_id': id,
        'amount': amt,
        'monthly_deduction': cutAmt,
        'mode': 'cash',
        'reason': isUnder6M
            ? 'Batch request (Probationary < 6M service • 50% cap)'
            : 'Batch advance request (50% earned wage rule)',
      };
    }).toList();

    try {
      final res = await _api.post('/advances/request-batch', {'items': items});
      if (mounted) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(res['message'] ?? 'Successfully submitted batch requests!'), backgroundColor: AppTheme.success),
        );
        widget.onSuccess();
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString()), backgroundColor: AppTheme.danger));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 1000, maxHeight: 720),
        child: Column(
          children: [
            // Modal Header
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
              decoration: const BoxDecoration(
                color: AppTheme.primaryNavy,
                borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.flash_on_rounded, color: Colors.white, size: 24),
                  const SizedBox(width: 12),
                  const Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Active Employees Advance Checklist', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16)),
                      Text('50% earned wage rule checklist & automated recovery installments', style: TextStyle(color: Colors.white70, fontSize: 11)),
                    ],
                  ),
                  const Spacer(),
                  IconButton(
                    icon: const Icon(Icons.close, color: Colors.white),
                    onPressed: () => Navigator.pop(context),
                  ),
                ],
              ),
            ),

            // Table of Eligible Employees
            Expanded(
              child: _loading
                  ? const Center(child: CircularProgressIndicator())
                  : ListView.separated(
                      padding: const EdgeInsets.all(16),
                      itemCount: _employees.length,
                      separatorBuilder: (_, __) => const Divider(height: 1),
                      itemBuilder: (context, idx) {
                        final emp = _employees[idx];
                        final id = emp['id'] as int;
                        final isSelected = _selectedIds.contains(id);
                        final isNew = emp['is_new_joining'] == 1 || emp['is_new_joining'] == true;
                        final cap = double.tryParse(emp['max_advance_allowed']?.toString() ?? '0') ?? 0.0;
                        final debt = double.tryParse(emp['current_balance']?.toString() ?? '0') ?? 0.0;

                        return CheckboxListTile(
                          value: isSelected,
                          onChanged: (val) {
                            setState(() {
                              if (val == true) {
                                _selectedIds.add(id);
                              } else {
                                _selectedIds.remove(id);
                              }
                            });
                          },
                          title: Row(
                            children: [
                              Text(emp['name'] ?? '', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                              const SizedBox(width: 6),
                              Text('(${emp['emp_code']})', style: const TextStyle(fontSize: 12, color: AppTheme.textMuted)),
                              const SizedBox(width: 8),
                              if (isNew) CustomBadge.newJoiner(),
                            ],
                          ),
                          subtitle: Text(
                            'Worked: ${emp['days_worked'] ?? 0}d  •  50% Cap: ₹${cap.toStringAsFixed(0)}  •  Existing Debt: ₹${debt.toStringAsFixed(0)}',
                            style: const TextStyle(fontSize: 11),
                          ),
                          secondary: SizedBox(
                            width: 110,
                            child: TextField(
                              decoration: const InputDecoration(
                                prefixText: '₹ ',
                                contentPadding: EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                              ),
                              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12),
                              controller: TextEditingController(text: _customAmounts[id]),
                              onChanged: (v) {
                                _customAmounts[id] = v;
                                if (!isSelected) setState(() => _selectedIds.add(id));
                              },
                            ),
                          ),
                        );
                      },
                    ),
            ),

            // Recovery Terms Bar
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
              color: const Color(0xFFEFF6FF),
              child: Row(
                children: [
                  const Text('Recovery Terms: ', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: AppTheme.primaryBlue)),
                  const SizedBox(width: 10),
                  ChoiceChip(
                    label: const Text('Fixed Monthly Cut'),
                    selected: _recoveryMode == 'installment',
                    onSelected: (_) => setState(() => _recoveryMode = 'installment'),
                  ),
                  const SizedBox(width: 10),
                  if (_recoveryMode == 'installment')
                    SizedBox(
                      width: 100,
                      child: TextField(
                        controller: _monthlyCutController,
                        keyboardType: TextInputType.number,
                        decoration: const InputDecoration(
                          prefixText: '₹ ',
                          suffixText: '/mo',
                          contentPadding: EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        ),
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12),
                      ),
                    ),
                  const SizedBox(width: 14),
                  ChoiceChip(
                    label: const Text('Full Deduction Next Month'),
                    selected: _recoveryMode == 'full',
                    onSelected: (_) => setState(() => _recoveryMode = 'full'),
                  ),
                ],
              ),
            ),

            // Sticky Bottom Bar
            Container(
              padding: const EdgeInsets.all(16),
              decoration: const BoxDecoration(
                border: Border(top: BorderSide(color: AppTheme.borderColor)),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text('${_selectedIds.length} employee(s) checkmarked', style: const TextStyle(fontWeight: FontWeight.bold)),
                  ElevatedButton.icon(
                    onPressed: _submitting ? null : _submitBatch,
                    icon: const Icon(Icons.send_rounded, size: 16),
                    label: Text(_submitting ? 'Submitting...' : 'Submit Batch Advance Requests'),
                    style: ElevatedButton.styleFrom(backgroundColor: AppTheme.success),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// Disburse Individual Employee Advance Dialog (50% Earned Wage Rule & Structured Recovery)
class _DisburseAdvanceDialog extends StatefulWidget {
  final bool isAdmin;
  final VoidCallback onSuccess;

  const _DisburseAdvanceDialog({
    required this.isAdmin,
    required this.onSuccess,
  });

  @override
  State<_DisburseAdvanceDialog> createState() => _DisburseAdvanceDialogState();
}

class _DisburseAdvanceDialogState extends State<_DisburseAdvanceDialog> {
  final ApiService _api = ApiService();
  bool _loadingEmployees = true;
  bool _loadingSummary = false;
  bool _submitting = false;
  String? _error;

  List<EmployeeModel> _employees = [];
  EmployeeModel? _selectedEmployee;
  Map<String, dynamic>? _summary;

  final TextEditingController _amountController = TextEditingController();
  final TextEditingController _monthlyCutController = TextEditingController(text: '1000');
  final TextEditingController _reasonController = TextEditingController();

  DateTime _disbursementDate = DateTime.now();
  String _paymentMode = 'cash';
  String _deductionTermType = 'installment'; // 'full' or 'installment'

  @override
  void initState() {
    super.initState();
    _loadEmployees();
    _amountController.addListener(() {
      setState(() {});
    });
    _monthlyCutController.addListener(() {
      setState(() {});
    });
  }

  @override
  void dispose() {
    _amountController.dispose();
    _monthlyCutController.dispose();
    _reasonController.dispose();
    super.dispose();
  }

  Future<void> _loadEmployees() async {
    try {
      final res = await _api.get('/employees?status=active');
      if (res != null && res['data'] != null) {
        final list = (res['data'] as List).map((e) => EmployeeModel.fromJson(e)).toList();
        setState(() {
          _employees = list;
          _loadingEmployees = false;
        });
      }
    } catch (e) {
      setState(() {
        _error = 'Failed to load employees: $e';
        _loadingEmployees = false;
      });
    }
  }

  Future<void> _onEmployeeChanged(EmployeeModel? emp) async {
    setState(() {
      _selectedEmployee = emp;
      _summary = null;
      _loadingSummary = emp != null;
    });

    if (emp == null) return;

    try {
      final res = await _api.get('/advances/employee-summary/${emp.id}');
      if (res != null && res['data'] != null) {
        setState(() {
          _summary = res['data'];
          _loadingSummary = false;
          final existingCut = double.tryParse(_summary!['monthly_advance_deduction']?.toString() ?? '0') ?? 0;
          if (existingCut > 0) {
            _monthlyCutController.text = existingCut.toStringAsFixed(0);
          }
        });
      }
    } catch (_) {
      setState(() => _loadingSummary = false);
    }
  }

  Future<void> _submitAdvance() async {
    if (_selectedEmployee == null) {
      setState(() => _error = 'Please select an employee');
      return;
    }

    final amount = double.tryParse(_amountController.text.trim()) ?? 0;
    if (amount <= 0) {
      setState(() => _error = 'Please enter a valid amount greater than 0');
      return;
    }

    final maxAdvance = double.tryParse(_summary?['max_advance_allowed']?.toString() ?? '0') ?? 0;
    final isOverLimit = amount > maxAdvance;

    setState(() {
      _submitting = true;
      _error = null;
    });

    try {
      final monthlyCut = _deductionTermType == 'installment'
          ? (double.tryParse(_monthlyCutController.text.trim()) ?? 0)
          : 0;

      if (widget.isAdmin) {
        await _api.post('/advances', {
          'emp_id': _selectedEmployee!.id,
          'date': DateFormat('yyyy-MM-dd').format(_disbursementDate),
          'type': 'given',
          'amount': amount,
          'mode': _paymentMode,
          'remarks': _reasonController.text.trim().isNotEmpty
              ? _reasonController.text.trim()
              : (isOverLimit ? 'Extra advance authorized by Admin' : 'Advance disbursed'),
          'is_extra_advance': isOverLimit,
          'monthly_deduction': monthlyCut,
        });
      } else {
        await _api.post('/advances/request', {
          'emp_id': _selectedEmployee!.id,
          'amount': amount,
          'mode': _paymentMode,
          'reason': _reasonController.text.trim().isNotEmpty ? _reasonController.text.trim() : 'Manager advance request',
          'monthly_deduction': monthlyCut,
        });
      }

      if (mounted) {
        Navigator.pop(context);
        widget.onSuccess();
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(widget.isAdmin ? '✓ Advance successfully disbursed to ${_selectedEmployee!.name}!' : '✓ Advance request submitted to Admin!'),
            backgroundColor: AppTheme.success,
          ),
        );
      }
    } catch (e) {
      setState(() {
        _error = e.toString();
        _submitting = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final enteredAmount = double.tryParse(_amountController.text.trim()) ?? 0.0;
    final maxAdvance = double.tryParse(_summary?['max_advance_allowed']?.toString() ?? '0') ?? 0.0;
    final isOverLimit = enteredAmount > maxAdvance;
    final existingDebt = double.tryParse(_summary?['current_balance']?.toString() ?? '0') ?? 0.0;
    final totalCombinedDebt = existingDebt + enteredAmount;
    final monthlyCut = double.tryParse(_monthlyCutController.text.trim()) ?? 0.0;
    final recoveryMonths = (totalCombinedDebt > 0 && monthlyCut > 0)
        ? (totalCombinedDebt / monthlyCut).ceil()
        : 1;

    final isNewJoining = _summary?['is_new_joining'] == true ||
        (_selectedEmployee != null && _selectedEmployee!.isNewJoining);

    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 560),
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
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: AppTheme.primaryBlue,
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: const Icon(Icons.account_balance_wallet, color: Colors.white, size: 20),
                      ),
                      const SizedBox(width: 12),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            widget.isAdmin ? 'Disburse Employee Advance' : 'Request Employee Advance',
                            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800, letterSpacing: -0.02),
                          ),
                          Text(
                            widget.isAdmin
                                ? '50% earned wage limit rule & structured recovery'
                                : 'Manager Request • Submitted to Admin for Approval',
                            style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary),
                          ),
                        ],
                      ),
                    ],
                  ),
                  IconButton(
                    icon: const Icon(Icons.close),
                    onPressed: () => Navigator.pop(context),
                  ),
                ],
              ),
              const Divider(height: 24),

              if (_error != null)
                Container(
                  margin: const EdgeInsets.only(bottom: 16),
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppTheme.dangerBg,
                    border: Border.all(color: AppTheme.dangerBorder),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(_error!, style: const TextStyle(color: AppTheme.danger, fontSize: 13)),
                ),

              // Select Employee Dropdown
              const Text('Select Employee (Enter ID / Code) *', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
              const SizedBox(height: 6),
              if (_loadingEmployees)
                const LinearProgressIndicator()
              else
                DropdownButtonFormField<EmployeeModel>(
                  value: _selectedEmployee,
                  decoration: const InputDecoration(
                    prefixIcon: Icon(Icons.person_outline, size: 20),
                    hintText: 'Select employee...',
                    contentPadding: EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                  ),
                  isExpanded: true,
                  items: _employees.map((emp) {
                    return DropdownMenuItem<EmployeeModel>(
                      value: emp,
                      child: Text(
                        '${emp.empCode} • ${emp.name} (${emp.departmentName ?? "Staff"})',
                        style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
                        overflow: TextOverflow.ellipsis,
                      ),
                    );
                  }).toList(),
                  onChanged: _onEmployeeChanged,
                ),
              const SizedBox(height: 14),

              // High-Risk Tenure Warning (< 6M Service)
              if (isNewJoining)
                Container(
                  margin: const EdgeInsets.only(bottom: 14),
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppTheme.warningBg,
                    border: Border.all(color: AppTheme.warningBorder, width: 1.5),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        padding: const EdgeInsets.all(6),
                        decoration: BoxDecoration(
                          color: AppTheme.warning,
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: const Icon(Icons.warning_amber_rounded, color: Colors.white, size: 16),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                const Text('⚠️ TENURE NOTICE: WORKED LESS THAN 6 MONTHS', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 12, color: Color(0xFF92400E))),
                                const SizedBox(width: 8),
                                CustomBadge.newJoiner(),
                              ],
                            ),
                            const SizedBox(height: 4),
                            Text(
                              widget.isAdmin
                                  ? 'High-risk tenure: Employee has less than 6 months service. Special Admin discretion required before disbursing advance.'
                                  : 'High-risk tenure: Employee has worked less than 6 months. This request will be highlighted in amber for Admin authorization.',
                              style: const TextStyle(fontSize: 11, color: Color(0xFF78350F)),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),

              // Live 50% Earned Wage Rule Card
              if (_loadingSummary)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 12),
                  child: Center(child: Text('Checking attendance and 50% eligibility...', style: TextStyle(fontSize: 12, color: AppTheme.textSecondary))),
                )
              else if (_summary != null)
                Container(
                  margin: const EdgeInsets.only(bottom: 14),
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF0FDF4),
                    border: Border.all(color: const Color(0xFFBFDBFE)),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text('⚡ LIVE 50% EARNED WAGE RULE', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: Color(0xFF1E40AF))),
                          if (isNewJoining) CustomBadge.newJoiner(),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text('Worked This Month: ${_summary?['days_worked'] ?? 0} days', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                          Text('Earned So Far: ₹${NumberFormat('#,##0').format(_summary?['earned_so_far'] ?? 0)}', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text('Standard Cap (50%): ₹${NumberFormat('#,##0').format(maxAdvance)}', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppTheme.primaryBlue)),
                          Text('Existing Outstanding: ₹${NumberFormat('#,##0').format(existingDebt)}', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: existingDebt > 0 ? AppTheme.danger : AppTheme.textSecondary)),
                        ],
                      ),
                      if (isOverLimit)
                        Container(
                          margin: const EdgeInsets.only(top: 10),
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: const Color(0xFFFEF3C7),
                            border: Border.all(color: const Color(0xFFF59E0B)),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Row(
                            children: [
                              const Icon(Icons.warning_amber_rounded, size: 16, color: Color(0xFFB45309)),
                              const SizedBox(width: 6),
                              Expanded(
                                child: Text(
                                  widget.isAdmin
                                      ? '⚠️ Exceeds 50% cap by ₹${NumberFormat('#,##0').format(enteredAmount - maxAdvance)}. As Admin, you can authorize this Extra Advance.'
                                      : '⚠️ Exceeds 50% cap by ₹${NumberFormat('#,##0').format(enteredAmount - maxAdvance)}. Submitting as Extra Advance for Admin authorization.',
                                  style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF92400E)),
                                ),
                              ),
                            ],
                          ),
                        )
                      else if (enteredAmount > 0 && maxAdvance > 0)
                        Container(
                          margin: const EdgeInsets.only(top: 8),
                          padding: const EdgeInsets.all(6),
                          decoration: BoxDecoration(
                            color: AppTheme.successBg,
                            border: Border.all(color: AppTheme.successBorder),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Row(
                            children: [
                              const Icon(Icons.check_circle_outline, size: 14, color: AppTheme.success),
                              const SizedBox(width: 6),
                              Text('✓ Within standard 50% cap (Eligible up to ₹${NumberFormat('#,##0').format(maxAdvance)}).', style: const TextStyle(fontSize: 11, color: AppTheme.success, fontWeight: FontWeight.w600)),
                            ],
                          ),
                        ),
                    ],
                  ),
                ),

              // Amount & Disbursement Date Row
              Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Amount (₹) *', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                        const SizedBox(height: 6),
                        TextField(
                          controller: _amountController,
                          keyboardType: const TextInputType.numberWithOptions(decimal: true),
                          decoration: const InputDecoration(
                            hintText: 'e.g. 4000',
                            prefixText: '₹ ',
                            contentPadding: EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                          ),
                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(widget.isAdmin ? 'Disbursement Date' : 'Request Date', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                        const SizedBox(height: 6),
                        InkWell(
                          onTap: () async {
                            final picked = await showDatePicker(
                              context: context,
                              initialDate: _disbursementDate,
                              firstDate: DateTime(2020),
                              lastDate: DateTime(2035),
                            );
                            if (picked != null) {
                              setState(() => _disbursementDate = picked);
                            }
                          },
                          child: InputDecorator(
                            decoration: const InputDecoration(
                              suffixIcon: Icon(Icons.calendar_today, size: 18),
                              contentPadding: EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                            ),
                            child: Text(DateFormat('yyyy-MM-dd').format(_disbursementDate), style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),

              // Structured Automated Salary Cut Terms
              if (widget.isAdmin)
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
                      const Row(
                        children: [
                          Icon(Icons.calendar_month_outlined, size: 16, color: AppTheme.primaryBlue),
                          SizedBox(width: 6),
                          Text('Automated Salary Cut Terms', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                        ],
                      ),
                      const SizedBox(height: 10),
                      RadioListTile<String>(
                        dense: true,
                        title: const Text('Full Deduction in Upcoming Salary Cycle', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                        subtitle: const Text('Deduct the full advance amount in the next salary run up to earned wages.', style: TextStyle(fontSize: 11, color: AppTheme.textSecondary)),
                        value: 'full',
                        groupValue: _deductionTermType,
                        onChanged: (val) => setState(() => _deductionTermType = val!),
                        contentPadding: EdgeInsets.zero,
                      ),
                      RadioListTile<String>(
                        dense: true,
                        title: const Text('Fixed Monthly Installments (Recommended)', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                        subtitle: const Text('Automatically cut a fixed monthly amount from each salary sheet until debt is fully cleared.', style: TextStyle(fontSize: 11, color: AppTheme.textSecondary)),
                        value: 'installment',
                        groupValue: _deductionTermType,
                        onChanged: (val) => setState(() => _deductionTermType = val!),
                        contentPadding: EdgeInsets.zero,
                      ),
                      if (_deductionTermType == 'installment')
                        Container(
                          margin: const EdgeInsets.only(top: 8),
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(
                            color: const Color(0xFFEFF6FF),
                            border: Border.all(color: const Color(0xFFBFDBFE)),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Row(
                                children: [
                                  const Text('Monthly Salary Cut: ', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF1E40AF))),
                                  SizedBox(
                                    width: 100,
                                    height: 34,
                                    child: TextField(
                                      controller: _monthlyCutController,
                                      keyboardType: TextInputType.number,
                                      decoration: const InputDecoration(
                                        prefixText: '₹ ',
                                        suffixText: '/mo',
                                        contentPadding: EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                      ),
                                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                                    ),
                                  ),
                                ],
                              ),
                              if (totalCombinedDebt > 0 && monthlyCut > 0)
                                Text('Recovers ₹${NumberFormat('#,##0').format(totalCombinedDebt)} in ~$recoveryMonths mo.', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF1D4ED8))),
                            ],
                          ),
                        ),
                    ],
                  ),
                ),
              const SizedBox(height: 14),

              // Payment Mode & Remarks
              Row(
                children: [
                  Expanded(
                    flex: 1,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Payment Mode', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                        const SizedBox(height: 6),
                        DropdownButtonFormField<String>(
                          value: _paymentMode,
                          decoration: const InputDecoration(
                            contentPadding: EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                          ),
                          items: const [
                            DropdownMenuItem(value: 'cash', child: Text('💵 Cash', style: TextStyle(fontSize: 13))),
                            DropdownMenuItem(value: 'bank', child: Text('🏦 Bank Transfer', style: TextStyle(fontSize: 13))),
                            DropdownMenuItem(value: 'upi', child: Text('📱 UPI / Online', style: TextStyle(fontSize: 13))),
                            DropdownMenuItem(value: 'cheque', child: Text('📑 Cheque', style: TextStyle(fontSize: 13))),
                          ],
                          onChanged: (val) => setState(() => _paymentMode = val ?? 'cash'),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    flex: 2,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Reason / Remarks', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                        const SizedBox(height: 6),
                        TextField(
                          controller: _reasonController,
                          decoration: const InputDecoration(
                            hintText: 'e.g. Festival advance, emergency',
                            contentPadding: EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                          ),
                          style: const TextStyle(fontSize: 13),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 24),

              // Action Buttons
              Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  OutlinedButton(
                    onPressed: () => Navigator.pop(context),
                    child: const Text('Cancel'),
                  ),
                  const SizedBox(width: 12),
                  ElevatedButton(
                    onPressed: _submitting ? null : _submitAdvance,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: isOverLimit
                          ? (widget.isAdmin ? const Color(0xFFD97706) : AppTheme.primaryNavy)
                          : AppTheme.primaryBlue,
                      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
                    ),
                    child: Text(
                      _submitting
                          ? 'Processing...'
                          : widget.isAdmin
                              ? (isOverLimit ? 'Authorize Extra Advance' : 'Disburse Advance')
                              : 'Submit Advance Request',
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
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
