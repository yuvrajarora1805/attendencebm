import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../models/employee_model.dart';
import '../services/api_service.dart';
import '../services/auth_provider.dart';
import '../theme/app_theme.dart';
import '../widgets/custom_badge.dart';
import 'employee_profile_screen.dart';

class EmployeesScreen extends StatefulWidget {
  const EmployeesScreen({super.key});

  @override
  State<EmployeesScreen> createState() => _EmployeesScreenState();
}

class _EmployeesScreenState extends State<EmployeesScreen> {
  final ApiService _api = ApiService();
  final _searchController = TextEditingController();

  bool _loading = true;
  String? _error;
  List<EmployeeModel> _allEmployees = [];
  List<EmployeeModel> _filteredEmployees = [];

  String _selectedDept = 'all';
  String _filterTenure = 'all'; // all, under6m, regular
  String _filterStatus = 'active'; // all, active, inactive
  List<String> _departments = [];

  @override
  void initState() {
    super.initState();
    _loadEmployees();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _loadEmployees() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final res = await _api.get('/employees?status=$_filterStatus');
      if (res != null && res['data'] != null) {
        final list = (res['data'] as List<dynamic>)
            .map((e) => EmployeeModel.fromJson(e as Map<String, dynamic>))
            .toList();

        final depts = <String>{};
        for (final emp in list) {
          if (emp.departmentName != null && emp.departmentName!.isNotEmpty) {
            depts.add(emp.departmentName!);
          }
        }

        setState(() {
          _allEmployees = list;
          _departments = depts.toList()..sort();
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
    final query = _searchController.text.trim().toLowerCase();

    setState(() {
      _filteredEmployees = _allEmployees.filter((emp) {
        final matchesQuery = query.isEmpty ||
            emp.name.toLowerCase().contains(query) ||
            emp.empCode.toLowerCase().contains(query);

        final matchesDept = _selectedDept == 'all' || emp.departmentName == _selectedDept;

        final matchesTenure = _filterTenure == 'all' ||
            (_filterTenure == 'under6m' && emp.isNewJoining) ||
            (_filterTenure == 'regular' && !emp.isNewJoining);

        return matchesQuery && matchesDept && matchesTenure;
      }).toList();
    });
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final isAdmin = auth.isAdmin;

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
                    const Text(
                      'Workforce & Employee Directory',
                      style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, letterSpacing: -0.02),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'Manage active staff, probationary service tracking, and payroll master records',
                      style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary),
                    ),
                  ],
                ),
                OutlinedButton.icon(
                  onPressed: _loadEmployees,
                  icon: const Icon(Icons.refresh, size: 16),
                  label: const Text('Refresh Directory'),
                ),
              ],
            ),
            const SizedBox(height: 20),

            // Filter Bar Card
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Row(
                  children: [
                    // Search Input
                    Expanded(
                      flex: 2,
                      child: TextField(
                        controller: _searchController,
                        decoration: const InputDecoration(
                          hintText: 'Search by employee name or code (e.g. 15046)...',
                          prefixIcon: Icon(Icons.search, size: 20),
                        ),
                        onChanged: (_) => _applyFilters(),
                      ),
                    ),
                    const SizedBox(width: 14),

                    // Dept Filter
                    DropdownButton<String>(
                      value: _selectedDept,
                      underline: const SizedBox(),
                      items: [
                        const DropdownMenuItem(value: 'all', child: Text('All Departments')),
                        ..._departments.map((d) => DropdownMenuItem(value: d, child: Text(d))),
                      ],
                      onChanged: (val) {
                        setState(() => _selectedDept = val ?? 'all');
                        _applyFilters();
                      },
                    ),
                    const SizedBox(width: 14),

                    // Tenure Filter (<6M vs Regular)
                    DropdownButton<String>(
                      value: _filterTenure,
                      underline: const SizedBox(),
                      items: const [
                        DropdownMenuItem(value: 'all', child: Text('All Tenures')),
                        DropdownMenuItem(value: 'under6m', child: Text('⚠️ < 6M Service (Probationary)')),
                        DropdownMenuItem(value: 'regular', child: Text('✓ Regular (> 6 Months)')),
                      ],
                      onChanged: (val) {
                        setState(() => _filterTenure = val ?? 'all');
                        _applyFilters();
                      },
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 20),

            // Table Card
            Card(
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          'Active Employees (${_filteredEmployees.length})',
                          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                        ),
                        Text(
                          'Showing ${_filteredEmployees.length} of ${_allEmployees.length} staff',
                          style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary),
                        ),
                      ],
                    ),
                    const Divider(height: 20),

                    if (_loading)
                      const Center(child: Padding(padding: EdgeInsets.all(40), child: CircularProgressIndicator()))
                    else if (_filteredEmployees.isEmpty)
                      const Center(
                        child: Padding(
                          padding: EdgeInsets.all(40),
                          child: Text('No employees found matching the filter criteria.'),
                        ),
                      )
                    else
                      Table(
                        columnWidths: {
                          0: const FlexColumnWidth(2.2),
                          1: const FlexColumnWidth(1.6),
                          2: const FlexColumnWidth(1.4),
                          if (isAdmin) 3: const FlexColumnWidth(1.4),
                          if (isAdmin) 4: const FlexColumnWidth(1.2),
                          5: const FlexColumnWidth(1.2),
                        },
                        children: [
                          TableRow(
                            decoration: const BoxDecoration(color: AppTheme.bgLight),
                            children: [
                              _th('Employee Details'),
                              _th('Department / Role'),
                              _th('Joining & Tenure'),
                              if (isAdmin) _th('Basic Salary', align: TextAlign.right),
                              if (isAdmin) _th('Per Day', align: TextAlign.right),
                              _th('Actions', align: TextAlign.center),
                            ],
                          ),
                          ..._filteredEmployees.map((emp) {
                            return TableRow(
                              decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: AppTheme.borderColor))),
                              children: [
                                // Employee Name & Code
                                Padding(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 12),
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Row(
                                        children: [
                                          Text(emp.name, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                                          const SizedBox(width: 6),
                                          if (emp.isNewJoining) CustomBadge.newJoiner(),
                                        ],
                                      ),
                                      Text('Code: ${emp.empCode}', style: const TextStyle(fontSize: 11, color: AppTheme.textMuted)),
                                    ],
                                  ),
                                ),

                                // Department & Job Role
                                Padding(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 12),
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(emp.departmentName ?? 'Staff', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                                      Text(emp.jobRole ?? 'Worker', style: const TextStyle(fontSize: 11, color: AppTheme.textSecondary)),
                                    ],
                                  ),
                                ),

                                // Joining Date & Tenure
                                Padding(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 12),
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(emp.joiningDate?.split('T')[0] ?? '—', style: const TextStyle(fontSize: 12)),
                                      Text(
                                        emp.tenureDays > 0 ? '${(emp.tenureDays / 365).toStringAsFixed(1)} Yrs service' : 'Recent Joiner',
                                        style: TextStyle(
                                          fontSize: 11,
                                          color: emp.isNewJoining ? AppTheme.warning : AppTheme.textMuted,
                                          fontWeight: emp.isNewJoining ? FontWeight.bold : FontWeight.normal,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),

                                // Basic Salary (Admin only)
                                if (isAdmin)
                                  _td('₹${NumberFormat('#,##0.00').format(emp.basicSalary)}', align: TextAlign.right, bold: true),

                                // Salary Per Day (Admin only)
                                if (isAdmin)
                                  _td('₹${NumberFormat('#,##0.00').format(emp.salaryPerDay)}', align: TextAlign.right),

                                // Action Button
                                Padding(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
                                  child: Center(
                                    child: OutlinedButton(
                                      onPressed: () {
                                        Navigator.push(
                                          context,
                                          MaterialPageRoute(
                                            builder: (_) => EmployeeProfileScreen(employeeId: emp.id),
                                          ),
                                        );
                                      },
                                      style: OutlinedButton.styleFrom(
                                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                        minimumSize: const Size(60, 30),
                                      ),
                                      child: const Text('Profile', style: TextStyle(fontSize: 11)),
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
      child: Text(
        label,
        textAlign: align,
        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: AppTheme.textSecondary),
      ),
    );
  }

  Widget _td(String val, {TextAlign align = TextAlign.left, bool bold = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 12),
      child: Text(
        val,
        textAlign: align,
        style: TextStyle(
          fontSize: 12,
          fontWeight: bold ? FontWeight.bold : FontWeight.normal,
        ),
      ),
    );
  }
}

extension ListFilter<T> on List<T> {
  List<T> filter(bool Function(T) test) {
    return where(test).toList();
  }
}
