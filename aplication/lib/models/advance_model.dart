class AdvanceRequestModel {
  final int id;
  final int empId;
  final String empName;
  final String empCode;
  final String? departmentName;
  final double amount;
  final String mode;
  final String reason;
  final String status; // pending, approved, rejected
  final double monthlyDeduction;
  final String? adminNotes;
  final String? requestedByName;
  final String? reviewedByName;
  final String? createdAt;
  final bool isNewJoining;
  final int tenureDays;
  final double curMonthLeaves;
  final double lastMonthLeaves;
  final double currentAdvanceBalance;

  AdvanceRequestModel({
    required this.id,
    required this.empId,
    required this.empName,
    required this.empCode,
    this.departmentName,
    required this.amount,
    this.mode = 'cash',
    required this.reason,
    required this.status,
    this.monthlyDeduction = 0.0,
    this.adminNotes,
    this.requestedByName,
    this.reviewedByName,
    this.createdAt,
    this.isNewJoining = false,
    this.tenureDays = 0,
    this.curMonthLeaves = 0.0,
    this.lastMonthLeaves = 0.0,
    this.currentAdvanceBalance = 0.0,
  });

  bool get isPending => status == 'pending';
  bool get isApproved => status == 'approved';
  bool get isRejected => status == 'rejected';

  factory AdvanceRequestModel.fromJson(Map<String, dynamic> json) {
    return AdvanceRequestModel(
      id: json['id'] is int ? json['id'] : int.tryParse(json['id'].toString()) ?? 0,
      empId: json['emp_id'] is int ? json['emp_id'] : int.tryParse(json['emp_id'].toString()) ?? 0,
      empName: json['emp_name']?.toString() ?? '',
      empCode: json['emp_code']?.toString() ?? '',
      departmentName: json['department_name']?.toString() ?? 'Staff',
      amount: double.tryParse(json['amount']?.toString() ?? '0') ?? 0.0,
      mode: json['mode']?.toString().toUpperCase() ?? 'CASH',
      reason: json['reason']?.toString() ?? '',
      status: json['status']?.toString().toLowerCase() ?? 'pending',
      monthlyDeduction: double.tryParse(json['monthly_deduction']?.toString() ?? '0') ?? 0.0,
      adminNotes: json['admin_notes']?.toString(),
      requestedByName: json['requested_by_name']?.toString() ?? json['requested_by_username']?.toString() ?? 'Shift Manager',
      reviewedByName: json['reviewed_by_name']?.toString(),
      createdAt: json['created_at']?.toString(),
      isNewJoining: json['is_new_joining'] == 1 || json['is_new_joining'] == true,
      tenureDays: json['tenure_days'] is int ? json['tenure_days'] : int.tryParse(json['tenure_days']?.toString() ?? '0') ?? 0,
      curMonthLeaves: double.tryParse(json['cur_month_leaves']?.toString() ?? '0') ?? 0.0,
      lastMonthLeaves: double.tryParse(json['last_month_leaves']?.toString() ?? '0') ?? 0.0,
      currentAdvanceBalance: double.tryParse(json['current_advance_balance']?.toString() ?? '0') ?? 0.0,
    );
  }
}

class AdvanceTransactionModel {
  final int id;
  final int empId;
  final String? empName;
  final String? empCode;
  final String date;
  final String type; // given, deduction
  final double amount;
  final String? mode;
  final String remarks;
  final double monthlyDeduction;
  final double recoveredAmount;
  final String status;
  final String? sourceFlag;
  final String? createdByName;

  AdvanceTransactionModel({
    required this.id,
    required this.empId,
    this.empName,
    this.empCode,
    required this.date,
    required this.type,
    required this.amount,
    this.mode,
    required this.remarks,
    this.monthlyDeduction = 0.0,
    this.recoveredAmount = 0.0,
    this.status = 'active',
    this.sourceFlag,
    this.createdByName,
  });

  bool get isGiven => type.toLowerCase() == 'given';
  double get remainingBalance => (amount - recoveredAmount).clamp(0, double.infinity);

  factory AdvanceTransactionModel.fromJson(Map<String, dynamic> json) {
    return AdvanceTransactionModel(
      id: json['id'] is int ? json['id'] : int.tryParse(json['id'].toString()) ?? 0,
      empId: json['emp_id'] is int ? json['emp_id'] : int.tryParse(json['emp_id'].toString()) ?? 0,
      empName: json['emp_name']?.toString(),
      empCode: json['emp_code']?.toString(),
      date: json['date']?.toString() ?? '',
      type: json['type']?.toString().toLowerCase() ?? 'given',
      amount: double.tryParse(json['amount']?.toString() ?? '0') ?? 0.0,
      mode: json['mode']?.toString().toUpperCase() ?? 'CASH',
      remarks: json['remarks']?.toString() ?? '',
      monthlyDeduction: double.tryParse(json['monthly_deduction']?.toString() ?? '0') ?? 0.0,
      recoveredAmount: double.tryParse(json['recovered_amount']?.toString() ?? '0') ?? 0.0,
      status: json['status']?.toString().toLowerCase() ?? 'active',
      sourceFlag: json['source_flag']?.toString(),
      createdByName: json['created_by_name']?.toString(),
    );
  }
}

