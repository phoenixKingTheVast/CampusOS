import 'dart:convert';

Map<String, dynamic> asJsonMap(dynamic value) {
  if (value is Map<String, dynamic>) {
    return value;
  }
  if (value is Map) {
    return Map<String, dynamic>.from(value);
  }
  return <String, dynamic>{};
}

List<Map<String, dynamic>> asJsonMapList(dynamic value) {
  if (value is! List) {
    return const [];
  }
  return value
      .whereType<Object>()
      .map(asJsonMap)
      .toList(growable: false);
}

String? asString(dynamic value) {
  if (value == null) {
    return null;
  }
  final text = '$value';
  return text.isEmpty || text == 'null' ? null : text;
}

int? asInt(dynamic value) {
  if (value is int) {
    return value;
  }
  return int.tryParse('$value');
}

double? asDouble(dynamic value) {
  if (value is double) {
    return value;
  }
  if (value is int) {
    return value.toDouble();
  }
  return double.tryParse('$value');
}

bool asBool(dynamic value) => value == true || value == 1 || value == '1';

DateTime? asDateTime(dynamic value) {
  if (value is DateTime) {
    return value;
  }
  if (value is String && value.isNotEmpty) {
    return DateTime.tryParse(value);
  }
  return null;
}

List<String> asStringList(dynamic value) {
  if (value is List) {
    return value.map((item) => '$item').toList(growable: false);
  }
  if (value is String && value.isNotEmpty) {
    try {
      final decoded = jsonDecode(value);
      return asStringList(decoded);
    } catch (_) {
      return const [];
    }
  }
  return const [];
}

String encodeJson(dynamic value) => jsonEncode(value ?? const []);
