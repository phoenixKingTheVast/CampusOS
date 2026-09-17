import 'package:campusos/shared/models/announcement.dart';
import 'package:campusos/shared/models/booking.dart';
import 'package:campusos/shared/models/calendar_models.dart';
import 'package:campusos/shared/models/campus_service.dart';
import 'package:campusos/shared/models/conversation.dart';
import 'package:campusos/shared/models/course_offering.dart';
import 'package:campusos/shared/models/json_map.dart';
import 'package:campusos/shared/models/learn_snapshot.dart';
import 'package:campusos/shared/models/message.dart';
import 'package:campusos/shared/models/notification.dart';
import 'package:campusos/shared/models/person.dart';
import 'package:campusos/shared/models/programme.dart';
import 'package:campusos/shared/models/resource.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:sqflite/sqflite.dart';

class AppDatabase {
  Database? _db;

  Database get _require {
    final db = _db;
    if (db == null) {
      throw StateError('Database is not open.');
    }
    return db;
  }

  bool get isOpen => _db != null;

  Future<void> open() async {
    if (_db != null) {
      return;
    }
    final directory = await getApplicationDocumentsDirectory();
    final path = p.join(directory.path, 'campusos.db');
    _db = await openDatabase(
      path,
      version: 2,
      onCreate: (db, version) async {
        await _createTables(db);
      },
      onUpgrade: (db, oldVersion, newVersion) async {
        if (oldVersion < 2) {
          // v2 adds the messaging, social and campus-services caches, and gives
          // notifications the type/category columns the API now returns.
          await db.execute('DROP TABLE IF EXISTS notifications');
          await _createV2Tables(db);
        }
      },
    );
  }

  Future<void> close() async {
    await _db?.close();
    _db = null;
  }

  Future<void> _createTables(Database db) async {
    await db.execute('''
      CREATE TABLE persons (
        id TEXT PRIMARY KEY,
        phone_number TEXT,
        given_name TEXT,
        middle_name TEXT,
        family_name TEXT,
        display_name TEXT,
        username TEXT,
        bio TEXT,
        photo_file_id TEXT,
        account_state TEXT,
        updated_at TEXT
      )
    ''');
    await db.execute('''
      CREATE TABLE classes (
        id TEXT PRIMARY KEY,
        code TEXT,
        name TEXT,
        year_of_study INTEGER,
        faculty_name TEXT,
        semester_label TEXT,
        representative_count INTEGER,
        can_request_membership INTEGER
      )
    ''');
    await db.execute('''
      CREATE TABLE class_memberships (
        id TEXT PRIMARY KEY,
        class_id TEXT,
        person_id TEXT,
        role TEXT,
        status TEXT,
        created_at TEXT
      )
    ''');
    await db.execute('''
      CREATE TABLE courses (
        id TEXT PRIMARY KEY,
        code TEXT,
        title TEXT,
        department TEXT,
        faculty TEXT
      )
    ''');
    await db.execute('''
      CREATE TABLE course_offerings (
        id TEXT PRIMARY KEY,
        course_id TEXT,
        semester_label TEXT,
        status TEXT,
        description TEXT,
        learning_outcomes TEXT,
        outline TEXT,
        references_json TEXT,
        department TEXT,
        faculty TEXT,
        lecturer_name TEXT,
        permissions TEXT
      )
    ''');
    await db.execute('''
      CREATE TABLE enrollments (
        id TEXT PRIMARY KEY,
        course_offering_id TEXT,
        person_id TEXT,
        status TEXT
      )
    ''');
    await db.execute('''
      CREATE TABLE announcements (
        id TEXT PRIMARY KEY,
        course_offering_id TEXT,
        author_id TEXT,
        author_name TEXT,
        title TEXT,
        body TEXT,
        priority TEXT,
        status TEXT,
        published_at TEXT,
        expires_at TEXT,
        created_at TEXT,
        updated_at TEXT,
        is_read INTEGER
      )
    ''');
    await db.execute('''
      CREATE TABLE resources (
        id TEXT PRIMARY KEY,
        course_id TEXT,
        course_offering_id TEXT,
        title TEXT,
        description TEXT,
        resource_type TEXT,
        category_key TEXT,
        category_label TEXT,
        group_key TEXT,
        group_label TEXT,
        visibility TEXT,
        status TEXT,
        uploaded_by TEXT,
        authored_by TEXT,
        current_version_id TEXT,
        version_number INTEGER,
        file_id TEXT,
        mime_type TEXT,
        size_bytes INTEGER,
        academic_year INTEGER,
        semester_label TEXT,
        course_code TEXT,
        course_title TEXT,
        offering_label TEXT,
        historical INTEGER,
        endorsed INTEGER,
        endorser_name TEXT,
        can_edit_metadata INTEGER,
        editable_until TEXT,
        published_at TEXT,
        created_at TEXT,
        solution_available INTEGER
      )
    ''');
    await db.execute('''
      CREATE TABLE resource_versions (
        id TEXT PRIMARY KEY,
        resource_id TEXT,
        version_number INTEGER,
        file_id TEXT,
        change_summary TEXT,
        created_at TEXT,
        current INTEGER
      )
    ''');
    await db.execute('''
      CREATE TABLE resource_endorsements (
        id TEXT PRIMARY KEY,
        resource_id TEXT,
        endorser_name TEXT,
        endorsement_type TEXT,
        comment TEXT,
        created_at TEXT,
        revoked_at TEXT
      )
    ''');
    await db.execute('''
      CREATE TABLE resource_relationships (
        id TEXT PRIMARY KEY,
        from_resource_id TEXT,
        to_resource_id TEXT,
        type TEXT,
        title TEXT,
        offering TEXT
      )
    ''');
    await db.execute('''
      CREATE TABLE files (
        id TEXT PRIMARY KEY,
        original_name TEXT,
        mime_type TEXT,
        size_bytes INTEGER,
        processing_state TEXT
      )
    ''');
    await db.execute('''
      CREATE TABLE offline_files (
        id TEXT PRIMARY KEY,
        file_id TEXT,
        resource_id TEXT,
        local_path TEXT,
        version_number INTEGER,
        checksum TEXT,
        downloaded_at TEXT
      )
    ''');
    await db.execute('''
      CREATE TABLE activities (
        id TEXT PRIMARY KEY,
        type TEXT,
        title TEXT,
        start_time TEXT,
        end_time TEXT,
        location TEXT,
        status TEXT,
        course_offering_id TEXT,
        source TEXT,
        relative TEXT,
        route TEXT
      )
    ''');
    await db.execute('''
      CREATE TABLE calendar_activities (
        id TEXT PRIMARY KEY,
        type TEXT,
        title TEXT,
        start_time TEXT,
        end_time TEXT,
        timezone TEXT,
        location TEXT,
        status TEXT,
        category TEXT,
        category_label TEXT,
        personal INTEGER,
        source_object_type TEXT,
        source_object_id TEXT,
        route TEXT,
        description TEXT
      )
    ''');
    await db.execute('''
      CREATE TABLE events (
        id TEXT PRIMARY KEY,
        title TEXT,
        status TEXT,
        starts_at TEXT,
        location TEXT,
        payload_json TEXT
      )
    ''');
    await db.execute('''
      CREATE TABLE event_responses (
        event_id TEXT,
        person_id TEXT,
        response TEXT,
        pending INTEGER,
        PRIMARY KEY (event_id, person_id)
      )
    ''');
    await db.execute('''
      CREATE TABLE external_calendar_mappings (
        campus_activity_id TEXT PRIMARY KEY,
        calendar_identifier TEXT,
        external_event_identifier TEXT,
        created_at TEXT,
        updated_at TEXT
      )
    ''');
    await db.execute('''
      CREATE TABLE pending_actions (
        id TEXT PRIMARY KEY,
        method TEXT,
        path TEXT,
        body_json TEXT,
        created_at TEXT,
        retry_count INTEGER
      )
    ''');
    await db.execute('''
      CREATE TABLE sync_metadata (
        key TEXT PRIMARY KEY,
        value TEXT
      )
    ''');
    await _createV2Tables(db);
  }

  /// Caches added in schema v2: the conversation engine, the social graph and
  /// the campus-services catalog. These are read-only offline caches — every
  /// mutation still goes to the server.
  Future<void> _createV2Tables(Database db) async {
    await db.execute('''
      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        type TEXT,
        category TEXT,
        priority TEXT,
        title TEXT,
        body TEXT,
        source_type TEXT,
        source_id TEXT,
        read INTEGER,
        seen INTEGER,
        created_at TEXT,
        route TEXT
      )
    ''');
    await db.execute('''
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        kind TEXT,
        title TEXT,
        unread_count INTEGER,
        route TEXT,
        participant_count INTEGER,
        muted INTEGER,
        last_activity_at TEXT,
        preview TEXT,
        preview_sender TEXT,
        preview_at TEXT,
        context_type TEXT,
        context_id TEXT
      )
    ''');
    await db.execute('''
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT,
        sender_id TEXT,
        sender_name TEXT,
        body TEXT,
        message_type TEXT,
        mine INTEGER,
        status TEXT,
        client_action_id TEXT,
        reply_to_message_id TEXT,
        created_at TEXT,
        edited_at TEXT,
        removed INTEGER,
        delivery TEXT
      )
    ''');
    await db.execute('''
      CREATE TABLE IF NOT EXISTS service_categories (
        id TEXT PRIMARY KEY,
        key TEXT,
        label TEXT,
        description TEXT,
        service_count INTEGER
      )
    ''');
    await db.execute('''
      CREATE TABLE IF NOT EXISTS services (
        id TEXT PRIMARY KEY,
        title TEXT,
        summary TEXT,
        status TEXT,
        status_label TEXT,
        price_label TEXT,
        category_key TEXT,
        category_label TEXT,
        service_mode TEXT,
        service_mode_label TEXT,
        booking_policy TEXT,
        bookable INTEGER,
        rating_average REAL,
        rating_count INTEGER,
        location_label TEXT,
        provider_id TEXT,
        provider_name TEXT,
        provider_verified INTEGER
      )
    ''');
    await db.execute('''
      CREATE TABLE IF NOT EXISTS bookings (
        id TEXT PRIMARY KEY,
        status TEXT,
        status_label TEXT,
        state_label TEXT,
        booking_type TEXT,
        quantity INTEGER,
        terminal INTEGER,
        viewer_role TEXT,
        service_id TEXT,
        service_title TEXT,
        category_label TEXT,
        price_label TEXT,
        provider_id TEXT,
        provider_name TEXT,
        start_time TEXT,
        end_time TEXT,
        created_at TEXT,
        location_label TEXT,
        conversation_id TEXT,
        customer_name TEXT
      )
    ''');
  }

  Future<void> upsert(String table, Map<String, Object?> values) {
    return _require.insert(table, values, conflictAlgorithm: ConflictAlgorithm.replace);
  }

  Future<void> upsertPerson(Person person) => upsert('persons', person.toRow());

  Future<Person?> personById(String id) async {
    final rows = await _require.query('persons', where: 'id = ?', whereArgs: [id], limit: 1);
    if (rows.isEmpty) {
      return null;
    }
    return Person.fromRow(rows.first);
  }

  Future<void> upsertCourse(CourseOfferingSummary course) async {
    await upsert('courses', {
      'id': course.courseId,
      'code': course.code,
      'title': course.title,
      'department': null,
      'faculty': null,
    });
    await upsert('course_offerings', {
      'id': course.courseOfferingId,
      'course_id': course.courseId,
      'semester_label': course.semester,
      'status': course.status,
      'lecturer_name': course.lecturer,
    });
    await upsert('enrollments', {
      'id': '${course.courseOfferingId}:${course.courseId}',
      'course_offering_id': course.courseOfferingId,
      'person_id': 'self',
      'status': 'ACTIVE',
    });
  }

  Future<void> replaceEnrollments(List<CourseOfferingSummary> courses) async {
    await _require.delete('enrollments');
    for (final course in courses) {
      await upsertCourse(course);
    }
  }

  Future<void> upsertOffering(CourseOfferingDetail detail) async {
    await upsert('courses', {
      'id': detail.courseId,
      'code': detail.code,
      'title': detail.title,
      'department': detail.department,
      'faculty': detail.faculty,
    });
    await upsert('course_offerings', detail.toRow());
  }

  Future<List<CourseOfferingSummary>> enrolledOfferings() async {
    final rows = await _require.rawQuery('''
      SELECT o.id as course_offering_id, c.id as course_id, c.code, c.title,
             o.semester_label, o.status, o.lecturer_name
      FROM enrollments e
      JOIN course_offerings o ON o.id = e.course_offering_id
      JOIN courses c ON c.id = o.course_id
      WHERE e.status = 'ACTIVE'
    ''');
    return rows
        .map(
          (row) => CourseOfferingSummary(
            courseOfferingId: asString(row['course_offering_id']) ?? '',
            courseId: asString(row['course_id']) ?? '',
            code: asString(row['code']) ?? '',
            title: asString(row['title']) ?? '',
            semester: asString(row['semester_label']) ?? '',
            status: asString(row['status']),
            lecturer: asString(row['lecturer_name']),
          ),
        )
        .toList();
  }

  Future<void> upsertAnnouncement(Announcement item) => upsert('announcements', item.toRow());

  Future<List<Announcement>> announcementsForOffering(String courseOfferingId) async {
    final rows = await _require.query(
      'announcements',
      where: 'course_offering_id = ?',
      whereArgs: [courseOfferingId],
      orderBy: 'published_at DESC',
    );
    return rows.map(Announcement.fromRow).toList();
  }

  Future<void> upsertResource(ResourceItem item) => upsert('resources', item.toRow());

  Future<List<ResourceItem>> resourcesForOffering(String courseOfferingId) async {
    final rows = await _require.query(
      'resources',
      where: 'course_offering_id = ? OR course_id IN (SELECT course_id FROM course_offerings WHERE id = ?)',
      whereArgs: [courseOfferingId, courseOfferingId],
      orderBy: 'published_at DESC',
    );
    return rows.map(ResourceItem.fromRow).toList();
  }

  Future<ResourceItem?> resourceById(String id) async {
    final rows = await _require.query('resources', where: 'id = ?', whereArgs: [id], limit: 1);
    if (rows.isEmpty) {
      return null;
    }
    return ResourceItem.fromRow(rows.first);
  }

  Future<void> upsertClass(AcademicClass item) => upsert('classes', item.toRow());

  Future<List<AcademicClass>> searchClasses(String query) async {
    final rows = await _require.query(
      'classes',
      where: 'code LIKE ? OR name LIKE ?',
      whereArgs: ['%$query%', '%$query%'],
    );
    return rows
        .map(
          (row) => AcademicClass(
            id: asString(row['id']) ?? '',
            code: asString(row['code']) ?? '',
            name: asString(row['name']) ?? '',
            yearOfStudy: asInt(row['year_of_study']),
            facultyName: asString(row['faculty_name']),
            semester: asString(row['semester_label']),
            representativeCount: asInt(row['representative_count']) ?? 0,
            canRequestMembership: asBool(row['can_request_membership']),
          ),
        )
        .toList();
  }

  Future<void> upsertNotification(CampusNotification item) =>
      upsert('notifications', item.toRow());

  Future<List<CampusNotification>> notifications({
    String? category,
    bool unreadOnly = false,
  }) async {
    final clauses = <String>[];
    final args = <Object?>[];
    if (category != null) {
      clauses.add('category = ?');
      args.add(category);
    }
    if (unreadOnly) {
      clauses.add('read = 0');
    }
    final rows = await _require.query(
      'notifications',
      where: clauses.isEmpty ? null : clauses.join(' AND '),
      whereArgs: args.isEmpty ? null : args,
      orderBy: 'created_at DESC',
    );
    return rows.map(CampusNotification.fromRow).toList();
  }

  Future<int> unreadNotificationCount() async {
    final rows = await _require.rawQuery(
      'SELECT COUNT(*) AS total FROM notifications WHERE read = 0',
    );
    return asInt(rows.first['total']) ?? 0;
  }

  Future<void> markNotificationRead(String id) async {
    await _require
        .update('notifications', {'read': 1, 'seen': 1}, where: 'id = ?', whereArgs: [id]);
  }

  Future<void> markAllNotificationsRead() async {
    await _require.update('notifications', {'read': 1, 'seen': 1});
  }

  Future<void> replaceConversations(List<ConversationSummary> items) async {
    final batch = _require.batch();
    batch.delete('conversations');
    for (final item in items) {
      batch.insert('conversations', item.toRow(),
          conflictAlgorithm: ConflictAlgorithm.replace);
    }
    await batch.commit(noResult: true);
  }

  Future<List<ConversationSummary>> conversations() async {
    final rows = await _require.query('conversations', orderBy: 'last_activity_at DESC');
    return rows.map(ConversationSummary.fromRow).toList();
  }

  Future<ConversationSummary?> conversationById(String id) async {
    final rows =
        await _require.query('conversations', where: 'id = ?', whereArgs: [id], limit: 1);
    return rows.isEmpty ? null : ConversationSummary.fromRow(rows.first);
  }

  Future<void> upsertMessages(List<ChatMessage> items) async {
    final batch = _require.batch();
    for (final item in items) {
      batch.insert('messages', item.toRow(), conflictAlgorithm: ConflictAlgorithm.replace);
    }
    await batch.commit(noResult: true);
  }

  Future<List<ChatMessage>> messagesForConversation(String conversationId) async {
    final rows = await _require.query(
      'messages',
      where: 'conversation_id = ?',
      whereArgs: [conversationId],
      orderBy: 'created_at DESC',
      limit: 100,
    );
    return rows.map(ChatMessage.fromRow).toList();
  }

  Future<void> deleteMessage(String id) {
    return _require.delete('messages', where: 'id = ?', whereArgs: [id]);
  }

  Future<void> replaceServiceCategories(List<ServiceCategory> items) async {
    final batch = _require.batch();
    batch.delete('service_categories');
    for (final item in items) {
      batch.insert('service_categories', item.toRow(),
          conflictAlgorithm: ConflictAlgorithm.replace);
    }
    await batch.commit(noResult: true);
  }

  Future<List<ServiceCategory>> serviceCategories() async {
    final rows = await _require.query('service_categories', orderBy: 'label ASC');
    return rows.map(ServiceCategory.fromRow).toList();
  }

  Future<void> upsertServices(List<ServiceSummary> items) async {
    final batch = _require.batch();
    for (final item in items) {
      batch.insert('services', item.toRow(), conflictAlgorithm: ConflictAlgorithm.replace);
    }
    await batch.commit(noResult: true);
  }

  Future<List<ServiceSummary>> cachedServices({String? categoryKey, String? query}) async {
    final clauses = <String>[];
    final args = <Object?>[];
    if (categoryKey != null && categoryKey != 'ALL') {
      clauses.add('category_key = ?');
      args.add(categoryKey);
    }
    if (query != null && query.isNotEmpty) {
      clauses.add('(title LIKE ? OR summary LIKE ?)');
      args.addAll(['%$query%', '%$query%']);
    }
    final rows = await _require.query(
      'services',
      where: clauses.isEmpty ? null : clauses.join(' AND '),
      whereArgs: args.isEmpty ? null : args,
      orderBy: 'title ASC',
    );
    return rows.map(ServiceSummary.fromRow).toList();
  }

  Future<ServiceSummary?> cachedServiceById(String id) async {
    final rows = await _require.query('services', where: 'id = ?', whereArgs: [id], limit: 1);
    return rows.isEmpty ? null : ServiceSummary.fromRow(rows.first);
  }

  Future<void> upsertBookings(List<Booking> items) async {
    final batch = _require.batch();
    for (final item in items) {
      batch.insert('bookings', item.toRow(), conflictAlgorithm: ConflictAlgorithm.replace);
    }
    await batch.commit(noResult: true);
  }

  Future<List<Booking>> cachedBookings({required String viewerRole, String? status}) async {
    final clauses = <String>['viewer_role = ?'];
    final args = <Object?>[viewerRole];
    if (status != null) {
      clauses.add('status = ?');
      args.add(status);
    }
    final rows = await _require.query(
      'bookings',
      where: clauses.join(' AND '),
      whereArgs: args,
      orderBy: 'start_time DESC',
    );
    return rows.map(Booking.fromRow).toList();
  }

  Future<Booking?> cachedBookingById(String id) async {
    final rows = await _require.query('bookings', where: 'id = ?', whereArgs: [id], limit: 1);
    return rows.isEmpty ? null : Booking.fromRow(rows.first);
  }

  Future<void> setMeta(String key, String value) {
    return upsert('sync_metadata', {'key': key, 'value': value});
  }

  Future<String?> meta(String key) async {
    final rows = await _require.query(
      'sync_metadata',
      where: 'key = ?',
      whereArgs: [key],
      limit: 1,
    );
    if (rows.isEmpty) {
      return null;
    }
    return asString(rows.first['value']);
  }

  Future<void> enqueueAction({
    required String id,
    required String method,
    required String path,
    String? bodyJson,
  }) {
    return upsert('pending_actions', {
      'id': id,
      'method': method,
      'path': path,
      'body_json': bodyJson,
      'created_at': DateTime.now().toIso8601String(),
      'retry_count': 0,
    });
  }

  Future<List<Map<String, Object?>>> pendingActions() {
    return _require.query('pending_actions', orderBy: 'created_at ASC');
  }

  Future<void> deletePending(String id) {
    return _require.delete('pending_actions', where: 'id = ?', whereArgs: [id]);
  }

  Future<void> saveOfflineFile({
    required String id,
    required String fileId,
    required String resourceId,
    required String localPath,
    required int versionNumber,
  }) {
    return upsert('offline_files', {
      'id': id,
      'file_id': fileId,
      'resource_id': resourceId,
      'local_path': localPath,
      'version_number': versionNumber,
      'downloaded_at': DateTime.now().toIso8601String(),
    });
  }

  Future<Map<String, Object?>?> offlineFileForResource(String resourceId) async {
    final rows = await _require.query(
      'offline_files',
      where: 'resource_id = ?',
      whereArgs: [resourceId],
      limit: 1,
    );
    return rows.isEmpty ? null : rows.first;
  }

  Future<void> deleteOfflineFile(String resourceId) {
    return _require.delete('offline_files', where: 'resource_id = ?', whereArgs: [resourceId]);
  }

  Future<CourseOfferingDetail?> offeringById(String courseOfferingId) async {
    final rows = await _require.rawQuery(
      '''
      SELECT o.*, c.code, c.title, c.department, c.faculty
      FROM course_offerings o
      JOIN courses c ON c.id = o.course_id
      WHERE o.id = ?
      LIMIT 1
      ''',
      [courseOfferingId],
    );
    if (rows.isEmpty) {
      return null;
    }
    return CourseOfferingDetail.fromRow(rows.first);
  }

  Future<Announcement?> announcementById(String id) async {
    final rows = await _require.query('announcements', where: 'id = ?', whereArgs: [id], limit: 1);
    if (rows.isEmpty) {
      return null;
    }
    return Announcement.fromRow(rows.first);
  }

  Future<List<Person>> searchPeople(String query) async {
    final rows = await _require.query(
      'persons',
      where: 'display_name LIKE ? OR username LIKE ?',
      whereArgs: ['%$query%', '%$query%'],
    );
    return rows.map(Person.fromRow).toList();
  }

  Future<List<ResourceItem>> searchResources(String query) async {
    final rows = await _require.query(
      'resources',
      where: 'title LIKE ? OR description LIKE ? OR resource_type LIKE ? OR course_code LIKE ?',
      whereArgs: ['%$query%', '%$query%', '%$query%', '%$query%'],
    );
    return rows.map(ResourceItem.fromRow).toList();
  }

  Future<void> upsertCalendarActivity(CalendarActivity item) {
    return upsert('calendar_activities', item.toRow());
  }

  Future<List<CalendarActivity>> activitiesInRange(DateTime start, DateTime end) async {
    final rows = await _require.query(
      'calendar_activities',
      where: 'start_time < ? AND end_time >= ?',
      whereArgs: [end.toIso8601String(), start.toIso8601String()],
      orderBy: 'start_time ASC',
    );
    return rows.map(_activityFromRow).toList();
  }

  CalendarActivity _activityFromRow(Map<String, Object?> row) {
    return CalendarActivity(
      id: asString(row['id']) ?? '',
      title: asString(row['title']) ?? '',
      type: asString(row['type']) ?? '',
      startTime: asDateTime(row['start_time']) ?? DateTime.now(),
      endTime: asDateTime(row['end_time']) ?? DateTime.now(),
      timezone: asString(row['timezone']) ?? 'Africa/Harare',
      status: asString(row['status']) ?? 'SCHEDULED',
      category: asString(row['category']) ?? 'SOCIAL',
      categoryLabel: asString(row['category_label']) ?? 'Campus activity',
      personal: asBool(row['personal']),
      location: asString(row['location']),
      description: asString(row['description']),
      sourceObjectType: asString(row['source_object_type']),
      sourceObjectId: asString(row['source_object_id']),
      route: asString(row['route']),
    );
  }
}
