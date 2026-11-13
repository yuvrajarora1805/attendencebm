class UserModel {
  final int id;
  final String username;
  final String fullName;
  final String role;
  final bool isActive;

  UserModel({
    required this.id,
    required this.username,
    required this.fullName,
    required this.role,
    this.isActive = true,
  });

  bool get isAdmin => role.toLowerCase() == 'admin';
  bool get isManager => role.toLowerCase() == 'manager';
  bool get isGuard => role.toLowerCase() == 'guard' || role.toLowerCase() == 'security_guard';
  bool get isHr => role.toLowerCase() == 'hr';

  factory UserModel.fromJson(Map<String, dynamic> json) {
    return UserModel(
      id: json['id'] is int ? json['id'] : int.tryParse(json['id'].toString()) ?? 0,
      username: json['username']?.toString() ?? '',
      fullName: json['full_name']?.toString() ?? json['username']?.toString() ?? 'User',
      role: json['role']?.toString().toLowerCase() ?? 'viewer',
      isActive: json['is_active'] == 1 || json['is_active'] == true,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'username': username,
      'full_name': fullName,
      'role': role,
      'is_active': isActive ? 1 : 0,
    };
  }
}

