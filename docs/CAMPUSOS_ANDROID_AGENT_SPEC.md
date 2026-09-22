# CampusOS Android — Exhaustive Engineering Handoff Specification

**Reading order for the Android agent**

1. This file — binding contract, implemented API, remaining screens, Android overrides.
2. `api-source-of-truth/architecture/architecture-freeze.ts` — frozen invariants. This folder is a copy of the API policies. **`services/api` is not required in the Android workspace.**
3. `api-source-of-truth/` — `errors.ts`, `access.service.ts`, and every `*-policy.ts` / `*-rules.ts` listed in that folder's README.
4. `original-ios-spec/01-PART-I-II-FOUNDATION-AUTH-ONBOARDING.md`
5. `original-ios-spec/02-PART-III-IV-V-HOME-SEARCH-LEARN.md`
6. `original-ios-spec/03-PART-VI-VII-COURSE-ANNOUNCEMENTS-RESOURCES.md`

If an original iOS paragraph and this file disagree, this file and the policy copies win.

**Workspace rule:** If `services/api` is missing, do not stop. Read `api-source-of-truth/` and write the Android client. Waiting for the NestJS tree is not an architecture requirement.

---

**Document status:** Binding handoff. This is not a sketch.  
**Audience:** The agent that will build the CampusOS Android client.  
**Source of truth:** The locked CampusOS architecture and the already-running NestJS API + Flutter iOS client in this repository.  
**Institution:** University of Zimbabwe.  
**Timezone:** Africa/Harare (UTC+2, no DST).  
**Phone country:** Zimbabwe (`ZW`, `+263`).  
**API:** REST ` /api/v1 `.  
**Authoritative store:** PostgreSQL.  
**Client cache:** SQLite. SQLite is never authoritative.

The iOS client was specified and built in third person. This document is specified the same way. Every rule below is an instruction to the Android agent. The Android app is a second client of the same university system. It is not a second CampusOS. It is not allowed to invent a parallel academic model, a second authorization layer, a second course identity, or a second study-group system.

If a sentence in this document conflicts with a convenience of Android UI kits, the sentence wins. If a sentence conflicts with a local SQLite row, the server wins. If a sentence conflicts with a screen the iOS client already ships, the Android client must match the contract, not the iOS widget tree.

---

## 0. Mandate to the Android agent

The Android agent will:

1. Build a native-feeling Android client that talks to the existing CampusOS API.
2. Reproduce every screen, route, permission check, empty state, and error string that the iOS client already uses, except where this document explicitly says Android may use Material motion instead of Cupertino motion.
3. Treat the server as the only authority. The UI may hide a button. The UI may never grant a capability.
4. Use the same JSON field names, the same route strings, the same account-state machine, and the same object identities as iOS.
5. Not create a new backend. Not fork Prisma. Not add Android-only tables that become a second source of truth.
6. Not rebuild the University of Zimbabwe ERP, a complete LMS, a hospital system, a giant social network, a payments platform, or a project-management suite.
7. Not treat Study Group as Class. Not treat Study Group as Course. Not treat Course as Course Offering. Not treat File as Resource. Not treat Home as a domain object.

The full CampusOS monorepo contains `services/api` and `apps/mobile`. **The Android workspace may contain only this `docs/` folder.** That is enough.

- `docs/api-source-of-truth/` — freeze, access, errors, every policy and rules file the client must obey
- `docs/CAMPUSOS_ANDROID_AGENT_SPEC.md` — this file
- `docs/original-ios-spec/` — original iOS wording

The Android agent will not refuse to write screens because `services/api` is absent. The freeze is in `api-source-of-truth/architecture/architecture-freeze.ts`.

The Android client may be Flutter (recommended: same Dart packages, new `android/` folder) or Kotlin. The contract does not change with the toolkit. If the agent chooses Flutter, it must not copy `TargetPlatform.iOS` blindly; Android should use Material 3 motion while keeping CampusOS colour, type, and copy. If the agent chooses Kotlin, it must still emit the same routes, the same headers, and the same JSON.

---

## 1. Architecture freeze — non-negotiable

`ARCHITECTURE_STATUS = FROZEN`.

These functions are law. The Android client must behave as if they are compiled into every screen.

| Invariant | Value | Meaning |
|---|---|---|
| `frontendIsFinalAuthority()` | **false** | A visible button is not permission. The server re-checks every mutation. |
| `onePersonOneIdentity()` | **true** | One phone, one Person. Lecturer, student, class rep, provider are roles on the same Person. |
| `separateAccountsPerRole()` | **false** | Do not create a “lecturer login” and a “student login”. |
| `verificationIsAuthentication()` | **false** | OTP signs the person in. Student verification does not. A person may use CampusOS before they are a verified student. |
| `postgresIsAuthoritativeStore()` | **true** | PostgreSQL is the system of record. |
| `sqliteIsAuthoritativeStore()` | **false** | The local database is a cache. |
| `offlineCapableNotAuthoritative()` | **true** | Offline is allowed. Offline is not truth. |
| `queuedMutationRequiresClientActionId()` | **true** | Every queued mutation must carry a client action id. |
| `searchBypassesAuthorization()` | **false** | Search filters first, then ranks. Unauthorized metadata must not leak as a hit. |
| `privateMetadataMayLeakThroughSearch()` | **false** | A 404-shaped miss is preferred over a titled miss the viewer should not know exists. |
| `privateFileUrlsArePermanent()` | **false** | Signed URLs expire. Do not persist a private download URL as a permanent path. |
| `featuresMayDeliverNotificationsDirectly()` | **false** | Features emit through the notification service. They do not push themselves. |
| `websocketIsAuthoritativeState()` | **false** | Live updates are hints. REST remains the source. |
| `applicationLogsAreAuditRecords()` | **false** | Logs are not the audit table. |
| `campusOsRebuildsUniversityErp()` | **false** | CampusOS is not the university student-records system. |
| `studyGroupIsSecondCourse()` | **false** | A study group does not replace a course offering. |
| `studyGroupIsSecondClass()` | **false** | A study group does not replace an academic class. |
| `unauthorizedResultLeaksProtectedInformation()` | **false** | Denied responses use generic copy. |
| `screensAreSourceOfTruth()` | **false** | A screen is a projection. |
| `architectureIsFrozen()` | **true** | Do not thaw it for Android convenience. |

### 1.1 Canonical objects

The only first-class objects are:

`PERSON`, `CLASS`, `COURSE`, `COURSE_OFFERING`, `ORGANIZATION`, `EVENT`, `RESOURCE`, `STUDY_GROUP`, `SERVICE`, `ACTIVITY`, `CONVERSATION`, `POST`, `COMMENT`, `NOTIFICATION`, `FILE`, `MEDIA`, `LOCATION`, `SERVICE_REQUEST`, `BOOKING`, `ASSIGNMENT`, `ANNOUNCEMENT`, `ASSESSMENT`, `ENROLLMENT`, `MEMBERSHIP`, `RELATIONSHIP`, `PERMISSION`, `ROLE`, `ROLE_ASSIGNMENT`, `AUDIT_EVENT`, `INTEGRATION`.

Existing concepts already have objects. Do not invent duplicates:

| Tempting new thing | Existing object |
|---|---|
| study-group-chat | `CONVERSATION` |
| organization-event | `EVENT` |
| resource-file | `FILE` |
| service-notification | `NOTIFICATION` |
| course-membership | `ENROLLMENT` |
| event-calendar | `ACTIVITY` |
| organization-post | `POST` |
| study-group-post | `POST` |
| profile-photo | `FILE` |
| verification-evidence | `FILE` |
| class-membership | `MEMBERSHIP` |

`shouldIntroduceDomainObject` is false if any existing object, relationship, permission, workflow, or contextualization already covers the idea.

### 1.2 Course versus Course Offering

This distinction is the academic spine of CampusOS.

```
EENG401 Control Systems                 ← COURSE (the subject)
│
├── 2025 Semester 1                     ← COURSE OFFERING
├── 2025 Semester 2                     ← COURSE OFFERING
├── 2026 Semester 1                     ← COURSE OFFERING
└── 2026 Semester 2                     ← COURSE OFFERING (current)
```

Every Learn route, announcement, resource, assessment, laboratory, discussion, study group, and people list is scoped to a **Course Offering id**, never merely a course code.

Example:

```
/app/learn/course/coe-2026-s2-eeng401/overview
```

`coe-2026-s2-eeng401` is the offering. `EENG401` is the course code displayed on the offering.

A resource uploaded in 2025 Semester 2 may appear as a historical resource on the 2026 offering. Historical means “from another offering of the same course”. It does not become a second resource system.

### 1.3 File versus Resource

A `FILE` is bytes, mime type, checksum, processing state, security class.  
A `RESOURCE` is an academic object: title, type, visibility, offering, endorsement, version pointer.

The client never treats a raw file URL as a resource. Opening a resource goes through `GET /api/v1/resources/:id`, then a short-lived file access URL.

### 1.4 Home is not a domain object

Home is an aggregation. It has no table. `GET /api/v1/home` composes activities, attention items, campus cards, and discover cards from existing objects. Android must not create a `Home` model on the server and must not persist Home as if it were a feed of posts.

### 1.5 Authorization chain

```
PERSON
→ AUTHENTICATION
→ ROLE
→ RELATIONSHIP_OR_MEMBERSHIP
→ SCOPE
→ OBJECT
→ OBJECT_STATE
→ PERMISSION
→ PRIVACY_OR_POLICY
→ APPROVAL
→ ALLOW_OR_DENY
```

Provider mode on Android is only a set of screens. It grants nothing. The server re-checks ownership of the target service or booking on every call. The iOS router comment on this point is binding.

### 1.6 Premature systems — do not build

`UNIVERSITY_ERP`, `BANKING`, `COMPLETE_LMS_REPLACEMENT`, `HOSPITAL_INFORMATION_SYSTEM`, `GIANT_SOCIAL_NETWORK`, `PROJECT_MANAGEMENT_PLATFORM`, `RIDE_HAILING`, `FULL_ECOMMERCE`, `REPLACEMENT_FOR_EVERY_UZ_DATABASE`.

CampusOS assessments have a **submission boundary**. Native in-app LMS submission is not this release. External submission and in-person assessment are first-class. The client must show the server’s `submissionBoundary.label` and must not invent a submit button that claims CampusOS received the work.

### 1.7 MVP loop

```
LOGIN
→ VERIFY
→ JOIN_CLASS
→ SEE_CAMPUS_AND_ACADEMIC_CONTENT
→ ACCESS_COURSES
→ COMMUNICATE
→ DISCOVER_EVENTS_AND_ORGANIZATIONS
→ USE_SERVICES
```

A person may sit in the later steps before every earlier step is complete. Verification is not a hard lock on Home. Class membership is not a hard lock on Explore. Enrollment is a hard lock on that course offering’s private academic objects.

### 1.8 Sensitive data classes

Never put these in analytics, logs, search snippets, or Android crash reports:

`VERIFICATION_EVIDENCE`, `REGISTRATION_NUMBER`, `PRIVATE_MESSAGE`, `PROTECTED_FILE`, `ADMINISTRATIVE_RECORD`, `AUTHENTICATION_MATERIAL`.

Client analytics blocked keys: `otp`, `accessToken`, `refreshToken`, `registrationNumber`, `studentId`, `body`, `message`.

Server analytics also forbids: `phoneNumber`, `phone`, `password`, `pushToken`, `messageBody`, `verificationEvidence`, `evidenceFileId`, `customerNote`, `providerNote`, `internalNote`, `legalName`, `contact`.

### 1.9 Unauthorized cases the client must never paper over

A successful-looking screen for any of these is a defect:

- Student A opening Student B’s private resource
- Private content of another class
- Restricted group after membership ended
- DM with a blocked person
- Acting with an expired admin role
- Lecturer of Course A administering Course B
- Class representative acting as university admin
- Reusing an expired signed file URL
- Forging a client action id
- Replaying a sensitive mutation as if it were new
- Malformed or oversized upload
- Rate-limit bypass by rotating local ids

Denied copy is generic: `"You don't have permission to do that."` or `"This item is no longer available."` The client must not display “this exists but you cannot see the title”.

---

## 2. Runtime and identity of the institution

| Setting | Value |
|---|---|
| Institution | University of Zimbabwe |
| API prefix | `/api/v1` |
| Default API base (dev) | `http://localhost:3000/api/v1` — Android emulator must use `http://10.0.2.2:3000/api/v1` |
| Timezone | `Africa/Harare` |
| Campus offset | `120` minutes |
| Phone ISO | `ZW` |
| Phone prefix | `+263` |
| Local example | `0771234567` → `+263771234567` |
| Dev phone | `+263771234567` |
| Dev OTP | `123456` |
| Access JWT TTL | 15 minutes |
| Refresh TTL | 30 days |
| OTP TTL | 5 minutes |
| OTP resend cooldown | 30 seconds |
| OTP max requests | 5 per 10 minutes |
| OTP max verify attempts | 5 per challenge |
| Header | `Authorization: Bearer <accessToken>` |
| Request id | `x-request-id` UUID on every call |
| Database | PostgreSQL 16 (`campusos` / `campusos` / `campusos` in docker-compose) |

The iOS client reads `API_BASE_URL` from `--dart-define`. Android must do the same. Never hard-code a production URL into a debug APK.

Device label on session issue is currently hardcoded `'iPhone'` in the API. Android should still send a truthful device label if the API later accepts it. Do not pretend the phone is an iPhone in the UI.

---

## 3. Error contract

Every API error is:

```json
{ "code": "PERMISSION_DENIED", "message": "You don't have permission to do that.", "details": {} }
```

| Code | HTTP | Default message |
|---|---|---|
| `UNAUTHENTICATED` | 401 | Please sign in to continue. |
| `PERMISSION_DENIED` | 403 | You don't have permission to do that. |
| `NOT_FOUND` | 404 | This item is no longer available. |
| `CONFLICT` | 409 | This information changed while you were editing it. Please review the latest version. |
| `RATE_LIMITED` | 429 | Too many attempts. Please wait and try again. |
| `VALIDATION_ERROR` | 400 | Caller-supplied |
| `OFFLINE` (client-synthesized) | — | You're offline. Showing recently synced information. |
| generic | — | CampusOS couldn't complete that request. |

Resource-specific client copy:

- `This resource has been removed.`
- `You don't have access to this resource.`
- `This file is still being checked.`

The Android client must reuse these strings. Do not rewrite them to sound friendlier. They were chosen so a denied user does not learn whether the object exists.

On 401 the client refreshes once, retries the original request, and if refresh fails routes to `/auth/phone`.

---

## 4. Account states and routing

### 4.1 Authoritative Prisma states

```
NEW
PROFILE_INCOMPLETE
STUDENT_VERIFICATION_PENDING
STUDENT_VERIFIED
CLASS_VERIFICATION_PENDING
ACTIVE
SUSPENDED
```

### 4.2 RouteResolver (binding)

| Session | Destination |
|---|---|
| unknown / startup failed | `/splash` |
| none | `/welcome` |
| expired | `/auth/phone` |
| valid or offline-cached | by account state |

| Account state | Destination |
|---|---|
| `NEW`, `PROFILE_INCOMPLETE` | `/onboarding/profile` |
| `STUDENT_VERIFICATION_PENDING` | `/onboarding/student-verification` |
| `STUDENT_VERIFIED` | `/onboarding/class-verification` |
| `CLASS_VERIFICATION_PENDING`, `ACTIVE`, `SUSPENDED`, null | `/app/home` |

`CLASS_VERIFICATION_PENDING` is allowed into Home. The class-verification screen remains reachable. Do not imprison the person on class search.

`SUSPENDED` may open Home. Mutations that require an active campus member will fail on the server. The client must show the server message, not invent a lock screen unless the API later returns a dedicated suspended payload.

### 4.3 Forward-looking lifecycle (settings policy, not fully in Prisma)

`ACTIVE | RESTRICTED | SUSPENDED | DEACTIVATED | DELETION_REQUESTED | DELETION_PROCESSING | DELETED`

Deletion grace is 30 days. Do not implement deletion UI that claims the person is already erased while the state is `DELETION_REQUESTED`.

A block does **not** remove institutional relationships. Blocking a classmate does not unenroll them. `blockRemovesInstitutionalRelationship()` is false. `blockRemovesEnrollment()` is false.

---

## 5. Authentication — phone and OTP

CampusOS authenticates a Person by mobile number. There is no password. There is no email login. There is no Google login.

### 5.1 Phone rules

Normalize before send:

1. Strip spaces and punctuation except `+`.
2. `00…` becomes `+…`.
3. Leading `0` becomes `+263` plus the rest (`0771234567` → `+263771234567`).
4. Leading `263` without plus becomes `+263…`.
5. Bare local digits become `+263` plus those digits.
6. Valid E.164: `^\+[1-9]\d{7,14}$`.

Copy:

- Empty: `Enter your phone number.`
- Invalid: `Enter a valid phone number.`
- Server invalid: `Enter a valid phone number.`

Mask for OTP screen: `+263 *** 4567` style (`(\+\d{3})\d+(\d{4})`).

Welcome copy:

- Title: `CampusOS`
- Subtitle: `Everything you need for university life.`
- Action: `Continue with phone`

Phone screen copy:

- `Enter the mobile number you use in Zimbabwe.`

### 5.2 Endpoints

```
POST /api/v1/auth/otp/request     { phoneNumber }
POST /api/v1/auth/otp/verify      { challengeId, otp }
POST /api/v1/auth/refresh         { refreshToken }
POST /api/v1/auth/logout
GET  /api/v1/auth/sessions
POST /api/v1/auth/sessions/:sessionId/revoke
```

Request returns `{ challengeId, expiresAt, resendAvailableAt }`.  
Verify returns tokens plus `person` including `accountState`.

OTP copy:

- `Enter the 6-digit code sent to {masked}.`
- `This verification code is no longer valid.`
- `This verification code has already been used.`
- `This verification code has expired.`
- `That code is incorrect. Please try again.`
- `Please wait before requesting another code.`

Tokens live in platform secure storage (`flutter_secure_storage` on iOS; Android Keystore / EncryptedSharedPreferences equivalent). Never in SQLite. Never in analytics.

First successful verify creates `Person` with `accountState: NEW` if the phone is new.

---

## 6. Onboarding and identity

### 6.1 Profile setup — `/onboarding/profile`

Purpose: a public campus identity. Not legal name. Not registration number.

Fields the person may set: display name, username, bio. Photo is specified but the iOS control is a no-op (`Skip photo`). Android may implement photo later through the File object. Do not store a raw bitmap as the identity.

Username rules (`social-rules.ts`):

- Normalize: trim, strip `@`, lowercase.
- Length 3–24.
- Pattern: `^[a-z0-9][a-z0-9._]*[a-z0-9]$`.
- Reserved: `admin`, `campusos`, `uz`, `support`, `root`, `system`, `official`, `university`, `staff`, `lecturer`, `moderator`, `security`.

```
GET  /api/v1/users/username/availability?username=
POST /api/v1/people/me/profile
PATCH /api/v1/people/me/profile
PATCH /api/v1/people/me/username
```

Successful profile create from `NEW` / `PROFILE_INCOMPLETE` moves the person to `STUDENT_VERIFICATION_PENDING`.

Copy: `Choose how other students and staff will see you.`

### 6.2 Student verification — `/onboarding/student-verification`

Verification is not login. It is a claim that this Person is a UZ student.

```
GET  /api/v1/academic/programmes
POST /api/v1/verifications/student
GET  /api/v1/verifications/student/me
```

Submit body includes registration number and programme id. Evidence file is optional in the current iOS UI (`Skip student ID upload` is a no-op). Android must not require a photo to submit if iOS does not.

Registration number is never a username. `registrationNumberIsUsername()` is false. Never show it on a public profile. Never send it to analytics.

Copy on pending: `Your information has been submitted` / `Pending review`.

Home attention when verification is incomplete:

- Title: `Finish campus verification`
- Route: `/onboarding/student-verification`

A person may `Continue without verifying` and go to class verification. CampusOS remains usable. Some academic objects will stay closed.

### 6.3 Class verification — `/onboarding/class-verification` and `/app/class/:classId`

A Class is an academic cohort (`EEE 4.1`), not a course and not a chat.

```
GET  /api/v1/classes?search=
POST /api/v1/classes/:classId/membership-requests
GET  /api/v1/classes/:classId
GET  /api/v1/class-memberships/pending
POST /api/v1/class-memberships/:membershipId/approve
POST /api/v1/class-memberships/:membershipId/reject
```

If the class has no active class representative, the server returns a validation error: the class cannot process membership. The person may still use other CampusOS features.

Requesting membership sets `CLASS_VERIFICATION_PENDING` and notifies class representatives. Deep link for the rep: `/app/onboarding/class-verification`.

Class detail for a non-member shows public directory fields and representatives. Member lists and class activities are members-only.

Copy when pending: `Your class membership request is pending a class representative.`  
Action: `Request to join class`.  
Skip: `Skip for now` → `/app/home`.

Class representative capabilities apply only to that class. A class rep is not a university admin. `classRepCapabilities` grants moderate-class on the same class id only.

### 6.4 Seed people the Android agent will meet in development

| Person id | Phone | Username | Name | Notes |
|---|---|---|---|---|
| `person_matthew` | `+263771234567` | `matthew` | Matthew Dziirutsva | Dev login, OTP `123456`, verified `R123456A` |
| `person_moyo` | `+263771000001` | `jmoyo` | Dr John Moyo | Lecturer |
| `person_jane` | `+263771000002` | `jsmith` | Jane Smith | |
| `person_tawanda` | `+263771000003` | `tawanda` | Tawanda M. | Chess president |
| `person_rep` | `+263771000004` | `rudo` | Rudo Ncube | Class representative |
| `person_tarisai` | `+263771000005` | `tarisai` | Tarisai Chikomo | Service provider |

Class: `class_eee41` — `EEE 4.1`, Electrical Engineering, year 4.  
Course: `course_eeng401` — EENG401 Control Systems.  
Current offering: `coe-2026-s2-eeng401`.  
Historical offering: `coe-2025-s2-eeng401`.  
Study groups: `sg_pe` Power Electronics Revision, `sg_cs` Control Systems Weekend Group.  
Organizations: `org_chess` UZ Chess Society (OPEN), `org_engsoc` Engineering Society (REQUEST_TO_JOIN), `org_sda` Southgate South SDA.

---

## 7. Shell, tabs, and global chrome

### 7.1 Bottom navigation

Five tabs, always in this order:

1. Home → `/app/home`
2. Learn → `/app/learn`
3. Explore → `/app/explore`
4. Calendar → `/app/calendar`
5. Messages → `/app/messages`

Hide the tab bar on course detail and on these prefixes:

```
/app/learn/resource/
/app/learn/announcement/
/app/learn/assignment/
/app/learn/laboratory/
/app/learn/discussion/
/app/learn/study-group/
```

and any path containing `/course/`.

Labels: `Home`, `Learn`, `Explore`, `Calendar`, `Messages`.

### 7.2 Global search entry

Home, Learn, and Explore open `/app/search`. The control is an entry, not an inline search box that queries on every keystroke from the tab. Search is a full screen.

### 7.3 Header pattern on Home

```
CampusOS                         🔔   Avatar
```

Bell goes to `/app/notifications`. Unread count is spoken: `1 unread` / `N unread`. Avatar goes to `/app/profile`.

---

## 8. Home — `/app/home`

Home is the personal campus command centre. It is not a social feed.

```
GET /api/v1/home?timezone=Africa/Harare
```

Canonical hierarchy:

```
Header
Global Search
Up Next
Today
Needs Your Attention
Campus
Discover
```

### 8.1 Payload

```
generatedAt
timezone
greetingName
accountState
firstTime
upNext            → ActivityItem
today[]           → ActivityItem
attention[]       → AttentionItem
campus[]          → CampusCard
discover[]        → CampusCard
unreadNotificationCount
unreadMessageCount
```

`firstTime` is true when the person has zero enrollments and zero class memberships.

First-time copy:

- Title: `Welcome to CampusOS`
- Body: connect university identity
- Action: `Verify student status` → `/onboarding/student-verification`

Empty attention: `You're all caught up` / `Nothing needs your attention right now.`  
Empty campus: `Campus updates will appear here`  
Empty discover: `Discover organisations, events and services`

### 8.2 Up Next is relevance, not chronology

`selectUpNext`:

1. Ignore `CANCELLED` and `COMPLETED`.
2. If any activity is `ONGOING`, pick the highest `relevanceWeight` among those. An ongoing lecture beats a later exam.
3. Otherwise score remaining items. A start inside the next 36 hours receives a `+25` soon boost. Higher `relevanceWeight` wins.
4. Relative labels: `Happening now`, `Cancelled`, `Starts in N min`, `Upcoming`.

Do not sort Up Next by start time and call it finished.

Default relevance weights used when syncing activities: exam 95, test/assignment 90, laboratory 75, personal 20.

### 8.3 Attention merge

Dedupe by `sourceType:sourceId`. Sort CRITICAL → HIGH → NORMAL → LOW. Limit 5.

### 8.4 Offline

If the device is offline, show the last persisted Home snapshot and the banner:

`You're offline. Showing recently synced information.`  
Optionally append a last-updated label.

Pull-to-refresh failure must keep the previous snapshot: `Couldn't refresh` / `Couldn't refresh. Showing information from …`

### 8.5 Analytics (Home only today)

`home_opened`, `home_section_viewed` (`upNext|today|attention|campus|discover`), `home_refresh`, `home_discover_opened`, `home_item_opened`.

Every Home item that can be opened carries a server `route`. The client never reconstructs a destination from type + id when a route is present.

---

## 9. Search — `/app/search`

```
GET /api/v1/search?q=&type=
GET /api/v1/search/recent
```

Search permission-filters before it ranks. A hit the viewer cannot see must not appear as a greyed row.

Types the client may send, after `normalizeSearchType`: `all`, and mapped families (`people`, `courses`, `events`, `organizations`, `resources`, `services`, `locations`/`places`).

Ranking (server): exact title +100, prefix +70, contains +40, subtitle +12, historical −10.

Study groups in search:

- Member: include
- `PUBLIC`: include
- `CAMPUS_ONLY`: campus member
- `CLASS_MEMBERS_ONLY`: class member
- `COURSE_MEMBERS_ONLY`: enrolled in that offering
- `INVITE_ONLY`: never from search

Idle empty: `Search CampusOS` / `Find courses, people, events and resources.`  
No hits: `No results` / `Try another name, course code or resource title.`  
Offline: `Offline search — showing saved and recently synced content.`

Each hit: `id`, `objectType`, `title`, `subtitle`, `route`, `historical`. Navigate with `route`.

---

## 10. Learn — `/app/learn`

```
GET /api/v1/learn?timezone=Africa/Harare
```

Learn is the academic home. It is not a second Home.

Sections:

- Current / today activities
- Coming up
- Needs attention
- My Courses (enrolled offerings)
- My Class
- Study Groups (cards that open `/app/learn/study-group/:id`)

Empty courses: `No course offerings yet` / `Verified enrolments will appear here.`

A course card opens `/app/learn/course/:courseOfferingId/overview`. Never `/course/:courseCode`.

---

## 11. Course Detail — the core Learn object

### 11.1 Principle

> A Course Offering is the academic context. Resources, Announcements, Assignments, Discussions, Laboratories, Study Groups and People are objects inside that context.

The course page is not a stack of independent apps. The Android back control on this page says `Back to {code}` and returns to Learn, not to an unrelated tab.

### 11.2 Routes

```
/app/learn/course/:courseOfferingId                 → redirect to …/overview
/app/learn/course/:courseOfferingId/:tab
```

Tabs, in this exact order:

| Path | Label | Client widget analogue |
|---|---|---|
| `overview` | Overview | offering payload |
| `announcements` | Announcements | `GET …/announcements` |
| `resources` | Resources | `GET …/resources` |
| `assignments` | Assignments | assessments where type is not TEST/EXAM |
| `exams` | Tests & Exams | assessments where type is TEST or EXAM |
| `laboratory` | Laboratory | `GET …/laboratories` |
| `discussion` | Discussion | `GET …/discussions` |
| `study-groups` | Study Groups | `GET …/study-groups` |
| `people` | People | `GET …/people` |

There are no Coming Soon course tabs. `PlaceholderCourseTab` is dead code. Do not resurrect it on Android.

### 11.3 Offering header

```
GET /api/v1/course-offerings/:courseOfferingId
```

Shows title, `{code} · {semester}`, lecturer label or `Lecturer to be confirmed`, department, status, next activity.

Denied: `You don't have access to this course.`

### 11.4 Overview

About, learning outcomes, outline, teaching team, references. All from the offering payload. Do not fetch a second “overview CMS”.

### 11.5 Announcements

```
GET    /api/v1/course-offerings/:id/announcements
POST   /api/v1/course-offerings/:id/announcements
GET    /api/v1/announcements/:id
PATCH  /api/v1/announcements/:id
POST   /api/v1/announcements/:id/archive
POST   /api/v1/announcements/:id/read
```

Priority: `NORMAL`, `IMPORTANT`, `URGENT`. Push only IMPORTANT and URGENT (`announcementShouldPush`).

FAB `Create announcement` only if `CREATE_ANNOUNCEMENT`. Edit chrome only if `EDIT_ANNOUNCEMENT`. The server still decides.

Empty: `No announcements yet`.

Detail route: `/app/learn/announcement/:announcementId`.

If mark-read fails offline, enqueue `POST announcements/:id/read`.

### 11.6 Resources

```
GET    /api/v1/course-offerings/:id/resources?q=
POST   /api/v1/course-offerings/:id/resources
GET    /api/v1/resources/:id
PATCH  /api/v1/resources/:id
POST   /api/v1/resources/:id/versions
POST   /api/v1/resources/:id/endorse
POST   /api/v1/resources/:id/relationships
POST   /api/v1/resources/:id/share
POST   /api/v1/resources/:id/report
GET    /api/v1/resource-categories
```

A resource is not a file. Opening uses `/app/learn/resource/:resourceId`.

Historical resources (other offerings of the same course) are marked `historical: true`. They stay visible when the server includes them. They are not the current offering’s uploads.

Metadata edit is time-bounded. `canEditMetadata` / `editableUntil` come from the server. `metadataWindowOpen(editableUntil, now)` is `now < editableUntil`. The iOS client used a 45-minute metadata window in product language. Android must obey the server timestamp, not a local 45-minute clock started at render.

Visibility: `PUBLIC`, `AUTHENTICATED_USERS`, `COURSE_MEMBERS`, `CLASS_MEMBERS`, `PRIVATE`. Download of others’ course files requires `DOWNLOAD_RESOURCE` except PUBLIC and the uploader.

Empty: `No resources yet.` / `No matching resources.`  
Offline without cache: `You're offline.` / `Connect to the internet to load course resources.`

Endorsement does not change authorship. `endorsementChangesAuthorship()` is false. `uploaderIsAuthor()` is false.

### 11.7 Assignments and Tests & Exams

```
GET    /api/v1/course-offerings/:id/assessments?type=
POST   /api/v1/course-offerings/:id/assessments
GET    /api/v1/assessments/:id
PATCH  /api/v1/assessments/:id
POST   /api/v1/assessments/:id/publish
POST   /api/v1/assessments/:id/cancel
POST   /api/v1/assessments/:id/archive
```

Types: `ASSIGNMENT`, `TEST`, `EXAM`, `QUIZ`, `PROJECT`, `PRACTICAL`, `LABORATORY_ASSESSMENT`, `OTHER`.

The Assignments tab shows non-exam types. The Tests & Exams tab shows `TEST` and `EXAM`.

Statuses students may see: `PUBLISHED`, `OPEN`, `CLOSED`, `ARCHIVED`, `EXTENDED`, `SCHEDULED`, `ONGOING`, `COMPLETED`. Drafts are lecturer-only.

Detail route: `/app/learn/assignment/:assessmentId` for every assessment type. The server serialize `route` is that path.

**Submission boundary — binding:**

CampusOS is not a full LMS.

| Mode | Meaning |
|---|---|
| `NONE` | In-person. CampusOS does not receive submissions. |
| `EXTERNAL` | Submission on an external university system. `canSubmitInCampusOs: false`. Show `leavingCampusOs` when opening the URL. Offline: `You're offline. This assignment must be submitted through the external submission system. Connect to the internet to continue.` |
| `CAMPUSOS` | Native submission is not available in this release. Show that label. Do not build an upload-to-grade pipeline. |

Empty: `No assignments published yet` / `No tests or exams published yet`.

Cancelled assessments show `CANCELLED` in danger colour and remain readable.

### 11.8 Laboratory

```
GET    /api/v1/course-offerings/:id/laboratories
POST   /api/v1/course-offerings/:id/laboratories
GET    /api/v1/laboratories/:id
PATCH  /api/v1/laboratories/:id
POST   /api/v1/laboratories/:id/publish
```

Detail: `/app/learn/laboratory/:laboratoryId`.

Show objective, instructions, safety level, PPE, hazards, linked resources. A laboratory is not an assignment. A linked `assessmentId` may exist; do not collapse the two objects.

Empty: `No laboratory sessions yet`.

### 11.9 Discussion

```
GET    /api/v1/course-offerings/:id/discussions
POST   /api/v1/course-offerings/:id/discussions
GET    /api/v1/discussions/:id
POST   /api/v1/discussions/:id/replies
```

Enrolled students, lecturers, and TAs may `CREATE_DISCUSSION` and `REPLY_DISCUSSION`. Lecturers may close and pin.

Closed discussions accept no replies. Copy: `This discussion is closed.`

Empty: `No discussions yet` / `Course discussions stay attached to this offering. They are not a class or study group.`

Detail: `/app/learn/discussion/:discussionId`.

### 11.10 Study Groups (inside a course, and as their own object)

```
GET    /api/v1/course-offerings/:id/study-groups
POST   /api/v1/course-offerings/:id/study-groups
GET    /api/v1/study-groups/:id
POST   /api/v1/study-groups/:id/join
```

A study group is student collaboration. It does **not** replace the course. It does **not** replace the class. It does **not** administer the course. The creator is not a permanent owner. The last admin may not leave without transfer. The group does not disappear when the creator leaves. Chat is not persistent knowledge. A study task does not replace an assignment. Visibility does not reveal member profiles. Moderators do not read private DMs.

Discoverable statuses: `ACTIVE`, `INACTIVE`. Schema statuses: `DRAFT`, `ACTIVE`, `INACTIVE`, `ARCHIVED`. Policy also mentions `CLOSED`; do not write `CLOSED` to Prisma.

Join outcomes: `JOINED`, `PENDING`, `WAITLISTED` (stored as `PENDING` in Prisma — there is no `WAITLISTED` membership enum), `DENIED`.

Join denial copy from the server, including:

- `Please sign in to continue.`
- `This study group is not accepting members.`
- `This group is invite-only.`
- `Only campus members can join.`
- `Only students on this course can join.`
- `Only class members can join.`
- `This group is full.`
- `You don't have permission to join this group.`

Empty: `No study groups yet` / `A study group is a student collaboration space. It does not replace this course or your class.`

Detail: `/app/learn/study-group/:studyGroupId`.  
On-detail disclaimer: `A study group is student collaboration. It does not replace the course or the class.`  
Chat, when `CHAT` is in `actions` and `conversationId` is present: `/app/messages/:conversationId`.  
Join is an online action. Do not fake a successful join offline.

Online-required study group actions: `JOIN`, `LEAVE`, `APPROVE_MEMBER`, `REMOVE_MEMBER`, `CREATE_ACTIVITY`, `PUBLISH_RESOURCE`, `ADMINISTRATE`.

### 11.11 People

```
GET /api/v1/course-offerings/:id/people
```

Sections: Teaching team, Students. Each row opens `/app/profile/:personId`. Enrollment is not a social follow. `membershipIsSocialRelationship()` is false.

Empty: `No people listed for this course yet`.

### 11.12 Course permissions the UI may consult

From `AccessService.courseContext`:

Enrolled / lecturer / TA: `VIEW`, `VIEW_RESOURCE`, `CREATE_DISCUSSION`, `REPLY_DISCUSSION`, `CREATE_STUDY_GROUP`.  
Lecturer / coordinator: announcements, resources, assessments, laboratories, close/pin discussion, download.  
Class representative: `VIEW`, announcement create/edit/publish, `CREATE_RESOURCE`.  
Enrolled student: `CREATE_RESOURCE` in addition to the enrolled set.

The Android `PermissionSet` must understand at least:

`VIEW`, `CREATE_ANNOUNCEMENT`, `EDIT_ANNOUNCEMENT`, `PUBLISH_ANNOUNCEMENT`, `ARCHIVE_ANNOUNCEMENT`, `CREATE_RESOURCE`, `EDIT_RESOURCE`, `ENDORSE_RESOURCE`, `VIEW_RESOURCE`, `CREATE_DISCUSSION`, `REPLY_DISCUSSION`, `CREATE_STUDY_GROUP`.

Absence of a getter on iOS is not absence of the permission. If the array contains `PUBLISH_ANNOUNCEMENT`, honour it.

---

## 12. Explore, Organizations, Events

### 12.1 Explore — `/app/explore`

```
GET /api/v1/explore
```

Sections: Happening Now, Organisations, Upcoming Events, Campus Services.

Empty: `Nothing to explore yet` / `Organisations, events and campus services appear here as they are published.`  
Services empty: `No services published yet`.

Every card has a server `route`. Organisation cards go to `/app/explore/organization/:id`. Events to `/app/explore/event/:id`. Services to `/app/explore/service/:id`.

### 12.2 Organization — `/app/explore/organization/:organizationId`

```
GET    /api/v1/organizations
GET    /api/v1/organizations/:id
POST   /api/v1/organizations/:id/join
POST   /api/v1/organizations/:id/leave
POST   /api/v1/organizations/:id/follow
DELETE /api/v1/organizations/:id/follow
GET    /api/v1/organizations/:id/members
GET    /api/v1/organizations/:id/posts
GET    /api/v1/organizations/:id/conversation
```

Statuses: `PROPOSED`, `PENDING_APPROVAL`, `ACTIVE`, `SUSPENDED`, `CLOSED`, `ARCHIVED`, `REJECTED`.  
Policies: `OPEN`, `REQUEST_TO_JOIN`, `INVITATION_ONLY`, `RESTRICTED`.

Permissions from payload: `VIEW`, `FOLLOW`, `JOIN`, `LEAVE`, `OPEN_CONVERSATION`, plus officer/admin management keys. SUSPENDED organizations are view-only.

Join on `REQUEST_TO_JOIN` creates `PENDING` membership. Label the button `Request to join`.

An organization is not a class and not a course.

Missing-on-iOS-but-specified: browse-all services, service detail, booking form, public provider. The API and Dart models exist. Android must implement these screens. The iOS router already points at them. Treat missing Flutter files as an iOS gap, not as a product decision to omit services.

### 12.3 Event — `/app/explore/event/:eventId`

```
GET    /api/v1/events/:eventId
POST   /api/v1/events/:eventId/responses     { response: GOING | INTERESTED }
```

Show cancelled state in text, not colour alone. Share is a CampusOS event link, not a public file URL.

Copy: `{n} going · {n} interested`.

---

## 13. Calendar — `/app/calendar`

```
GET    /api/v1/calendar?start&end&timezone=Africa/Harare
GET    /api/v1/activities/:activityId
POST   /api/v1/activities
PATCH  /api/v1/activities/:activityId
POST   /api/v1/activities/:activityId/cancel
POST   /api/v1/activities/:activityId/reminders
```

Calendar aggregates: owned personal items, enrolled course activities, class activities, organization activities, study-group activities, public/campus events, provider booking activities.

Personal items may be created and edited. Campus-sourced items (`sourceType` set) cannot be edited as personal items.

Routes:

- Create: `/app/calendar/new` and `/app/calendar/create` (both valid)
- Detail: `/app/calendar/activity/:activityId`
- If the activity serialize `route` points at an assignment, laboratory, event, booking, or course, open that route.

A private personal activity belonging to someone else is denied. Campus-visible activities with `visibility !== PRIVATE` may be opened by entitled viewers.

Empty day: `Nothing scheduled` / `Personal reminders can be added from Calendar.`  
Empty upcoming: `No upcoming activities` / `Course, organization and personal items appear here.`  
Offline: `Calendar offline. Showing activities last synchronized on this device.`

Categories: Academic, Assessment, Organization, Sport, Service, Personal, Social event.

---

## 14. Messages — `/app/messages`

```
GET    /api/v1/conversations
POST   /api/v1/conversations/direct
GET    /api/v1/conversations/:id
GET    /api/v1/conversations/:id/messages
POST   /api/v1/conversations/:id/messages
POST   /api/v1/conversations/:id/read
POST   /api/v1/conversations/:id/mute
POST   /api/v1/conversations/:id/unmute
DELETE /api/v1/conversations/:id/mute
POST   /api/v1/conversations/:id/leave
PATCH  /api/v1/messages/:id
DELETE /api/v1/messages/:id
POST   /api/v1/messages/:id/reactions
POST   /api/v1/messages/:id/report
```

Conversation kinds: `DIRECT`, `GROUP`, `CLASS`, `COURSE`, `STUDY_GROUP`, `ORGANIZATION`, `SERVICE`.

Derived participant kinds (`CLASS`, `COURSE`, `STUDY_GROUP`, `ORGANIZATION`) are membership-backed. Leaving copy differs by kind. Message edit window is 15 minutes.

Messaging policy is server-side. Follow does not grant messaging. `followGrantsMessaging()` is false. `whoCanMessage` may be `EVERYONE`, `CAMPUS`, `CONNECTIONS`, `EXISTING_ONLY`, `NOBODY`. Institutional channels (course announcement, class announcement, organization announcement, service booking, system) are never suppressed by a social block.

Empty: `No conversations yet`.  
Offline compose: `You're offline. This message stays here until it is sent.`

A study-group conversation is a `CONVERSATION`. Do not create a second chat engine.

---

## 15. Notifications — `/app/notifications`

```
GET    /api/v1/notifications
GET    /api/v1/notifications/unread-count
POST   /api/v1/notifications/read
POST   /api/v1/notifications/read-all
POST   /api/v1/notifications/:id/read
GET    /api/v1/notifications/:id/open
GET    /api/v1/notification-preferences
PATCH  /api/v1/notification-preferences
POST   /api/v1/devices
PATCH  /api/v1/devices/:deviceId
DELETE /api/v1/devices/:deviceId
```

Opening a notification goes through `/open` so the server can re-check access before the client follows `route` / `deepLink`. Offline: `You're offline. CampusOS checks your access before opening this, so try again once you're back online.`

Preferences groups: messages, academic, classes, organizations, services, social, quiet hours. Quiet hours suppress non-CRITICAL push. System types always deliver.

Preferences route: `/app/settings/notifications`.

---

## 16. Profile, social graph, privacy

```
GET    /api/v1/people/me
GET    /api/v1/people/:personId
POST   /api/v1/people/:personId/follow
DELETE /api/v1/people/:personId/follow
GET    /api/v1/people/:personId/followers
GET    /api/v1/people/:personId/following
POST   /api/v1/people/:personId/connect
POST   /api/v1/people/:personId/connect/accept
POST   /api/v1/people/:personId/connect/decline
DELETE /api/v1/people/:personId/connect
GET    /api/v1/people/:personId/connections
POST   /api/v1/people/:personId/block
DELETE /api/v1/people/:personId/block
POST   /api/v1/people/:personId/report
GET    /api/v1/people/blocked
GET    /api/v1/people/me/connection-requests
GET    /api/v1/privacy-settings
PATCH  /api/v1/privacy-settings
```

Routes:

```
/app/profile
/app/profile/edit
/app/profile/blocked
/app/profile/:personId
/app/profile/:personId/followers
/app/profile/:personId/following
/app/profile/:personId/connections
/app/settings/privacy
```

Declare `/edit` and `/blocked` before `/:personId`.

A profile the viewer is not allowed to inspect arrives `restricted: true` with a `restrictionMessage`. Show identity plus safety actions. Do not invent hidden fields from cache.

Never-public fields: registration number, legal name, phone, contact. Viewing a profile does not reveal all fields. Typed academic context is not trusted from the client. Client-claimed role is not trusted. Connection does not reveal private fields.

Default privacy: profile `CAMPUS`, findable true, follow `EVERYONE`, connect `CAMPUS`, message `CONNECTIONS`, activity `CAMPUS`, follower/following `EVERYONE`, connections `CONNECTIONS`.

Hidden-list copy is server-supplied (`Followers aren't visible.`). Use it.

Photo is a File. Initials stand in until the photo renderer exists. That is acceptable.

`edit_profile_screen` is referenced by iOS routing and must exist on Android even if the iOS file is currently missing from disk.

Unsigned: `Sign in to see your profile`.

---

## 17. Campus services and bookings

Services are a real CampusOS domain. They are not a marketplace reboot of the university.

```
GET    /api/v1/service-categories
GET    /api/v1/services
GET    /api/v1/services/:serviceId
GET    /api/v1/services/:serviceId/booking-form
GET    /api/v1/services/:serviceId/availability
GET    /api/v1/services/:serviceId/reviews
GET    /api/v1/service-providers/:providerId
GET    /api/v1/bookings
POST   /api/v1/bookings
GET    /api/v1/bookings/:bookingId
… confirm, decline, start, complete, cancel, reschedule, review
```

Provider (same Person, different screens):

```
/app/services/provider
/app/services/provider/bookings
/app/services/provider/services
/app/services/provider/services/create
/app/services/provider/services/:serviceId/edit
/app/services/provider/availability
/app/services/provider/verification
/app/services/provider/profile/edit
```

Discoverable service statuses: `PUBLISHED`, `AVAILABLE`, `UNAVAILABLE`. Bookable: `PUBLISHED` or `AVAILABLE`. `CONTACT_FIRST` does not allow booking. `OPEN_BOOKING` auto-confirms. `REQUIRES_QUOTE` defaults booking type to `QUOTE`.

`PAYMENTS_REQUIRED_FOR_MVP` is false. Do not build a payments UI that claims money moved.

Capacity: only `CONFIRMED` and `IN_PROGRESS` consume a slot. `REQUESTED` is not a hold. Timezone offset for availability math is 120 minutes.

Booking transitions:

```
DRAFT → REQUESTED, CANCELLED
REQUESTED → CONFIRMED, DECLINED, RESCHEDULED, CANCELLED
CONFIRMED → IN_PROGRESS, RESCHEDULED, CANCELLED
IN_PROGRESS → COMPLETED, CANCELLED
```

Customer, provider, and admin are server-computed roles. The Android provider dashboard is not authority.

Offline: `You're offline and this service/booking is not saved on this device.`  
Provider offline mutation: `You're offline. Reconnect to send your response — nothing has been sent yet.`

Reviews only after `COMPLETED`, by the customer.

University endorsement is never inferred from being signed in. `universityEndorsed` is false unless the server says otherwise.

---

## 18. Files

```
POST /api/v1/files/uploads
POST /api/v1/files/upload-sessions
POST /api/v1/files/:fileId/content
POST /api/v1/files/:fileId/complete
GET  /api/v1/files/:fileId
POST /api/v1/files/:fileId/access
GET  /api/v1/files/:fileId/download
```

Security classes: `PUBLIC`, `AUTHENTICATED`, `PRIVATE`, `SENSITIVE`.

Signed URL TTLs: PUBLIC 24h, AUTHENTICATED 1h, PRIVATE 5m, SENSITIVE 60s.

Upload ceilings (policy): profile 8MB, resource 100MB. Suspended persons cannot upload.

`permanentUrlAllowed` only for PUBLIC. Offline cache is not allowed for SENSITIVE. Strip EXIF for public/authenticated images.

Processing states are server-owned. The client may say `This file is still being checked.` It may not display a failed scan as a successful resource.

---

## 19. Feed and posts

```
GET    /api/v1/feed
POST   /api/v1/posts
GET    /api/v1/posts/:postId
PATCH  /api/v1/posts/:postId
POST   /api/v1/posts/:postId/remove
```

Eligibility is server-side. The client never receives a post it must then hide. Filters (`FOR_YOU`, `FOLLOWING`, `MY_CLASS`, `MY_COURSES`, `ORGANIZATIONS`) are query configurations over one content system, not separate products.

`FOR_YOU` is not available offline. New content is announced (`1 new post` / `N new posts`), not spliced under the scroll position.

Edit window for posts: 15 minutes. Max comment depth: 2.

---

## 20. Offline, SQLite, and sync

### 20.1 Database

File: app documents / `campusos.db`. Schema version 2.

Tables the iOS client already uses: `persons`, `classes`, `class_memberships`, `courses`, `course_offerings`, `enrollments`, `announcements`, `resources`, `resource_versions`, `resource_endorsements`, `resource_relationships`, `files`, `offline_files`, `activities`, `calendar_activities`, `events`, `event_responses`, `external_calendar_mappings`, `pending_actions`, `sync_metadata`, `notifications`, `conversations`, `messages`, `service_categories`, `services`, `bookings`.

Android may use Room with the same logical tables. Column names may be snake_case locally. JSON from the network stays camelCase.

### 20.2 Startup sync (when session + online)

1. `GET people/me`
2. `GET home?timezone=Africa/Harare`
3. `GET learn`
4. `GET notifications`
5. `GET conversations`
6. Flush `pending_actions`
7. Stamp `last_synced_at`

### 20.3 Queueable mutations already used

| Action | Method | Path |
|---|---|---|
| Mark announcement read | POST | `announcements/:id/read` |
| Request class membership | POST | `classes/:id/membership-requests` |

Sync policy also allows offline compose of messages, read marks, personal activities, and appearance/accessibility/language. Bookings, verification, and admin actions are deliberate-retry-only. Do not silently queue a booking confirm.

Conflict policies: messages append-only; bookings server-wins; profile optimistic version. Max 5 automatic retries, exponential backoff. Stop the queue on `UNAUTHENTICATED`.

Every queued row needs `clientActionId`.

### 20.4 Offline copy

Primary banner: `You're offline. Showing recently synced information.`

Also required:

- Calendar offline sentence above
- Resource tab offline pair
- Search offline sentence
- Notification open offline sentence
- Profile/social: `You're offline. Reconnect to …`
- Messaging pending send sentence
- Services/booking offline sentences

---

## 21. Design system

Android may use Material 3. It may not invent a second brand.

| Token | Hex | Use |
|---|---|---|
| navy | `#0B1F3A` | Text, headers |
| deepGreen | `#0F4C3A` | Primary actions, selected tab |
| forest | `#1B6B4F` | Tertiary |
| moss | `#2F7D5B` | Supporting green |
| cream | `#F6F3EC` | Scaffold |
| ivory | `#FFFCF7` | Surfaces, inputs |
| muted | `#5C6B7A` | Secondary text |
| line | `#D9E0D6` | Borders |
| danger | `#9B2C2C` | Destructive, cancelled |
| attention | `#8A5A12` | Warning / due soon |

Type: display 34/700, headline 22/600, title 20/600 and 17/600, body 17 and 15, small 13 muted, labels 16/600. App bar 17/600, not centered. Letter-spacing slightly negative on titles.

Inputs: 14 radius, ivory fill, deep-green focus ring 1.6.  
Buttons: 16 radius, height 52, deep green primary, navy secondary.  
Cards: 16 radius, line border, white/ivory fill.

Status is carried by words. Colour is decoration. A cancelled event says `CANCELLED`. An unread notification says `Unread`. A selected chip has a check mark and `selected` semantics, not fill colour alone.

VoiceOver/TalkBack:

- Every icon button has a spoken label.
- Offline banners are live regions.
- Course back: `Back to {code}`.
- Unread: `1 unread` / `N unread`.
- Ratings: `{n} out of 5 from {count} reviews`.

Do not ship emoji as UI. Do not ship gradients. Do not ship a dark theme unless the server later owns appearance settings.

---

## 22. Complete route table (Android must implement)

```
/splash
/welcome
/auth/phone
/auth/otp
/onboarding/profile
/onboarding/student-verification
/onboarding/verification-pending
/onboarding/class-verification
/app/home
/app/learn
/app/learn/course/:courseOfferingId
/app/learn/course/:courseOfferingId/:tab
/app/explore
/app/calendar
/app/messages
/app/search
/app/notifications
/app/settings/notifications
/app/settings/privacy
/app/messages/:conversationId
/app/profile
/app/profile/edit
/app/profile/blocked
/app/profile/:personId
/app/profile/:personId/followers
/app/profile/:personId/following
/app/profile/:personId/connections
/app/explore/services
/app/explore/service/:serviceId
/app/explore/service/:serviceId/book
/app/explore/provider/:providerId
/app/services/bookings
/app/services/bookings/:bookingId
/app/services/provider
/app/services/provider/bookings
/app/services/provider/services
/app/services/provider/services/create
/app/services/provider/services/:serviceId/edit
/app/services/provider/availability
/app/services/provider/verification
/app/services/provider/profile/edit
/app/learn/resource/:resourceId
/app/learn/announcement/:announcementId
/app/learn/assignment/:assessmentId
/app/learn/laboratory/:laboratoryId
/app/learn/discussion/:discussionId
/app/learn/study-group/:studyGroupId
/app/calendar/new
/app/calendar/create
/app/calendar/activity/:activityId
/app/class/:classId
/app/explore/organization/:organizationId
/app/explore/event/:eventId
```

Legacy redirects the client must honour if opened from an old link:

```
/course/:courseOfferingId/resource/:resourceId  → /app/learn/resource/:resourceId
/resource/:resourceId                           → /app/learn/resource/:resourceId
```

Tabs inside course detail: `overview`, `announcements`, `resources`, `assignments`, `exams`, `laboratory`, `discussion`, `study-groups`, `people`.

---

## 23. Complete API catalogue the Android client will call

All paths below are relative to `/api/v1`. Guarded unless noted.

**Auth:** `POST auth/otp/request`, `POST auth/otp/verify`, `POST auth/refresh`, `POST auth/logout`, `GET auth/sessions`, `POST auth/sessions/:id/revoke`

**People / social:** `GET people/me`, `POST people/me/profile`, `PATCH people/me/profile`, `PATCH people/me/username`, `GET users/username/availability`, `GET people/:id`, follow/connect/block/report family, privacy-settings, blocked, connection-requests

**Academic:** `GET academic/programmes`, `GET classes`, `GET classes/:id`, `POST classes/:id/membership-requests`, pending/approve/reject memberships, `GET course-offerings/:id`, `GET course-offerings/:id/people`

**Verification:** `POST verifications/student`, `GET verifications/student/me`

**Home / search / learn / explore:** `GET home`, `GET search`, `GET search/recent`, `GET learn`, `GET explore`

**Announcements, resources, assessments, labs, discussions, study groups:** as specified in §§11–11.10

**Calendar / activities:** as §13

**Organizations / events:** as §12 plus admin approve/suspend/close (do not expose those to ordinary students)

**Messaging, notifications, files:** as §§14–15, 18

**Services / bookings / provider `me`:** as §17

**Content:** `GET feed`, posts CRUD/remove

The Android agent must not add `/api/v2` or a GraphQL layer.

---

## 24. JSON field names (camelCase, binding)

The network is camelCase. Do not convert to snake_case on the wire.

Person: `id`, `phoneNumber`, `displayName`, `username`, `bio`, `givenName`, `middleName`, `familyName`, `accountState`, `photoFileId`

Home activity: `activityId` or `id`, `title`, `type`, `source`, `startTime`, `endTime`, `location`, `status`, `relative`, `route`, `courseOfferingId`, `courseCode`

Offering: `courseOfferingId`, `courseId`, `code`, `title`, `semester`, `status`, `department`, `faculty`, `lecturers`, `permissions`

Announcement: `id`, `courseOfferingId`, `title`, `body`, `priority`, `status`, `authorName`, `publishedAt`, `isRead`

Resource: `id`, `title`, `resourceType`, `visibility`, `historical`, `courseOfferingId`, `fileId`, `canEditMetadata`, `editableUntil`, `endorsed`

Assessment: `assessmentType`, `dueAt`, `startAt`, `endAt`, `submissionMode`, `externalSubmissionUrl`, `submissionBoundary`, `urgency`, `route`

Study group: `membershipStatus`, `memberCount`, `actions`, `conversationId`, `enrolledInCourse`

Organization: `memberCount`, `followerCount`, `following`, `membershipStatus`, `membershipPolicy`, `permissions`, `conversationId`

Calendar: `startTime`, `endTime`, `categoryLabel`, `sourceObjectType`, `sourceObjectId`, `personal`

Search: `objectType`, `historical`

Tokens: `accessToken`, `refreshToken`, `expiresAt`

---

## 25. Recommended Android stack

Preferred: Flutter in `apps/mobile` with `flutter create --platforms=android`, keeping Dart feature folders. This is the cheapest way to stay honest to the iOS contract.

Acceptable: Kotlin + Jetpack Compose + Retrofit/OkHttp + Room + DataStore, with the same routes and JSON.

Either way:

- Riverpod-equivalent: a single session graph, connectivity stream, and family providers keyed by offering id / object id
- Secure token store
- Dio/OkHttp interceptor: attach bearer, attach `x-request-id`, refresh once on 401
- Connectivity observer
- Material 3 using CampusOS colours
- TalkBack labels on every icon

Emulator API: `http://10.0.2.2:3000/api/v1`. Physical device: the machine LAN IP, cleartext permitted only in debug.

Package suggestion: `zw.ac.uz.campusos` to match the iOS bundle.

---

## 26. What Android must not copy blindly from iOS

- `platform: TargetPlatform.iOS` and Cupertino transitions. Use Material motion on Android.
- Dead files: `shell_screens.dart` Coming Soon wrappers, `placeholder_course_tab.dart`.
- Hardcoded session device label `iPhone`.
- Assuming `localhost` works on an emulator.
- Treating missing Flutter service screens as “services are out of scope”. They are in scope. Implement them.
- Building a second chat for study groups.
- Building native assignment submission.
- Building payments.
- Building a university admin console inside the student APK.
- Trusting a role string the client wrote.

---

## 27. Implementation sequence for the Android agent

1. Architecture acknowledgement. Do not start screens before this document’s freeze is accepted.
2. Android project (`android/` or Kotlin module) + theme + secure session + API client.
3. Splash, welcome, phone, OTP, RouteResolver.
4. Profile, student verification, class verification.
5. Home, Search, Learn.
6. Course detail: overview, announcements, resources.
7. Assignments, exams, laboratory, discussion, study groups, people.
8. Class, organization, event, calendar, activity.
9. Messages, notifications, profile, privacy.
10. Services, bookings, provider screens.
11. Offline cache and pending-action replay.
12. TalkBack pass and unauthorized-access pass (the security case list in §1.9).

---

## 28. Definition of done

The Android client is done when:

- A person can sign in with `+263771234567` / `123456` against the existing API.
- Account state routes match §4.
- All five tabs open real data, not Coming Soon.
- Course offering `coe-2026-s2-eeng401` shows every tab with server data.
- Assignments show a submission boundary and never claim CampusOS received a file unless the server says `canSubmitInCampusOs: true` (it will not, in this release).
- Study group copy states that the group does not replace course or class.
- Search never shows an object the token cannot view.
- Offline Home still renders the last snapshot with the official banner.
- Provider screens do not grant capabilities the API denies.
- No registration number, OTP, or token appears in logs.
- Deep links in the route table open the same objects as iOS.

The Android agent will read `api-source-of-truth/architecture/architecture-freeze.ts` and the policy files in `api-source-of-truth/` before writing the first Activity. Absence of `services/api` is not a stop. If a screen is easier to build by inventing a local object, the agent will stop and use the canonical object instead.

This is the same instruction the iOS agent was given. It is not relaxed for Android.
