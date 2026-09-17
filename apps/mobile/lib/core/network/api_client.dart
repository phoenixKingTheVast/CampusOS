import 'package:campusos/core/authentication/session_manager.dart';
import 'package:campusos/core/network/api_error.dart';
import 'package:campusos/app/config/app_config.dart';
import 'package:dio/dio.dart';
import 'package:uuid/uuid.dart';

class ApiClient {
  ApiClient({required SessionManager sessionManager}) : _session = sessionManager {
    final base = AppConfig.apiBaseUrl.endsWith('/')
        ? AppConfig.apiBaseUrl
        : '${AppConfig.apiBaseUrl}/';
    _bare = Dio(
      BaseOptions(
        baseUrl: base,
        connectTimeout: const Duration(seconds: 20),
        receiveTimeout: const Duration(seconds: 20),
        headers: const {'Accept': 'application/json'},
      ),
    );
    _dio = Dio(
      BaseOptions(
        baseUrl: base,
        connectTimeout: const Duration(seconds: 20),
        receiveTimeout: const Duration(seconds: 20),
        headers: const {'Accept': 'application/json'},
      ),
    );
    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          options.headers['x-request-id'] = const Uuid().v4();
          final skipAuth = options.extra['skipAuth'] == true;
          if (!skipAuth) {
            final token = await _session.accessToken();
            if (token != null && token.isNotEmpty) {
              options.headers['Authorization'] = 'Bearer $token';
            }
          }
          handler.next(options);
        },
        onError: (error, handler) async {
          final alreadyRetried = error.requestOptions.extra['retried'] == true;
          final skipRefresh = error.requestOptions.extra['skipAuth'] == true;
          if (error.response?.statusCode == 401 && !alreadyRetried && !skipRefresh) {
            error.requestOptions.extra['retried'] = true;
            final refreshed = await _session.refreshOnce();
            if (refreshed) {
              final token = await _session.accessToken();
              if (token != null) {
                error.requestOptions.headers['Authorization'] = 'Bearer $token';
              }
              try {
                final response = await _dio.fetch<dynamic>(error.requestOptions);
                handler.resolve(response);
                return;
              } on DioException catch (retryError) {
                handler.next(retryError);
                return;
              }
            }
          }
          handler.next(error);
        },
      ),
    );
  }

  final SessionManager _session;
  late final Dio _dio;
  late final Dio _bare;

  Future<Map<String, dynamic>> get(
    String path, {
    Map<String, dynamic>? query,
    bool skipAuth = false,
  }) {
    return _send(
      () => _dio.get<dynamic>(
        path,
        queryParameters: query,
        options: Options(extra: {'skipAuth': skipAuth}),
      ),
    );
  }

  Future<Map<String, dynamic>> post(
    String path, {
    Object? data,
    bool skipAuth = false,
  }) {
    return _send(
      () => _dio.post<dynamic>(
        path,
        data: data,
        options: Options(extra: {'skipAuth': skipAuth}),
      ),
    );
  }

  Future<Map<String, dynamic>> patch(String path, {Object? data}) {
    return _send(() => _dio.patch<dynamic>(path, data: data));
  }

  Future<Map<String, dynamic>> put(String path, {Object? data}) {
    return _send(() => _dio.put<dynamic>(path, data: data));
  }

  Future<Map<String, dynamic>> delete(String path, {Object? data}) {
    return _send(() => _dio.delete<dynamic>(path, data: data));
  }

  Future<Map<String, dynamic>> uploadBytes({
    required String path,
    required List<int> bytes,
    required String filename,
    required String mimeType,
    Map<String, String>? headers,
  }) {
    final form = FormData.fromMap({
      'file': MultipartFile.fromBytes(bytes, filename: filename),
    });
    return _send(
      () => _dio.post<dynamic>(
        path,
        data: form,
        options: Options(headers: headers),
      ),
    );
  }

  Future<void> download(String path, String savePath) async {
    try {
      await _dio.download(path, savePath);
    } on DioException catch (error) {
      throw _toApiError(error);
    }
  }

  Future<Map<String, dynamic>> refresh(String refreshToken) {
    return _send(
      () => _bare.post<dynamic>(
        'auth/refresh',
        data: {'refreshToken': refreshToken},
        options: Options(
          headers: {'x-request-id': const Uuid().v4()},
        ),
      ),
    );
  }

  Future<Map<String, dynamic>> _send(Future<Response<dynamic>> Function() request) async {
    try {
      final response = await request();
      final data = response.data;
      if (data is Map<String, dynamic>) {
        return data;
      }
      if (data is Map) {
        return Map<String, dynamic>.from(data);
      }
      return <String, dynamic>{'data': data};
    } on DioException catch (error) {
      throw _toApiError(error);
    }
  }

  ApiError _toApiError(DioException error) {
    if (error.type == DioExceptionType.connectionError ||
        error.type == DioExceptionType.connectionTimeout) {
      return const ApiError(
        code: 'OFFLINE',
        message: "You're offline. Showing recently synced information.",
      );
    }
    return ApiError.fromBody(
      body: error.response?.data,
      statusCode: error.response?.statusCode,
      requestId: error.response?.headers.value('x-request-id'),
    );
  }
}
