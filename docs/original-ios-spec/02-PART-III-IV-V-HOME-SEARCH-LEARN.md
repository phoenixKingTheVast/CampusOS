# ORIGINAL CAMPUSOS iOS SPECIFICATION — REPRODUCED VERBATIM

This file is the original engineering specification used to build the CampusOS iOS client. It is reproduced here so the Android agent receives the same words, the same third-person voice, and the same density.

**How the Android agent must read it**

- Every rule applies to the Android client.
- Replace "iOS app" / "iOS client" with "Android app" / "Android client" except where a sentence is about Xcode, the iOS Runner folder, or Cupertino widgets.
- If this original text and `docs/CAMPUSOS_ANDROID_AGENT_SPEC.md` disagree, the Android handoff spec and the running NestJS API win. The architecture freeze always wins.
- Do not treat "Flutter + Dart" as mandatory if you implement Kotlin, but the routes, JSON, permissions, copy, and object model remain mandatory.

---

# CampusOS iOS — Screen-by-Screen Engineering Specification v1.0

# PART III — HOME

**Screen:** Home
**Route:** `/app/home`
**Primary purpose:** Personal campus command centre.

Home is **not** a generic social-media feed. It is the user's prioritized view of what they need to know, do, attend, and discover.

The canonical hierarchy is:

```text
┌──────────────────────────────────────┐
│ Header                               │
│ CampusOS                 🔔   Avatar │
├──────────────────────────────────────┤
│ Global Search                        │
├──────────────────────────────────────┤
│ Up Next                              │
├──────────────────────────────────────┤
│ Today                                │
├──────────────────────────────────────┤
│ Needs Your Attention                │
├──────────────────────────────────────┤
│ Your Campus                          │
├──────────────────────────────────────┤
│ Discover                             │
└──────────────────────────────────────┘
```

---

# 1. Home Responsibilities

Home aggregates information from multiple domain objects.

It does **not** create a new "Home Object."

It consumes:

* Activities
* Assignments
* Courses
* Classes
* Events
* Organizations
* Notifications
* Services
* Study Groups
* Conversations
* User preferences

Architecture:

```text
Domain Objects
      ↓
Home Query/Application Service
      ↓
Permission Filtering
      ↓
Relevance/Priority Rules
      ↓
Home Response
      ↓
Flutter Home Repository
      ↓
SQLite Cache
      ↓
Home UI
```

---

# 2. Home API

Primary endpoint:

```http
GET /api/v1/home
```

Optional parameters:

```text
?date=2026-09-15
&timezone=Africa/Harare
```

The client sends the user's effective timezone.

The backend should not assume the phone's current timezone equals the university's timezone.

---

# 3. Home Response Contract

Conceptual response:

```json
{
  "generatedAt": "2026-09-15T20:10:00Z",
  "timezone": "Africa/Harare",

  "upNext": [],
  "today": [],
  "attention": [],
  "campus": [],
  "discover": [],

  "unreadNotificationCount": 3,
  "unreadMessageCount": 2,

  "context": {
    "primaryClassId": "class_123",
    "activeSemesterId": "semester_2026_s2"
  }
}
```

The exact object schemas should be defined in the shared API contracts package.

---

# 4. Home Data Rules

The server must apply:

1. authentication
2. authorization
3. relationship rules
4. privacy
5. object lifecycle
6. user context
7. temporal relevance

before returning content.

The client must never receive unauthorized objects merely because the UI intends to hide them.

---

# 5. Home Header

### Layout

```text
Good evening, Matthew

[CampusOS]                         🔔  [Avatar]
```

The greeting is generated locally from time where possible.

The person's actual name comes from the Person object.

### Header actions

#### Notification icon

Opens:

```text
/app/notifications
```

Badge displays unread notification count.

#### Avatar

Opens:

```text
/app/profile
```

---

# 6. Global Search Entry

Home contains the global search entry.

```text
[ 🔍 Search CampusOS ]
```

Tap:

```text
Home
 ↓
Search
```

Search itself is specified later, but Home must use the shared search component rather than creating another search implementation.

---

# 7. Up Next

This is the highest-priority Home section.

Purpose:

> What is the next meaningful thing the user needs to know about or attend?

Potential sources:

* lecture
* laboratory
* assignment deadline
* test
* exam
* event
* organization meeting
* study group
* service booking

---

# 8. Up Next Selection

The backend should select the most relevant upcoming Activity.

Conceptual process:

```text
Candidate Activities
        ↓
Permission Filter
        ↓
User Context
        ↓
Time Window
        ↓
Status Filter
        ↓
Relevance
        ↓
Up Next
```

Do not simply sort every event chronologically.

A low-value event occurring before an important academic deadline should not automatically displace the deadline.

---

# 9. Up Next Card

Example:

```text
UP NEXT

Control Systems
Lecture

Today · 10:00–11:00
Engineering Block A

Starts in 35 min

[ View ]
```

The card should communicate:

* source
* type
* title
* time
* location where relevant
* relative timing
* action

---

# 10. Up Next States

### Future

```text
Starts in 35 min
```

### Starting soon

```text
Starts in 5 min
```

### Ongoing

```text
Happening now
```

### Completed

It should normally leave Up Next.

### Cancelled

It should not remain as a normal upcoming item.

---

# 11. Today

Today contains a chronological summary of relevant activities.

Example:

```text
TODAY

09:00
EEE401 Lecture

11:00
Control Systems Lab

14:00
Assignment deadline

18:00
Engineering Society meeting
```

The full calendar remains the canonical detailed view.

Home only summarizes.

---

# 12. Today Data

Endpoint can be represented as part of Home:

```json
{
  "today": [
    {
      "activityId": "activity_1",
      "type": "LECTURE",
      "title": "EEE401 Lecture",
      "startTime": "...",
      "endTime": "...",
      "status": "SCHEDULED"
    }
  ]
}
```

---

# 13. Today Interaction

Tapping an item:

```text
Today activity
      ↓
Activity Detail
      ↓
Source Object
```

For example:

```text
Lecture Activity
      ↓
Course Offering
```

The Activity itself does not become the course.

---

# 14. Needs Your Attention

This section contains things requiring action.

Examples:

* assignment due soon
* pending class verification
* unread important announcement
* upcoming test
* booking requiring confirmation
* failed synchronization action
* verification issue
* important system/security notification

It should **not** become a list of every notification.

---

# 15. Attention Priority

Use explicit priority from the source object/rule:

```text
CRITICAL
HIGH
NORMAL
LOW
```

Example:

```text
NEEDS YOUR ATTENTION

⚠ Assignment due tomorrow
EEE401 · Power Electronics

New class announcement
EEE 4.1

Booking confirmation required
Campus Laundry
```

---

# 16. Attention Actions

Each card must have an obvious next action.

Examples:

```text
[View assignment]
[Read announcement]
[Confirm booking]
[Review]
```

The action routes to the canonical object.

---

# 17. Your Campus

This section answers:

> What's happening in the student's immediate university environment?

Potential content:

* class announcements
* organization activity
* campus events
* relevant service availability
* campus-wide information
* activities from followed organizations
* activities from memberships

It is contextual rather than algorithmically endless.

---

# 18. Your Campus Privacy

The backend must only include objects the user can legitimately see.

For example:

```text
Class announcement
```

may be visible because:

```text
User
 ↓
ACTIVE ClassMembership
 ↓
Class
 ↓
Announcement
```

Whereas another class's private discussion must not appear.

---

# 19. Discover

Discover is the exploratory section.

Examples:

```text
DISCOVER

Chess Club
Tonight · Student Centre

Engineering Society
New event announced

Campus Printing
Open until 18:00
```

Discover may include:

* organizations
* public events
* services
* study groups
* campus activities

---

# 20. Discover Must Not Become an Unbounded Feed

Home should not silently turn into:

```text
Post
Post
Post
Post
Post
Post
...
```

If the user wants broad discovery:

```text
Home → Explore
```

Explore owns discovery.

---

# 21. Home Pagination

Home should not download everything.

Initial request returns a bounded set.

For example:

```text
Up Next: 1
Today: limited relevant activities
Attention: limited
Campus: limited
Discover: limited
```

"See all" routes to the appropriate source:

```text
See all calendar
See all notifications
See all events
See all organizations
```

---

# 22. Pull to Refresh

Pull-to-refresh:

```text
User pulls
 ↓
GET /home
 ↓
Update local cache
 ↓
Re-render
```

Display refresh state without blocking the whole screen unnecessarily.

If refresh fails but cached data exists:

```text
Couldn't refresh

Showing information from 5 minutes ago.
```

---

# 23. Home Loading State

Do not show a blank screen.

Use skeletons matching actual layout.

Example:

```text
Header skeleton

Search skeleton

Up Next skeleton

Today skeleton

Attention skeleton
```

Avoid excessive animation.

---

# 24. Home Empty State

If a student genuinely has no upcoming activity:

```text
You're all caught up

Nothing needs your attention right now.
```

Then still show:

```text
Your Campus
Discover
```

The user should never encounter an empty application merely because their calendar is empty.

---

# 25. Home Offline State

If cached data exists:

```text
You're offline
Showing recently synced information.
```

Cached sections remain available according to permissions.

Do not display stale information as though it were live.

Use:

```text
Last updated 12 min ago
```

where useful.

---

# 26. Home First-Time State

A new user without academic membership may see:

```text
Welcome to CampusOS

Connect your university identity
to unlock your academic campus.

[Verify student status]
```

They can still see appropriate public CampusOS content.

---

# 27. Home Permission Changes

Suppose the user loses class membership while offline.

The client may still have cached class content.

Once synchronized:

```text
Server says:
membership = ENDED
```

Then:

```text
Remove restricted class content
Invalidate affected cache
Update Home
```

The app must not continue displaying restricted current information simply because it was previously cached.

---

# 28. Home State Management

Suggested Riverpod structure:

```text
homeProvider
homeRepositoryProvider
homeRefreshProvider
homeConnectivityProvider
```

Conceptual state:

```text
HomeState
├── loading
├── data
├── refreshing
├── offline
├── error
└── lastUpdated
```

Do not create one global mutable state object containing the entire CampusOS application.

---

# 29. Home Repository

```text
HomeRepository
├── getCachedHome()
├── getHome()
└── refreshHome()
```

Repository flow:

```text
UI
 ↓
HomeProvider
 ↓
HomeRepository
 ├── SQLite
 └── API
```

---

# 30. Home Local Cache

Home itself should not necessarily be stored as one giant JSON blob.

Store the underlying objects:

```text
Activities
Announcements
Events
Organizations
Notifications
Services
```

Then construct the Home view from cached domain objects where practical.

This prevents Home from becoming a second database.

---

# 31. Home Analytics

Track product behaviour without collecting sensitive academic or private data unnecessarily.

Examples:

```text
home_opened
home_refresh
home_section_viewed
home_item_opened
home_discover_opened
```

Do not send:

* OTP
* access tokens
* registration number
* student ID image
* private message contents

Analytics should use opaque IDs where necessary.

---

# 32. Home Accessibility

Every interactive component must:

* have a semantic label
* be reachable by VoiceOver
* expose meaningful state
* support Dynamic Type
* have adequate contrast
* maintain logical reading order
* not depend solely on colour

Example:

Instead of VoiceOver reading:

> red circle

it should read:

> Assignment due tomorrow, high priority.

---

# 33. Home iPhone Layout

The layout must adapt across iPhone sizes.

### Small screen

Reduce:

* card padding
* secondary metadata
* unnecessary decoration

Do **not** remove essential actions.

### Large screen

Allow more breathing room but preserve hierarchy.

Do not simply stretch every card to the full physical width without regard to readability.

---

# 34. Home Rotation

Support portrait as the primary experience.

Landscape support should not break:

* navigation
* cards
* text
* accessibility
* interaction targets

---

# 35. Home Notifications Integration

The notification badge is independent from Home content.

For example:

```text
Unread notification count = 4
```

does not mean Home must display four notification cards.

Home surfaces only notifications that meet Home relevance rules.

---

# 36. Home Messaging Integration

Unread messages may appear under attention if they meet appropriate relevance rules.

But Home must not expose private conversation content.

Example:

```text
2 unread messages
```

rather than:

> Matthew: "Are you coming to..."

unless that preview is intentionally permitted by the user's privacy/device notification settings.

---

# 37. Home Security

The backend must prevent:

* cross-user Home data leakage
* cross-class data leakage
* private event leakage
* private organization information leakage
* unauthorized service bookings
* unauthorized academic content

The mobile application must treat all Home API responses as potentially sensitive.

---

# 38. Home Acceptance Criteria

Home is complete when:

### Functional

* user can open Home
* current identity appears
* notification count appears
* global search opens
* Up Next displays appropriate Activity
* Today displays relevant activities
* Attention displays actionable items
* Campus displays contextual content
* Discover displays appropriate public/discoverable content
* tapping an item reaches the canonical object
* refresh works
* offline cache works
* stale state is communicated
* unauthorized objects never appear
* archived/cancelled objects behave correctly

### Technical

* Home uses repository architecture
* Home data is server-authoritative
* SQLite cache exists
* API contracts are typed
* loading/error/empty/offline states exist
* accessibility is implemented
* analytics are privacy-safe
* tests exist for major state transitions.

---

# PART IV — SEARCH

Search is a **platform capability**, not merely a Home feature.

## 39. Search Entry

Route:

```text
/app/search
```

It can be opened from:

* Home
* Learn
* Explore
* contextual search controls

---

# 40. Search Screen

Initial state:

```text
Search CampusOS

[ 🔍 Search courses, people, events... ]

Recent searches
```

No results are displayed before a query unless useful recent searches exist.

---

# 41. Search Categories

Top filter tabs:

```text
Everything
People
Courses
Classes
Organizations
Events
Resources
Study Groups
Services
```

These correspond to domain object types.

---

# 42. Search API

```http
GET /api/v1/search
```

Example:

```text
GET /api/v1/search?q=power+electronics&type=all
```

Optional:

```text
page
limit
context
filters
```

---

# 43. Search Architecture

```text
Domain Objects
      ↓
Search Index
      ↓
Text + Metadata + Relationships
      ↓
Query
      ↓
Candidate Results
      ↓
Permission Filter
      ↓
Context Filter
      ↓
Ranking
      ↓
Results
```

The search index is **derived data**.

PostgreSQL/domain objects remain authoritative.

---

# 44. Permission Filtering

This is critical.

Suppose a private class resource contains:

> "EEE 401 Test Answers"

If the user cannot access it, search must not return:

```text
EEE401 Test Answers
```

and then show:

> You don't have permission to view this.

That leaks metadata.

Instead, unauthorized objects are excluded before presentation.

---

# 45. Search Result Card

Example:

```text
Power Electronics

EEE401
Course

Electrical Engineering
```

Resource:

```text
Power Electronics Test 2025

Resource
EEE401 · 2025 S2
```

Person:

```text
Dr T. Moyo

Lecturer
Electrical Engineering
```

---

# 46. Search Result Actions

Actions depend on the object.

Course:

```text
View
```

Person:

```text
View profile
Follow
Connect
```

Organization:

```text
View
Follow
Join
```

Service:

```text
View service
```

The available actions come from permission state.

---

# 47. Search History

Search history is private to the user.

It should not be visible to:

* classmates
* class representatives
* lecturers
* organizations
* administrators

unless a future explicitly authorized feature requires it.

---

# 48. Search Offline

Global search requires online search infrastructure.

Offline mode:

```text
Search cached content
```

The UI must explicitly indicate the reduced scope:

> Offline search — showing saved and recently synced content.

Do not imply that the entire CampusOS database is searchable offline.

---

# 49. Search Acceptance Criteria

* searches domain objects
* permission filtering occurs server-side
* private metadata does not leak
* filters work
* recent searches are private
* offline cached search works
* contextual search can reuse the same architecture
* historical resources can be found where permitted
* results deep-link to canonical objects
* archived objects have appropriate presentation
* accessibility works.

---

# PART V — LEARN DASHBOARD

This is the beginning of the academic core of CampusOS.

Route:

```text
/app/learn
```

Purpose:

> The student's academic command centre.

---

# 50. Learn Hierarchy

```text
LEARN

Academic Search

Today
Coming Up
Needs Attention

My Courses

My Class

Study Groups
```

---

# 51. Learn API

```http
GET /api/v1/learn
```

Conceptual response:

```json
{
  "currentActivities": [],
  "upcomingActivities": [],
  "attentionItems": [],
  "courses": [],
  "primaryClass": {},
  "studyGroups": []
}
```

Again, this is an aggregation response.

It does not replace the underlying domain objects.

---

# 52. My Courses

Courses are based on the user's authorized academic membership.

Example:

```text
MY COURSES

EEE401
Power Electronics

EEE402
Control Systems

EEE403
Electrical Machines
```

Each card can show:

* course code
* course title
* current offering
* lecturer
* next activity
* unread announcements
* outstanding assignment
* resource updates

---

# 53. Course vs Course Offering

This distinction must remain visible in the data model.

```text
Course
EEE401 Power Electronics
        │
        ├── 2025 S1
        ├── 2025 S2
        ├── 2026 S1
        └── 2026 S2 ← current
```

The student normally interacts with the **Course Offering** for current academic activity.

Historical resources remain associated with their original offering/year.

---

# 54. Course Card Interaction

Tap:

```text
EEE401
Power Electronics
```

→ current Course Offering.

If user opens a historical resource:

```text
Resource
 ↓
Historical Course Offering
 ↓
2025 S2
```

The application must preserve that provenance.

---

# 55. My Class

Example:

```text
MY CLASS

EEE 4.1
Electrical Engineering
Year 4 · 2026

12 announcements
3 upcoming activities
```

Tap:

```text
/app/class/:classId
```

---

# 56. Study Groups

Show groups associated with the user's authorized courses.

Example:

```text
STUDY GROUPS

Power Electronics Revision
12 members

Control Systems Weekend Group
8 members
```

Users can create/join groups according to the Study Group rules.

---

# 57. Learn Offline

Previously synchronized:

* course information
* class information
* resource metadata
* saved resources
* activities
* announcements where permitted

remain accessible subject to cache policy.

New authoritative academic changes require synchronization.

---

# 58. Learn Acceptance Criteria

* current academic context is correct
* courses are permission-filtered
* course/course-offering distinction is preserved
* historical content is not mixed with current content
* class membership controls class access
* activities connect to Calendar
* resources connect to Resource domain
* assignments connect to Assignment domain
* study groups connect to Study Group domain
* offline state is explicit
* unauthorized academic data never appears.

---

## NEXT SECTION

The next major block is the heart of the academic application:

**PART VI — COURSE DETAIL + COURSE OVERVIEW + ANNOUNCEMENTS + RESOURCES + RESOURCE VIEWER**

That section will define the actual course experience down to:

```text
Course Offering
    ↓
Overview
Announcements
Resources
Assignments
Tests & Exams
Laboratory
Discussion
Study Groups
People
```

including the **resource provenance/versioning system, lecturer endorsement, student uploads, historical papers, offline resource storage, duplicate detection, file permissions, backend APIs, SQLite schema, upload pipeline and exact iOS interactions.**
