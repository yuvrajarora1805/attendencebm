class SalaryPeriodModel {
  final int id;
  final int month;
  final int year;
  final String status; // draft, finalized
  final bool isLocked;
  final bool isReleased;
  final double totalPayable;
  final int totalEmployees;
  final String groupName;

  SalaryPeriodModel({
    required this.id,
    required this.month,
    required this.year,
    required this.status,
    this.isLocked = false,
    this.isReleased = false,
    this.totalPayable = 0.0,
    this.totalEmployees = 0,
    required this.groupName,
  });

  factory SalaryPeriodModel.fromJson(Map<String, dynamic> json) {
    return SalaryPeriodModel(
      id: json['id'] is int ? json['id'] : int.tryParse(json['id'].toString()) ?? 0,
      month: json['month'] is int ? json['month'] : int.tryParse(json['month'].toString()) ?? 1,
      year: json['year'] is int ? json['year'] : int.tryParse(json['year'].toString()) ?? 2026,
      status: json['status']?.toString().toLowerCase() ?? 'draft',
      isLocked: json['is_locked'] == 1 || json['is_locked'] == true,
      isReleased: json['is_released'] == 1 || json['is_released'] == true,
      totalPayable: double.tryParse(json['total_payable']?.toString() ?? '0') ?? 0.0,
      totalEmployees: json['total_employees'] is int ? json['total_employees'] : int.tryParse(json['total_employees']?.toString() ?? '0') ?? 0,
      groupName: json['group_name']?.toString() ?? '${json['month']}/${json['year']}',
    );
  }
}

class SalaryEntryModel {
  final int id;
  final int periodId;
  final int empId;
  final String empName;
  final String empCode;
  final String? departmentName;
  final double basicSalary;
  final double salaryPerDay;
  final double presentDays;
  final double actualLeaves;
  final double finalLeaves;
  final double leavesAmount;
  final double advanceGiven;
  final double advanceDeduction;
  final double advanceCf;
  final double grossAmount; // Net payable
  final String? deductionRemarks;
  final String? snapshotJson;
  final bool isNewJoining;

  SalaryEntryModel({
    required this.id,
    required this.periodId,
    required this.empId,
    required this.empName,
    required this.empCode,
    this.departmentName,
    required this.basicSalary,
    required this.salaryPerDay,
    required this.presentDays,
    required this.actualLeaves,
    required this.finalLeaves,
    required this.leavesAmount,
    this.advanceGiven = 0.0,
    required this.advanceDeduction,
    required this.advanceCf,
    required this.grossAmount,
    this.deductionRemarks,
    this.snapshotJson,
    this.isNewJoining = false,
  });

  factory SalaryEntryModel.fromJson(Map<String, dynamic> json) {
    return SalaryEntryModel(
      id: json['id'] is int ? json['id'] : int.tryParse(json['id'].toString()) ?? 0,
      periodId: json['period_id'] is int ? json['period_id'] : int.tryParse(json['period_id'].toString()) ?? 0,
      empId: json['emp_id'] is int ? json['emp_id'] : int.tryParse(json['emp_id'].toString()) ?? 0,
      empName: json['emp_name']?.toString() ?? json['name']?.toString() ?? '',
      empCode: json['emp_code']?.toString() ?? '',
      departmentName: json['department_name']?.toString() ?? json['dept_name']?.toString(),
      basicSalary: double.tryParse(json['basic_salary']?.toString() ?? '0') ?? 0.0,
      salaryPerDay: double.tryParse(json['salary_per_day']?.toString() ?? '0') ?? 0.0,
      presentDays: double.tryParse(json['present_days']?.toString() ?? '0') ?? 0.0,
      actualLeaves: double.tryParse(json['actual_leaves']?.toString() ?? '0') ?? 0.0,
      finalLeaves: double.tryParse(json['final_leaves']?.toString() ?? '0') ?? 0.0,
      leavesAmount: double.tryParse(json['leaves_amount']?.toString() ?? '0') ?? 0.0,
      advanceGiven: double.tryParse(json['advance_given']?.toString() ?? '0') ?? 0.0,
      advanceDeduction: double.tryParse(json['advance_deduction']?.toString() ?? '0') ?? 0.0,
      advanceCf: double.tryParse(json['advance_cf']?.toString() ?? '0') ?? 0.0,
      grossAmount: double.tryParse(json['gross_amount']?.toString() ?? '0') ?? 0.0,
      deductionRemarks: json['deduction_remarks']?.toString(),
      snapshotJson: json['snapshot_json']?.toString(),
      isNewJoining: json['is_new_joining'] == 1 || json['is_new_joining'] == true,
    );
  }
}

