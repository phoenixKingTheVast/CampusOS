import 'dart:convert';

import 'package:campusos/core/database/app_database.dart';
import 'package:campusos/core/network/api_client.dart';
import 'package:campusos/core/network/api_error.dart';
import 'package:campusos/shared/models/json_map.dart';

/// Everything the Explore tab shows, as `GET explore` returns it. Routes are
/// server-supplied so the client never rebuilds a destination by hand.
class ExploreSnapshot {
  const ExploreSnapshot({
    required this.happeningNow,
    required this.organizations,
    required this.events,
    required this.services,
    required this.categories,
    this.lastUpdated,
    this.fromCache = false,
  });

  final List<ExploreHappening> happeningNow;
  final List<ExploreOrganization> organizations;
  final List<ExploreEvent> events;
  final List<ExploreService> services;
  final List<ExploreCategoryLink> categories;
  final DateTime? lastUpdated;
  final bool fromCache;

  bool get isEmpty =>
      happeningNow.isEmpty &&
      organizations.isEmpty &&
      events.isEmpty &&
      services.isEmpty;

  factory ExploreSnapshot.fromJson(
    Map<String, dynamic> json, {
    bool fromCache = false,
    DateTime? lastUpdated,
  }) {
    return ExploreSnapshot(
      happeningNow:
          asJsonMapList(json['happeningNow']).map(ExploreHappening.fromJson).toList(),
      organizations: asJsonMapList(json['organizations'])
          .map(ExploreOrganization.fromJson)
          .toList(),
      events: asJsonMapList(json['events']).map(ExploreEvent.fromJson).toList(),
      services: asJsonMapList(json['services']).map(ExploreService.fromJson).toList(),
      categories: asJsonMapList(json['serviceCategories'])
          .map(ExploreCategoryLink.fromJson)
          .toList(),
      lastUpdated: lastUpdated,
      fromCache: fromCache,
    );
  }
}

class ExploreHappening {
  const ExploreHappening({
    required this.id,
    required this.title,
    required this.route,
    this.subtitle,
    this.startTime,
  });

  final String id;
  final String title;
  final String route;
  final String? subtitle;
  final DateTime? startTime;

  factory ExploreHappening.fromJson(Map<String, dynamic> json) {
    return ExploreHappening(
      id: asString(json['id']) ?? '',
      title: asString(json['title']) ?? '',
      route: asString(json['route']) ?? '',
      subtitle: asString(json['subtitle']),
      startTime: asDateTime(json['startTime']),
    );
  }
}

class ExploreOrganization {
  const ExploreOrganization({
    required this.id,
    required this.name,
    required this.route,
    required this.memberCount,
    required this.followerCount,
    required this.following,
    this.description,
    this.typeLabel,
    this.accessibilityLabel,
  });

  final String id;
  final String name;
  final String route;
  final int memberCount;
  final int followerCount;
  final bool following;
  final String? description;
  final String? typeLabel;
  final String? accessibilityLabel;

  String get memberLabel => memberCount == 1 ? '1 member' : '$memberCount members';

  String get semanticLabel =>
      accessibilityLabel ??
      '$name. ${typeLabel ?? 'Organisation'}. $memberLabel.${following ? ' Followed.' : ''}';

  factory ExploreOrganization.fromJson(Map<String, dynamic> json) {
    return ExploreOrganization(
      id: asString(json['id']) ?? '',
      name: asString(json['name']) ?? '',
      route: asString(json['route']) ?? '',
      memberCount: asInt(json['memberCount']) ?? 0,
      followerCount: asInt(json['followerCount']) ?? 0,
      following: asBool(json['following']),
      description: asString(json['description']),
      typeLabel: asString(json['typeLabel']),
      accessibilityLabel: asString(json['accessibilityLabel']),
    );
  }
}

class ExploreEvent {
  const ExploreEvent({
    required this.id,
    required this.title,
    required this.route,
    this.startsAt,
    this.location,
    this.organizationName,
  });

  final String id;
  final String title;
  final String route;
  final DateTime? startsAt;
  final String? location;
  final String? organizationName;

  factory ExploreEvent.fromJson(Map<String, dynamic> json) {
    return ExploreEvent(
      id: asString(json['id']) ?? '',
      title: asString(json['title']) ?? '',
      route: asString(json['route']) ?? '',
      startsAt: asDateTime(json['startsAt']),
      location: asString(json['location']),
      organizationName: asString(json['organizationName']),
    );
  }
}

/// Explore names a service `name`/`description`; the canonical catalogue model
/// is only used once the person opens the service itself.
class ExploreService {
  const ExploreService({
    required this.id,
    required this.name,
    required this.route,
    required this.priceLabel,
    required this.verified,
    required this.ratingCount,
    this.description,
    this.categoryKey,
    this.categoryLabel,
    this.providerName,
    this.ratingAverage,
    this.accessibilityLabel,
  });

  final String id;
  final String name;
  final String route;
  final String priceLabel;
  final bool verified;
  final int ratingCount;
  final String? description;
  final String? categoryKey;
  final String? categoryLabel;
  final String? providerName;
  final double? ratingAverage;
  final String? accessibilityLabel;

  String get semanticLabel =>
      accessibilityLabel ?? '$name. ${categoryLabel ?? 'Service'}. $priceLabel.';

  factory ExploreService.fromJson(Map<String, dynamic> json) {
    return ExploreService(
      id: asString(json['id']) ?? '',
      name: asString(json['name']) ?? '',
      route: asString(json['route']) ?? '',
      priceLabel: asString(json['priceLabel']) ?? '',
      verified: asBool(json['verified']),
      ratingCount: asInt(json['ratingCount']) ?? 0,
      description: asString(json['description']),
      categoryKey: asString(json['categoryKey']),
      categoryLabel: asString(json['categoryLabel']),
      providerName: asString(json['providerName']),
      ratingAverage: asDouble(json['ratingAverage']),
      accessibilityLabel: asString(json['accessibilityLabel']),
    );
  }
}

class ExploreCategoryLink {
  const ExploreCategoryLink({
    required this.key,
    required this.label,
    required this.route,
  });

  final String key;
  final String label;
  final String route;

  factory ExploreCategoryLink.fromJson(Map<String, dynamic> json) {
    final key = asString(json['key']) ?? '';
    return ExploreCategoryLink(
      key: key,
      label: asString(json['label']) ?? key,
      route: asString(json['route']) ?? '/app/explore/services?category=$key',
    );
  }
}

class ExploreRepository {
  ExploreRepository({required ApiClient api, required AppDatabase database})
      : _api = api,
        _database = database;

  final ApiClient _api;
  final AppDatabase _database;

  Future<ExploreSnapshot> load({required bool online}) async {
    if (!online) {
      final cached = await _cached();
      if (cached != null) {
        return cached;
      }
    }
    try {
      final payload = await _api.get('explore');
      await _database.setMeta('explore.payload', jsonEncode(payload));
      final now = DateTime.now();
      await _database.setMeta('explore.synced_at', now.toIso8601String());
      return ExploreSnapshot.fromJson(payload, lastUpdated: now);
    } on ApiError {
      final cached = await _cached();
      if (cached != null) {
        return cached;
      }
      rethrow;
    }
  }

  Future<ExploreSnapshot?> _cached() async {
    final raw = await _database.meta('explore.payload');
    if (raw == null || raw.isEmpty) {
      return null;
    }
    final syncedAt = await _database.meta('explore.synced_at');
    return ExploreSnapshot.fromJson(
      asJsonMap(jsonDecode(raw)),
      fromCache: true,
      lastUpdated: syncedAt == null ? null : DateTime.tryParse(syncedAt),
    );
  }
}

String exploreErrorMessage(Object error) =>
    error is ApiError ? error.message : ApiError.genericMessage;
