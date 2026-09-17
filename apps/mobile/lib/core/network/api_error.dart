class ApiError implements Exception {
  const ApiError({
    required this.code,
    required this.message,
    this.statusCode,
    this.requestId,
  });

  final String code;
  final String message;
  final int? statusCode;
  final String? requestId;

  static const permissionDeniedMessage =
      "You don't have permission to do that.";
  static const conflictMessage =
      'This information changed while you were editing it. Please review the latest version.';
  static const rateLimitedMessage =
      'Too many attempts. Please wait and try again.';
  static const unauthenticatedMessage = 'Please sign in to continue.';
  static const genericMessage = "CampusOS couldn't complete that request.";
  static const resourceRemovedMessage = 'This resource has been removed.';
  static const resourceUnauthorizedMessage =
      "You don't have access to this resource.";
  static const fileProcessingMessage = 'This file is still being checked.';

  bool get isUnauthenticated => code == 'UNAUTHENTICATED' || statusCode == 401;
  bool get isPermissionDenied => code == 'PERMISSION_DENIED';
  bool get isNotFound => code == 'NOT_FOUND';
  bool get isRateLimited => code == 'RATE_LIMITED';

  factory ApiError.fromBody({
    required dynamic body,
    int? statusCode,
    String? requestId,
  }) {
    final map = body is Map ? Map<String, dynamic>.from(body) : const <String, dynamic>{};
    final code = (map['code'] as String?) ?? _codeForStatus(statusCode);
    return ApiError(
      code: code,
      message: _messageFor(code, map['message'] as String?),
      statusCode: statusCode,
      requestId: (map['requestId'] as String?) ?? requestId,
    );
  }

  static String _codeForStatus(int? status) {
    switch (status) {
      case 401:
        return 'UNAUTHENTICATED';
      case 403:
        return 'PERMISSION_DENIED';
      case 404:
        return 'NOT_FOUND';
      case 409:
        return 'CONFLICT';
      case 429:
        return 'RATE_LIMITED';
      default:
        return 'HTTP_ERROR';
    }
  }

  static String _messageFor(String code, String? serverMessage) {
    switch (code) {
      case 'PERMISSION_DENIED':
        return permissionDeniedMessage;
      case 'CONFLICT':
        return conflictMessage;
      case 'RATE_LIMITED':
        return rateLimitedMessage;
      default:
        if (serverMessage != null && serverMessage.trim().isNotEmpty) {
          return serverMessage;
        }
        return genericMessage;
    }
  }

  @override
  String toString() => message;
}
