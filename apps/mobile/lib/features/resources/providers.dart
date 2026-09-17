import 'package:campusos/app/providers.dart';
import 'package:campusos/shared/models/resource.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

final resourceProvider = FutureProvider.autoDispose.family<ResourceDetail, String>((ref, resourceId) {
  final online = ref.watch(connectivityProvider).isOnline;
  return ref.watch(resourceRepositoryProvider).get(resourceId, online: online);
});
