import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

class ApiService {
  static const String defaultBaseUrl = 'http://localhost:5000/api';
  String _baseUrl = defaultBaseUrl;
  String? _token;

  static final ApiService _instance = ApiService._internal();
  factory ApiService() => _instance;
  ApiService._internal();

  String get baseUrl => _baseUrl;

  Future<void> init() async {
    final prefs = await SharedPreferences.getInstance();
    _baseUrl = prefs.getString('api_base_url') ?? defaultBaseUrl;
    _token = prefs.getString('auth_token');
  }

  Future<void> setBaseUrl(String url) async {
    _baseUrl = url.endsWith('/') ? url.substring(0, url.length - 1) : url;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('api_base_url', _baseUrl);
  }

  Future<void> setToken(String? token) async {
    _token = token;
    final prefs = await SharedPreferences.getInstance();
    if (token != null) {
      await prefs.setString('auth_token', token);
    } else {
      await prefs.remove('auth_token');
    }
  }

  String? get token => _token;
  bool get isAuthenticated => _token != null && _token!.isNotEmpty;

  Map<String, String> get _headers {
    final headers = <String, String>{
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    if (_token != null) {
      headers['Authorization'] = 'Bearer $_token';
    }
    return headers;
  }

  Future<dynamic> get(String endpoint) async {
    try {
      final uri = Uri.parse('$_baseUrl$endpoint');
      final res = await http.get(uri, headers: _headers);
      return _handleResponse(res);
    } catch (e) {
      throw ApiException(e.toString());
    }
  }

  Future<dynamic> post(String endpoint, [Map<String, dynamic>? data]) async {
    try {
      final uri = Uri.parse('$_baseUrl$endpoint');
      final res = await http.post(
        uri,
        headers: _headers,
        body: data != null ? jsonEncode(data) : null,
      );
      return _handleResponse(res);
    } catch (e) {
      throw ApiException(e.toString());
    }
  }

  Future<dynamic> put(String endpoint, [Map<String, dynamic>? data]) async {
    try {
      final uri = Uri.parse('$_baseUrl$endpoint');
      final res = await http.put(
        uri,
        headers: _headers,
        body: data != null ? jsonEncode(data) : null,
      );
      return _handleResponse(res);
    } catch (e) {
      throw ApiException(e.toString());
    }
  }

  Future<dynamic> patch(String endpoint, [Map<String, dynamic>? data]) async {
    try {
      final uri = Uri.parse('$_baseUrl$endpoint');
      final res = await http.patch(
        uri,
        headers: _headers,
        body: data != null ? jsonEncode(data) : null,
      );
      return _handleResponse(res);
    } catch (e) {
      throw ApiException(e.toString());
    }
  }

  Future<dynamic> delete(String endpoint, [Map<String, dynamic>? data]) async {
    try {
      final uri = Uri.parse('$_baseUrl$endpoint');
      final res = await http.delete(
        uri,
        headers: _headers,
        body: data != null ? jsonEncode(data) : null,
      );
      return _handleResponse(res);
    } catch (e) {
      throw ApiException(e.toString());
    }
  }

  dynamic _handleResponse(http.Response res) {
    dynamic body;
    try {
      body = jsonDecode(res.body);
    } catch (_) {
      body = {'message': res.body};
    }

    if (res.statusCode >= 200 && res.statusCode < 300) {
      return body;
    } else {
      final msg = body is Map ? (body['message'] ?? body['error'] ?? 'Server error ${res.statusCode}') : 'Error ${res.statusCode}';
      throw ApiException(msg.toString(), statusCode: res.statusCode);
    }
  }
}

class ApiException implements Exception {
  final String message;
  final int? statusCode;
  ApiException(this.message, {this.statusCode});

  @override
  String toString() => message;
}

