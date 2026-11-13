import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/user_model.dart';
import 'api_service.dart';

class AuthProvider extends ChangeNotifier {
  final ApiService _api = ApiService();
  UserModel? _user;
  bool _isLoading = true;
  String? _error;

  UserModel? get user => _user;
  bool get isAuthenticated => _user != null && _api.isAuthenticated;
  bool get isLoading => _isLoading;
  String? get error => _error;

  bool get isAdmin => _user?.isAdmin ?? false;
  bool get isManager => _user?.isManager ?? false;
  bool get isGuard => _user?.isGuard ?? false;

  Future<void> init() async {
    _isLoading = true;
    notifyListeners();
    try {
      await _api.init();
      final prefs = await SharedPreferences.getInstance();
      final userJson = prefs.getString('user_profile');
      if (userJson != null) {
        _user = UserModel.fromJson(jsonDecode(userJson));
      }

      if (_api.token != null) {
        // Verify token with backend
        try {
          final res = await _api.get('/auth/me');
          if (res != null && res['data'] != null) {
            _user = UserModel.fromJson(res['data']);
            await prefs.setString('user_profile', jsonEncode(_user!.toJson()));
          }
        } catch (_) {
          // Token might be invalid, logout
          await logout();
        }
      }
    } catch (e) {
      _error = e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> login(String username, String password) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final res = await _api.post('/auth/login', {
        'username': username.trim(),
        'password': password.trim(),
      });

      if (res['success'] == true) {
        final token = res['token']?.toString() ?? res['data']?['token']?.toString();
        final userData = res['user'] ?? res['data']?['user'] ?? res['data'];
        
        if (token != null && userData != null) {
          await _api.setToken(token);
          _user = UserModel.fromJson(userData);
          final prefs = await SharedPreferences.getInstance();
          await prefs.setString('user_profile', jsonEncode(_user!.toJson()));
          _isLoading = false;
          notifyListeners();
          return true;
        }
      }
      throw ApiException(res['message']?.toString() ?? 'Invalid credentials');
    } catch (e) {
      _error = e.toString();
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  Future<void> logout() async {
    _user = null;
    await _api.setToken(null);
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('user_profile');
    notifyListeners();
  }
}

