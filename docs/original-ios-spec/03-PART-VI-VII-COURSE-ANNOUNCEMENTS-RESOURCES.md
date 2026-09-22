# ORIGINAL CAMPUSOS iOS SPECIFICATION — REPRODUCED VERBATIM

This file is the original engineering specification used to build the CampusOS iOS client. It is reproduced here so the Android agent receives the same words, the same third-person voice, and the same density.

**How the Android agent must read it**

- Every rule applies to the Android client.
- Replace "iOS app" / "iOS client" with "Android app" / "Android client" except where a sentence is about Xcode, the iOS Runner folder, or Cupertino widgets.
- If this original text and `docs/CAMPUSOS_ANDROID_AGENT_SPEC.md` disagree, the Android handoff spec and the running NestJS API win. The architecture freeze always wins.
- Do not treat "Flutter + Dart" as mandatory if you implement Kotlin, but the routes, JSON, permissions, copy, and object model remain mandatory.

---

# PART VI — COURSE DETAIL, ANNOUNCEMENTS & RESOURCES

This is the core of the **Learn** experience. The key principle is:

> **A Course Offering is the academic context; Resources, Announcements, Assignments, Discussions and People are objects inside that context.**

The iOS app must never treat the course page as a collection of independent screens. Everything should remain tied to the specific **Course Offering**.

---

## 6.1 Course Detail Entry

### Route

```text
/app/learn/course/:courseOfferingId
```

Example:

```text
/app/learn/course/coe-2026-s2-eeng401
```

The ID refers to the **Course Offering**, not merely `EENG401`.

That distinction matters because:

```text
EENG401 Control Systems
│
├── 2025 Semester 1
├── 2025 Semester 2
├── 2026 Semester 1
└── 2026 Semester 2 ← current offering
```

The student should therefore never accidentally see announcements or resources from the wrong semester.

---

# 6.2 Course Header

The top of the page contains:

```text
← EENG401

CONTROL SYSTEMS
EENG401 · 2026 Semester 2

Dr John Moyo
Electrical Engineering

[Course status / active indicator]
```

Optional:

```text
Next:
Lecture — Tuesday 10:00
```

### Header information

The backend may return:

```json
{
  "courseOfferingId": "...",
  "courseId": "...",
  "code": "EENG401",
  "title": "Control Systems",
  "semester": "2026 Semester 2",
  "status": "ACTIVE",
  "department": "Electrical Engineering",
  "faculty": "Engineering",
  "lecturers": [],
  "nextActivity": {}
}
```

### Important

The UI should not reconstruct the course identity from several independent API calls if the backend already provides the canonical representation.

---

# 6.3 Course Navigation

Immediately below the header:

```text
Overview | Announcements | Resources | Assignments | Tests & Exams | Laboratory | Discussion | Study Groups | People
```

On iPhone, this should be a **horizontally scrollable tab bar**.

Do not attempt to display every tab simultaneously.

Example:

```text
Overview  Announcements  Resources  Assignments  →
```

Swiping horizontally reveals the remaining tabs.

### Tab state

The selected tab must be represented in more than one way:

* text
* position/indicator
* accessibility selected state

Never rely purely on colour.

---

# 6.4 Course Overview

Route:

```text
/app/learn/course/:courseOfferingId/overview
```

Purpose:

> Give the student a concise understanding of what this course is and what is currently happening.

### Layout

```text
COURSE OVERVIEW

About
────────────────────
Course description...

Learning outcomes
────────────────────
• Understand...
• Analyse...
• Design...

Course outline
────────────────────
1. Introduction
2. Modelling
3. Stability
4. Control design

Teaching team
────────────────────
Dr John Moyo
Lecturer

Jane Smith
Teaching Assistant

References
────────────────────
Recommended textbooks...
```

Additional configurable sections can be added by authorized academic users.

### Backend

```http
GET /api/v1/course-offerings/{courseOfferingId}
```

Possible expanded response:

```json
{
  "courseOffering": {},
  "overview": {
    "description": "...",
    "learningOutcomes": [],
    "outline": [],
    "references": []
  },
  "personnel": [],
  "nextActivities": []
}
```

---

# 6.5 Announcements

Route:

```text
/app/learn/course/:courseOfferingId/announcements
```

Announcements are **course-scoped communication objects**.

They are not ordinary social posts.

### Announcement object

```text
Announcement
├── id
├── courseOfferingId
├── authorId
├── title
├── body
├── attachments
├── priority
├── publishedAt
├── expiresAt
├── status
├── createdAt
└── updatedAt
```

Possible priority:

```text
NORMAL
IMPORTANT
URGENT
```

### Example

```text
IMPORTANT

CONTROL SYSTEMS TEST

The first class test will be held on
Thursday at 10:00.

Topics:
• Transfer functions
• Block diagrams
• Stability

Posted by Dr John Moyo
2 hours ago
```

### Student view

Students can:

* read
* open attachments
* react if enabled
* reply if discussion is enabled
* share into permitted CampusOS conversations
* mark as read

They cannot modify the announcement.

---

# 6.6 Announcement Permissions

### Lecturer

Depending on assigned permissions:

```text
VIEW
CREATE
EDIT
PUBLISH
ARCHIVE
```

### Class Representative

May have contextual permission to:

```text
VIEW
CREATE
EDIT
PUBLISH
```

where the class/course configuration grants it.

### Student

Normally:

```text
VIEW
INTERACT
```

No client-side assumption should determine this.

The backend performs the final authorization check.

---

# 6.7 Announcement APIs

Create:

```http
POST /api/v1/course-offerings/{courseOfferingId}/announcements
```

List:

```http
GET /api/v1/course-offerings/{courseOfferingId}/announcements
```

Retrieve:

```http
GET /api/v1/announcements/{announcementId}
```

Update:

```http
PATCH /api/v1/announcements/{announcementId}
```

Archive:

```http
POST /api/v1/announcements/{announcementId}/archive
```

Mark read:

```http
POST /api/v1/announcements/{announcementId}/read
```

Every mutating endpoint performs:

```text
Authentication
↓
Role
↓
Course membership/context
↓
Permission
↓
Object state
↓
Policy
↓
Action
```

---

# 6.8 Announcement Notifications

An announcement does not automatically mean a push notification.

Instead:

```text
Announcement Published
        ↓
Notification Rule
        ↓
Priority evaluation
        ↓
User notification preferences
        ↓
Delivery
```

### Important announcement

Potential:

```text
In-app ✓
Push ✓
```

### Ordinary announcement

Potential:

```text
In-app ✓
Push ✕
```

### Urgent announcement

Potential:

```text
In-app ✓
Push ✓
```

The notification links directly to:

```text
Course → Announcement
```

---

# PART VII — RESOURCE SYSTEM

This is one of the most important parts of CampusOS.

The architecture must distinguish:

> **File ≠ Resource**

A PDF is a **File**.

“EENG401 2026 S2 Lecture 4 — Root Locus” is a **Resource**.

The Resource owns the academic meaning and provenance.

---

# 7.1 Resource Architecture

```text
Resource
│
├── metadata
├── academic context
├── ownership/provenance
├── permissions
├── lifecycle
├── versions
└── File
       │
       ├── physical object storage
       ├── MIME type
       ├── size
       ├── checksum
       └── processing state
```

This allows:

* versioning
* duplicate detection
* authorship preservation
* lecturer endorsement
* historical discovery
* permission control
* offline storage

without treating the physical PDF as the academic object.

---

# 7.2 Resource Categories

Inside Resources:

```text
Resources

Official Course Resources
─────────────────────────
Lecture Notes
Slides
Tutorials
Laboratory Manuals
Reference Material
Solutions
Course Outline

Student Resources
─────────────────────────
Student Notes
Study Guides
Worked Examples
Student Solutions
Past Papers

Historical Resources
─────────────────────────
2025
2024
2023
...
```

The exact categories should be configurable.

Do not hard-code the entire taxonomy into Flutter.

---

# 7.3 Resource List

Route:

```text
/app/learn/course/:courseOfferingId/resources
```

Example:

```text
RESOURCES

[Search resources...]

OFFICIAL COURSE RESOURCES

Lecture 05 — Root Locus
PDF · 4.2 MB
Uploaded by Dr John Moyo
Today

Control Systems Tutorial 2
PDF · 1.8 MB
Uploaded 2 days ago

STUDENT RESOURCES

EENG401 Study Guide
PDF · 2.4 MB
Uploaded by Tawanda M.
2026 S2

HISTORICAL

2025 Semester 2
12 resources →
```

---

# 7.4 Resource Search

The course resource screen should support contextual search.

```text
Search this course
```

Queries:

```text
root locus
transfer function
2025 test
solution
tutorial 3
```

The same search architecture is used globally, but the context filter is:

```text
courseOfferingId
```

Historical search may expand context:

```text
Current Offering
+
Historical Offerings
```

depending on permissions.

---

# 7.5 Resource Metadata

Every Resource should have:

```text
id
title
description
resourceType
courseOfferingId
courseId
programmeScope
uploadedBy
authoredBy
createdAt
updatedAt
publishedAt
status
visibility
currentVersionId
versionNumber
fileId
academicYear
semester
classScope
solutionAvailable
endorsementStatus
```

Not every field must be visible to students.

---

# 7.6 Provenance

Provenance is critical.

CampusOS must be able to answer:

> Who uploaded this?

> Who authored it?

> Where did it originate?

> Was it endorsed?

> Which course/offering was it associated with?

> Which version am I looking at?

Example:

```text
EENG401 Tutorial 3

Uploaded by:
Tawanda M.

Author:
Tawanda M.

Course:
EENG401 — Control Systems

Offering:
2026 Semester 2

Uploaded:
14 September 2026

Endorsed by:
Dr John Moyo

Endorsed:
15 September 2026
```

Endorsement does **not** change authorship.

---

# 7.7 Lecturer Endorsement

A lecturer can endorse a student resource.

Example:

```text
✓ Lecturer endorsed

Dr John Moyo
Verified this resource as useful for EENG401.
```

Backend object:

```text
ResourceEndorsement
├── id
├── resourceId
├── endorserId
├── endorsementType
├── comment
├── createdAt
└── revokedAt
```

Possible:

```text
ENDORSED
ENDORSEMENT_REVOKED
```

The student remains the original uploader/author.

---

# 7.8 Resource Metadata Editing — 45 Minutes

When a student uploads a resource, they can correct metadata for **45 minutes**.

For example:

```text
Uploaded:
EENG401 Test 01 2026

Edit
```

They may change:

* title
* description
* category
* academic year
* resource type
* solution availability

After 45 minutes:

```text
Metadata locked

Request correction
```

The server, not the phone, determines whether the 45-minute window remains open.

### Why?

Because device time cannot be trusted.

Backend:

```text
editableUntil = createdAt + 45 minutes
```

The API returns:

```json
{
  "canEditMetadata": true,
  "editableUntil": "2026-09-15T23:12:00Z"
}
```

---

# 7.9 Resource Versioning

If the underlying academic material changes, do not silently overwrite the old file.

Example:

```text
Control_Systems_Tutorial_3

Version 1
Uploaded 10 Sep

Version 2
Corrected equation
Uploaded 11 Sep

Version 3
Final version
Uploaded 12 Sep
```

Students see:

```text
Version 3 · Current
```

Historical versions remain available according to permissions.

### Version object

```text
ResourceVersion
├── id
├── resourceId
├── versionNumber
├── fileId
├── uploadedBy
├── changeSummary
├── checksum
├── createdAt
└── status
```

---

# 7.10 Duplicate Detection

CampusOS should detect duplicate physical files.

During upload:

```text
File
 ↓
Checksum
 ↓
Compare existing files
```

If an exact duplicate exists:

```text
SHA-256 = existing SHA-256
```

the system may reuse the same physical object.

But the Resources remain separate.

For example:

```text
Resource A
EENG401 2025 Tutorial

Resource B
EENG401 2026 Tutorial
```

could reference the same physical file.

This preserves provenance.

---

# 7.11 Near-Duplicate Detection

MVP should support **exact duplicate detection**.

Do not over-engineer semantic similarity initially.

Future versions may detect:

* renamed copies
* slightly modified PDFs
* scanned duplicates
* near-identical lecture notes

This should be introduced only after actual usage justifies it.

---

# 7.12 File Upload Pipeline

The iOS app must **not** simply upload a file and immediately declare the resource published.

Pipeline:

```text
User selects file
       ↓
Create upload session
       ↓
Upload file
       ↓
Validate
       ↓
Malware/security scan
       ↓
Store object
       ↓
Calculate checksum
       ↓
Extract metadata
       ↓
Generate preview/thumbnail if applicable
       ↓
Create Resource
       ↓
Apply permissions
       ↓
Moderation/policy
       ↓
Publish
```

The UI should show the actual state.

Example:

```text
Uploading... 72%

Processing...

Checking file...

Ready ✓
```

Never:

```text
Uploaded ✓
```

when the server has not confirmed completion.

---

# 7.13 Upload API

Create upload session:

```http
POST /api/v1/files/upload-sessions
```

Response:

```json
{
  "uploadId": "...",
  "fileId": "...",
  "uploadUrl": "...",
  "expiresAt": "..."
}
```

After upload:

```http
POST /api/v1/files/{fileId}/complete
```

Create resource:

```http
POST /api/v1/course-offerings/{courseOfferingId}/resources
```

Example:

```json
{
  "title": "EENG401 Tutorial 3",
  "resourceType": "TUTORIAL",
  "description": "Root locus tutorial",
  "fileId": "...",
  "visibility": "COURSE_MEMBERS"
}
```

The server checks that the user is actually allowed to create that Resource.

---

# 7.14 Resource Permissions

Different resources can have different visibility.

Examples:

```text
PUBLIC
AUTHENTICATED_USERS
COURSE_MEMBERS
CLASS_MEMBERS
STUDY_GROUP_MEMBERS
PRIVATE
```

But the effective decision is still:

```text
Person
+ Role
+ Relationship
+ Object
+ Action
+ Object State
+ Privacy
+ Policy
```

A student cannot gain access simply because they know a resource URL.

---

# 7.15 File Access

Do not expose permanent unrestricted storage URLs.

Instead:

```text
CampusOS API
      ↓
Authorization
      ↓
Short-lived signed access
      ↓
Object storage
```

Actions are independent:

```text
VIEW
DOWNLOAD
SHARE
SAVE_OFFLINE
```

Having `VIEW` does not automatically imply every other permission.

---

# 7.16 Resource Viewer

When a student taps:

```text
EENG401 Tutorial 3
```

open:

```text
/app/learn/resource/:resourceId
```

Viewer header:

```text
←

EENG401 Tutorial 3

[Share] [More]
```

Document area:

```text
┌──────────────────────────────┐
│                              │
│        PDF PREVIEW           │
│                              │
│                              │
└──────────────────────────────┘
```

Bottom controls:

```text
Page 3 of 14

−     100%     +
```

Depending on file type:

* PDF viewer
* image viewer
* audio player
* video player
* document preview

Unsupported formats display an appropriate fallback.

---

# 7.17 Resource Detail Information

A bottom sheet or information section:

```text
ABOUT THIS RESOURCE

EENG401 Tutorial 3

Type
Tutorial

Course
EENG401 — Control Systems

Uploaded by
Tawanda M.

Uploaded
12 September 2026

Version
2

✓ Lecturer endorsed

Dr John Moyo
```

Actions:

```text
Save offline
Share
Report
View details
```

---

# 7.18 Save Offline

Offline storage is **CampusOS-managed**, not simply "download to Downloads."

When the student selects:

```text
Save offline
```

the app:

```text
Check permission
       ↓
Request file
       ↓
Store encrypted/protected local copy
       ↓
Link to Resource ID + Version ID
       ↓
Mark offline_available
```

SQLite:

```text
offline_files
├── id
├── fileId
├── resourceId
├── resourceVersionId
├── localPath
├── downloadedAt
├── size
└── state
```

Possible states:

```text
QUEUED
DOWNLOADING
AVAILABLE
FAILED
STALE
REMOVED
```

---

# 7.19 Offline Resource Lifecycle

Suppose a lecturer replaces Version 1 with Version 2.

The student's offline copy of Version 1 should not silently become Version 2.

Instead:

```text
Offline copy:
Version 1

Server:
Version 2 available
```

UI:

```text
A newer version is available.

[Update]
```

This preserves predictable offline behaviour.

If the resource is later restricted or removed, synchronization evaluates whether the locally stored copy should remain accessible.

For sensitive/restricted material, local access may need to be revoked.

---

# 7.20 Sharing

Sharing must be explicit.

A student can share a resource into:

* a direct conversation
* group conversation
* class conversation
* course conversation
* study group

CampusOS should share the **Resource reference**, not simply dump a raw public URL.

Example:

```text
Tawanda shared:

┌──────────────────────────────┐
│ EENG401 Tutorial 3           │
│ Tutorial · PDF               │
│ ✓ Lecturer endorsed          │
└──────────────────────────────┘
```

Recipient taps it.

CampusOS then performs a fresh permission check.

If they no longer have access:

```text
This resource is no longer available to you.
```

---

# 7.21 Historical Resources

Historical resources are important for CampusOS.

Example:

```text
EENG401

2026 S2
Current

2025 S2
Archived

2025 S1
Archived

2024 S2
Archived
```

A student may search:

```text
EENG401 2025 test
```

and receive:

```text
2025 S2 · In-Class Test 1
2025 S2 · Lecturer Solution
2025 S1 · Test 2
```

Every historical result clearly shows its origin.

Never make old resources appear to belong to the current offering.

---

# 7.22 Past Examination Papers

Past papers are simply Resources with an appropriate type:

```text
PAST_EXAM
PAST_TEST
PAST_ASSIGNMENT
```

Example:

```text
EENG401 Final Examination
2025 Semester 2

Past examination paper
No solution attached
```

If a solution exists:

```text
Related resources

2025 EENG401 Final Exam
↳ Official Solution
↳ Student Worked Solution
```

This relationship should be explicit in the backend.

---

# 7.23 Resource Relationships

Use relationships instead of encoding everything in filenames.

```text
Resource A
2025 Final Exam

RELATED_TO

Resource B
2025 Official Solution
```

Relationship types:

```text
SOLUTION_TO
REVISION_OF
RELATED_TO
REFERENCE_FOR
PART_OF
```

This allows the UI to show:

```text
Related resources
```

without guessing based on filenames.

---

# 7.24 SQLite Resource Tables

At minimum:

```text
resources
resource_versions
resource_endorsements
resource_relationships
files
offline_files
```

### `resources`

```text
id
course_id
course_offering_id
title
description
resource_type
visibility
status
uploaded_by
authored_by
current_version_id
created_at
updated_at
published_at
editable_until
```

### `resource_versions`

```text
id
resource_id
version_number
file_id
uploaded_by
change_summary
checksum
created_at
status
```

### `resource_endorsements`

```text
id
resource_id
endorser_id
endorsement_type
comment
created_at
revoked_at
```

---

# 7.25 Flutter Architecture

Feature:

```text
features/
└── resources/
    ├── data/
    │   ├── resource_api.dart
    │   ├── resource_local_datasource.dart
    │   └── resource_repository_impl.dart
    ├── domain/
    │   ├── entities/
    │   ├── repositories/
    │   └── use_cases/
    └── presentation/
        ├── providers/
        ├── screens/
        ├── widgets/
        └── controllers/
```

Repository:

```dart
abstract class ResourceRepository {
  Future<List<Resource>> getCourseResources(
    String courseOfferingId,
  );

  Future<Resource> getResource(String resourceId);

  Future<void> saveOffline(String resourceId);

  Future<void> removeOffline(String resourceId);

  Future<ResourceUpload> uploadResource(...);

  Future<void> markAsRead(String resourceId);
}
```

The UI must never call the HTTP client directly.

---

# 7.26 Riverpod Providers

Examples:

```text
courseOfferingProvider
courseOverviewProvider
courseAnnouncementsProvider
courseResourcesProvider
resourceProvider
resourceVersionsProvider
resourceOfflineStateProvider
resourceUploadController
```

Conceptually:

```text
UI
 ↓
Riverpod
 ↓
Repository
 ↓
Local DB + API
 ↓
Sync
```

---

# 7.27 Offline Resource Loading

When opening Resources:

```text
Try local cache
       ↓
Display cached resources immediately
       ↓
Show freshness state
       ↓
Attempt server refresh
       ↓
Merge authorized server state
```

Example:

```text
Resources
Updated 4 minutes ago
```

If offline:

```text
Offline
Showing saved resources
```

No fake loading spinner forever.

---

# 7.28 Resource Loading States

### First load

```text
Loading skeleton
```

### Loaded

```text
Resource list
```

### Empty

```text
No resources yet.

Resources uploaded for this course
will appear here.
```

### Offline with cache

```text
Showing resources saved on this device.
Last updated yesterday.
```

### Offline without cache

```text
You're offline.

Connect to the internet to load
course resources.
```

### Permission revoked

```text
This resource is no longer available.
```

### Processing

```text
Resource processing

This file is still being checked.
We'll make it available when processing
is complete.
```

---

# 7.29 Notifications From Resources

Resource upload itself should normally be:

```text
In-app notification
```

rather than an immediate push.

Exceptions can be configured.

For example:

```text
Lecturer uploads corrected examination guide
```

may generate a higher-priority notification.

Notification:

```text
New resource

EENG401 — Control Systems

"Exam Revision Guide" was added.

[Open]
```

---

# 7.30 Accessibility

Every resource row must expose:

```text
Title
Type
Course
Author/uploader
Endorsement status
Version
Offline state
```

to VoiceOver.

Example accessibility label:

> “EENG401 Tutorial 3, tutorial PDF, uploaded by Tawanda M, lecturer endorsed, version 2, saved offline.”

Buttons:

```text
Save offline
Share
More
```

must have explicit accessibility labels.

Document viewer must support:

* Dynamic Type around metadata
* VoiceOver
* logical reading order
* accessible controls
* sufficient contrast
* no colour-only status
* reduced motion

---

# 7.31 Security Requirements

The iOS app must never:

* trust client permissions
* expose registration numbers
* expose private verification evidence
* assume course membership grants every action
* expose unrestricted object-storage URLs
* treat cached authorization as permanent
* allow stale client state to overwrite newer server state

Every resource mutation is server-authorized.

Sensitive local data is protected using iOS secure storage/device security mechanisms.

---

# 7.32 Analytics

Analytics should measure product behaviour without collecting unnecessary academic/private content.

Useful events:

```text
course_opened
announcement_opened
resource_opened
resource_search
resource_saved_offline
resource_removed_offline
resource_shared
resource_upload_started
resource_upload_completed
resource_upload_failed
resource_reported
```

Do not record:

* document contents
* private messages
* registration numbers
* verification images
* sensitive personal data

unless explicitly required for a legitimate technical/security purpose.

---

# 7.33 Deep Linking

Example:

```text
campusos://course/eeng401-2026-s2/resource/res-123
```

Flow:

```text
Deep link
 ↓
Authenticate
 ↓
Resolve resource
 ↓
Check permission
 ↓
Check lifecycle
 ↓
Open canonical resource screen
```

If unauthorized:

```text
You don't have access to this resource.
```

If deleted:

```text
This resource has been removed.
```

If archived:

```text
Open archived resource
```

subject to permissions.

---

# 7.34 Course-Level Acceptance Criteria

The iOS implementation is complete only when:

### Course

* [ ] Course Offering is distinct from Course.
* [ ] Correct semester/offering is displayed.
* [ ] Course permissions are server-authoritative.
* [ ] Historical offerings are distinguishable.
* [ ] Course tabs work through deep links.
* [ ] Course overview loads offline from cache.

### Announcements

* [ ] Authorized lecturers/reps can create according to permissions.
* [ ] Students can read announcements.
* [ ] Important announcements can trigger notifications.
* [ ] Archived announcements remain historically accessible where permitted.
* [ ] Read state synchronizes across devices.

### Resources

* [ ] Resources are separate domain objects from Files.
* [ ] Provenance is preserved.
* [ ] Lecturer endorsement does not replace authorship.
* [ ] Metadata has the 45-minute edit window.
* [ ] Resource versions are preserved.
* [ ] Exact duplicate files are detected.
* [ ] Historical resources retain their original offering.
* [ ] Past papers can be searched.
* [ ] Related resources are supported.
* [ ] Permissions are checked server-side.
* [ ] Files use protected access.
* [ ] Offline resources are managed by CampusOS.
* [ ] Resource sharing performs fresh authorization.
* [ ] Removed/restricted resources synchronize correctly.
* [ ] Upload progress and processing states are truthful.
* [ ] Failed uploads can retry safely.
* [ ] Offline state is visible.
* [ ] VoiceOver provides meaningful resource information.

---

## 6.35 The resulting academic flow

At this point the student's journey becomes:

```text
LEARN
  │
  ├── My Courses
  │      │
  │      └── EENG401 Control Systems
  │               │
  │               ├── Overview
  │               │
  │               ├── Announcements
  │               │
  │               ├── Resources
  │               │      ├── Official
  │               │      ├── Student
  │               │      └── Historical
  │               │
  │               ├── Assignments
  │               │
  │               ├── Tests & Exams
  │               │
  │               ├── Laboratory
  │               │
  │               ├── Discussion
  │               │
  │               ├── Study Groups
  │               │
  │               └── People
```

And importantly, **all of these remain connected to the same backend academic model** rather than becoming separate mini-applications.

### Next

The next section should be **PART VIII — ASSIGNMENTS, TESTS & EXAMS + LABORATORY**, including their Activity/calendar integration, deadlines, submission-boundary design, lecturer/class-rep permissions, reminders, historical assessments, and how CampusOS avoids pretending to be a full LMS.
