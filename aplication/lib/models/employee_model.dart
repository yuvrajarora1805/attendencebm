class EmployeeModel {
  final int id;
  final String empCode;
  final String name;
  final String? departmentName;
  final String? jobRole;
  final double basicSalary;
  final double salaryPerDay;
  final String? joiningDate;
  final bool isNewJoining;
  final int tenureDays;
  final String status;
  final double currentBalance;
  final double maxAdvanceAllowed;
  final double daysWorked;
  final double earnedSoFar;

  EmployeeModel({
    required this.id,
    required this.empCode,
    required this.name,
    this.departmentName,
    this.jobRole,
    this.basicSalary = 0.0,
    this.salaryPerDay = 0.0,
    this.joiningDate,
    this.isNewJoining = false,
    this.tenureDays = 0,
    this.status = 'active',
    this.currentBalance = 0.0,
    this.maxAdvanceAllowed = 0.0,
    this.daysWorked = 0.0,
    this.earnedSoFar = 0.0,
  });

  factory EmployeeModel.fromJson(Map<String, dynamic> json) {
    final basic = double.tryParse(json['basic_salary']?.toString() ?? '0') ?? 0.0;
    final perDay = double.tryParse(json['salary_per_day']?.toString() ?? '0') ?? (basic > 0 ? basic / 30 : 0.0);
    
    return EmployeeModel(
      id: json['id'] is int ? json['id'] : int.tryParse(json['id'].toString()) ?? 0,
      empCode: json['emp_code']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      departmentName: json['department_name']?.toString() ?? json['dept_name']?.toString() ?? 'Staff',
      jobRole: json['job_role']?.toString() ?? '',
      basicSalary: basic,
      salaryPerDay: perDay,
      joiningDate: json['joining_date']?.toString(),
      isNewJoining: json['is_new_joining'] == 1 || json['is_new_joining'] == true,
      tenureDays: json['tenure_days'] is int ? json['tenure_days'] : int.tryParse(json['tenure_days']?.toString() ?? '0') ?? 0,
      status: json['status']?.toString().toLowerCase() ?? 'active',
      currentBalance: double.tryParse(json['current_balance']?.toString() ?? json['current_advance_balance']?.toString() ?? '0') ?? 0.0,
      maxAdvanceAllowed: double.tryParse(json['max_advance_allowed']?.toString() ?? '0') ?? 0.0,
      daysWorked: double.tryParse(json['days_worked']?.toString() ?? '0') ?? 0.0,
      earnedSoFar: double.tryParse(json['earned_so_far']?.toString() ?? '0') ?? 0.0,
    );
  }
}

