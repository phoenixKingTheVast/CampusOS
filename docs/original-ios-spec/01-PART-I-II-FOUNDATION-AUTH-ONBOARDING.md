# ORIGINAL CAMPUSOS iOS SPECIFICATION — REPRODUCED VERBATIM

This file is the original engineering specification used to build the CampusOS iOS client. It is reproduced here so the Android agent receives the same words, the same third-person voice, and the same density.

**How the Android agent must read it**

- Every rule applies to the Android client.
- Replace "iOS app" / "iOS client" with "Android app" / "Android client" except where a sentence is about Xcode, the iOS Runner folder, or Cupertino widgets.
- If this original text and `docs/CAMPUSOS_ANDROID_AGENT_SPEC.md` disagree, the Android handoff spec and the running NestJS API win. The architecture freeze always wins.
- Do not treat "Flutter + Dart" as mandatory if you implement Kotlin, but the routes, JSON, permissions, copy, and object model remain mandatory.

---

I will be giving you the spects in third person but its meant for you

Absolutely. We’ll make this the **actual handoff-grade iOS specification**, not another high-level overview.

Because it is large, I’ll structure it as a formal engineering document and work through it in logical sections. **Part 1 below covers the application foundation, startup, authentication, onboarding, identity and verification.** Then we’ll continue screen-by-screen through the rest of the iOS application without changing the locked architecture.

# CampusOS iOS — Screen-by-Screen Engineering Specification v1.0

**Platform:** iOS
**Framework:** Flutter + Dart
**Architecture:** Modular client + offline-capable synchronization
**Backend:** NestJS + TypeScript modular monolith
**API:** REST `/api/v1` + WebSockets
**Database:** PostgreSQL
**Local database:** SQLite
**State management:** Riverpod
**Authentication:** Phone + OTP
**Primary initial market:** University of Zimbabwe
**Document status:** Engineering specification
**Architecture status:** Derived from locked Audits 01–16

---

# PART I — APPLICATION FOUNDATION

## 1. Non-Negotiable Engineering Rules

The coding agent MUST follow these rules throughout the implementation.

### 1.1 Server authority

The server is authoritative for:

* identity
* authentication
* roles
* permissions
* memberships
* academic structure
* course enrollment
* verification
* object lifecycle
* moderation
* notifications
* authoritative timestamps
* synchronization
* historical state

The client may cache and optimistically represent state, but the server ultimately decides.

---

### 1.2 UI is not authorization

The following is forbidden:

```text
if (user.isClassRep) {
    showRemoveButton();
}
```

as the only protection.

Instead:

```text
UI visibility
       ↓
UX convenience
       ↓
API request
       ↓
server authorization
       ↓
ALLOW / DENY
```

The UI may hide an unavailable action, but the backend must independently validate it.

---

### 1.3 Domain objects are canonical

Screens never become sources of truth.

For example:

```text
Course screen
      ↓
Course Offering object
```

not:

```text
Course screen
      ↓
some separate course-screen database record
```

---

### 1.4 No duplicated domain logic

Flutter should not independently implement rules such as:

* "a class needs two representatives to remove someone"
* "this person is officially enrolled"
* "this course is archived"
* "this user is permitted to moderate"

Those rules belong to the backend.

The client represents server-provided state and provides appropriate UX.

---

# 2. Flutter Application Architecture

```text
apps/mobile/
│
├── lib/
│
│   ├── main.dart
│   │
│   ├── app/
│   │   ├── app.dart
│   │   ├── router.dart
│   │   ├── theme/
│   │   ├── config/
│   │   └── bootstrap/
│   │
│   ├── core/
│   │   ├── network/
│   │   ├── database/
│   │   ├── authentication/
│   │   ├── synchronization/
│   │   ├── permissions/
│   │   ├── errors/
│   │   ├── logging/
│   │   ├── connectivity/
│   │   ├── notifications/
│   │   └── storage/
│   │
│   ├── features/
│   │   ├── authentication/
│   │   ├── onboarding/
│   │   ├── home/
│   │   ├── learn/
│   │   ├── search/
│   │   ├── explore/
│   │   ├── calendar/
│   │   ├── messaging/
│   │   ├── profile/
│   │   ├── notifications/
│   │   ├── classes/
│   │   ├── courses/
│   │   ├── organizations/
│   │   ├── events/
│   │   ├── resources/
│   │   ├── study_groups/
│   │   ├── services/
│   │   ├── settings/
│   │   └── administration/
│   │
│   └── shared/
│       ├── widgets/
│       ├── models/
│       ├── extensions/
│       ├── validators/
│       └── utilities/
│
├── test/
└── integration_test/
```

---

# 3. Application Bootstrap

## Screen: Splash / Startup

### Route

```text
/splash
```

This is not a normal navigable destination.

It exists while the application determines its initial state.

---

## 3.1 Startup sequence

```text
App launch
   ↓
Flutter initialization
   ↓
Load configuration
   ↓
Initialize secure storage
   ↓
Initialize SQLite
   ↓
Initialize connectivity monitor
   ↓
Initialize API client
   ↓
Initialize notification service
   ↓
Initialize sync engine
   ↓
Read session
   ↓
Determine authentication state
```

---

## 3.2 Possible outcomes

### State A — No session

```text
Splash
 ↓
Welcome / Authentication
```

### State B — Valid session

```text
Splash
 ↓
Load cached identity
 ↓
Synchronize
 ↓
Home
```

### State C — Session expired

```text
Splash
 ↓
Session expired
 ↓
Authentication
```

### State D — Offline + valid cached session

```text
Splash
 ↓
Cached session valid locally
 ↓
Offline mode
 ↓
Home
```

---

# 4. Startup Error Handling

If initialization fails:

```text
CampusOS couldn't start

Please try again.

[ Retry ]
```

Technical error details must not be displayed to ordinary users.

A request/correlation ID can be logged internally.

---

# 5. Authentication Architecture

Authentication has two distinct concepts:

```text
Authentication
    =
Who are you?

Authorization
    =
What are you allowed to do?
```

Phone authentication establishes the account session.

UZ verification establishes institutional status.

These must never be conflated.

---

# 6. Screen: Welcome

### Route

```text
/welcome
```

### Purpose

Introduce CampusOS and start authentication.

### Layout

```text
CampusOS

Everything you need
for university life.

[ Continue with phone ]

Already have an account?
Continue with your phone number.

Terms of Service
Privacy Policy
```

### Actions

**Continue with phone**

→ Phone authentication.

---

# 7. Phone Authentication Screen

### Route

```text
/auth/phone
```

### Components

* page title
* phone number input
* country selector
* Continue button
* terms/privacy links

### Default country

Zimbabwe:

```text
+263
```

The user can change the country if the product eventually permits international users.

---

# 8. Phone Number Validation

Client performs basic validation.

Server performs authoritative validation.

Client validation:

* non-empty
* valid country code
* valid number structure
* normalized format

Canonical storage:

```text
E.164
```

Example:

```text
+263771234567
```

---

# 9. OTP Request API

```http
POST /api/v1/auth/otp/request
```

Request:

```json
{
  "phoneNumber": "+263771234567"
}
```

Response:

```json
{
  "challengeId": "otp_ch_abc123",
  "expiresAt": "2026-09-15T20:15:00Z",
  "resendAvailableAt": "2026-09-15T20:14:30Z"
}
```

The actual OTP is never returned to the client.

---

# 10. OTP Security

Backend must:

* rate-limit requests
* rate-limit verification attempts
* expire OTPs
* make OTPs single-use
* invalidate old OTPs where appropriate
* prevent brute-force attempts
* avoid exposing whether a phone number belongs to a specific account beyond the intended authentication flow

OTP should be stored as a secure hash/challenge representation rather than plaintext.

---

# 11. Screen: OTP Verification

### Route

```text
/auth/otp
```

### Layout

```text
Enter verification code

We sent a code to
+263 77 *** 4567

[ _ ][ _ ][ _ ][ _ ][ _ ][ _ ]

Didn't receive it?

Resend code

Change phone number
```

---

# 12. OTP Interaction

Support:

* automatic SMS code suggestion where iOS permits
* manual entry
* paste
* resend countdown
* change number

Do not force users to manually type each digit if iOS can provide the code automatically.

---

# 13. OTP Verification API

```http
POST /api/v1/auth/otp/verify
```

Request:

```json
{
  "challengeId": "otp_ch_abc123",
  "otp": "123456"
}
```

Successful response:

```json
{
  "session": {
    "accessToken": "...",
    "refreshToken": "...",
    "expiresAt": "..."
  },
  "person": {
    "id": "person_123",
    "name": "...",
    "username": "..."
  },
  "accountState": "ACTIVE"
}
```

---

# 14. Session Management

Tokens are never stored in ordinary preferences.

Use iOS secure storage/Keychain through the Flutter platform abstraction.

Architecture:

```text
AuthRepository
      ↓
SessionManager
      ↓
SecureStorage
      ↓
iOS Keychain
```

---

# 15. Refresh Token Flow

When access token expires:

```text
API request
 ↓
401
 ↓
SessionManager
 ↓
Refresh token
 ↓
new access token
 ↓
retry request
```

If refresh fails:

```text
Session invalid
 ↓
clear session
 ↓
authentication
```

Requests must not endlessly retry.

---

# 16. Session Revocation

Settings → Security → Sessions.

User should eventually be able to see:

```text
iPhone 15 Pro
Current device
Last active: Now

Windows Chrome
Last active: 2 hours ago

[ Sign out ]
```

Backend:

```http
POST /api/v1/auth/sessions/{sessionId}/revoke
```

---

# 17. First-Time Account State

After OTP verification, backend determines whether the person has completed onboarding.

Possible state:

```text
NEW
PROFILE_INCOMPLETE
STUDENT_VERIFICATION_PENDING
STUDENT_VERIFIED
CLASS_VERIFICATION_PENDING
ACTIVE
SUSPENDED
```

The client routes based on server state.

---

# 18. Screen: Profile Setup

### Route

```text
/onboarding/profile
```

### Purpose

Create the persistent CampusOS Person identity.

### Fields

#### Required

* legal/real name
* username

#### Optional

* profile photo
* bio

Phone number is already associated with authentication.

---

# 19. Real Name

The name should be represented as structured data where practical:

```text
givenName
middleName
familyName
displayName
```

The display name can be generated but should remain user-editable subject to platform policy.

Institutional verification can establish the verified institutional identity.

---

# 20. Username

Input:

```text
@ username
```

Backend:

```http
GET /api/v1/users/username/availability?username=matthew
```

The final creation request remains authoritative.

Username rules:

* unique
* case-insensitive uniqueness
* allowed characters
* reserved names
* minimum/maximum length
* anti-impersonation rules

---

# 21. Profile Photo

The user can:

```text
Take Photo
Choose from Photos
Skip
```

Permission requested only when needed.

Photo upload:

```text
Flutter
 ↓
File validation
 ↓
Upload
 ↓
Object storage
 ↓
Media record
 ↓
Person profile reference
```

Profile photo is **not** an academic Resource.

---

# 22. Profile Creation API

```http
POST /api/v1/people/me/profile
```

Example:

```json
{
  "displayName": "Matthew Dziirutsva",
  "username": "matthew",
  "bio": "Electrical Engineering"
}
```

---

# 23. Student Verification Introduction

After profile completion:

```text
Verify your university identity

Connect your CampusOS profile
to your UZ student status.

You'll need:
• Registration number
• Programme
• Faculty
• Student ID
```

Button:

**Start verification**

There should also be an appropriate route to continue with public/non-student functionality if verification is not mandatory for general CampusOS access.

---

# 24. Student Verification Screen

### Route

```text
/onboarding/student-verification
```

### Fields

```text
Registration number
[____________]

Programme
[ Select ]

Faculty
[ Select ]

Student ID
[ Upload ]
```

---

# 25. Programme Selection

The client should not hard-code programme lists.

API:

```http
GET /api/v1/academic/programmes
```

Potential response:

```json
{
  "items": [
    {
      "id": "programme_123",
      "code": "BScEEE",
      "name": "Bachelor of Science in Electrical Engineering",
      "facultyId": "faculty_1"
    }
  ]
}
```

Faculty can be inferred from programme where appropriate.

---

# 26. Student ID Capture

Options:

```text
Take photo
Choose existing photo
```

Before upload:

* show preview
* allow retake
* explain secure use
* prohibit accidental public posting

---

# 27. Verification Evidence Upload

Upload pipeline:

```text
Photo
 ↓
Client validation
 ↓
Secure upload endpoint
 ↓
Virus/file validation
 ↓
Object storage
 ↓
VerificationEvidence
```

Sensitive verification evidence belongs to security class D.

It must not enter:

* global search
* ordinary media library
* user profile
* public file URLs
* resource search.

---

# 28. Verification Submission

```http
POST /api/v1/verifications/student
```

Request concept:

```json
{
  "registrationNumber": "...",
  "programmeId": "...",
  "facultyId": "...",
  "evidenceFileId": "file_..."
}
```

Server creates:

```text
StudentVerification
status = PENDING
```

---

# 29. Screen: Verification Pending

```text
Student verification

Status
● Pending review

Your information has been submitted
for verification.

You can continue using CampusOS while
verification is being processed.
```

The exact available features depend on authorization.

---

# 30. Verification Result

### Approved

```text
✓ Student verified

You're verified as a University of
Zimbabwe student.
```

### Rejected

```text
Student verification

We couldn't verify your information.

Reason:
[appropriate explanation]

[ Correct information ]
```

Do not expose internal moderation/security reasoning unnecessarily.

---

# 31. Class Discovery

After student verification:

```text
Find your class

Select the class you currently belong to.

[ Search classes ]
```

Search:

```http
GET /api/v1/classes?search=EEE4
```

---

# 32. Class Selection

Example:

```text
EEE 4.1
Electrical Engineering
Year 4 · 2026

3 representatives

[ Request membership ]
```

---

# 33. Class Membership Request

```http
POST /api/v1/classes/{classId}/membership-requests
```

Server creates:

```text
ClassMembership
status = PENDING
```

Class representatives receive an appropriate notification.

---

# 34. Class Representative Approval

Representative sees:

```text
New class membership request

Matthew Dziirutsva

Programme:
Electrical Engineering

Registration information:
[restricted verification view]

[ Approve ]
[ Reject ]
```

The representative sees only information necessary for verification.

---

# 35. Approval API

```http
POST /api/v1/class-memberships/{membershipId}/approve
```

Server validates:

```text
Actor
 ↓
Class Representative role
 ↓
Correct class
 ↓
Membership request
 ↓
Authorization
 ↓
Approve
```

---

# 36. Class Membership Activation

On approval:

```text
PENDING
   ↓
ACTIVE
```

User receives:

> You've been added to EEE 4.1.

Class becomes available under Learn.

---

# 37. No Class Representative

If the class has no active representative:

```text
No class representative available

This class cannot currently process
new membership requests.

You can still use other CampusOS features.
```

Do not invent provisional class membership in MVP.

---

# 38. Main App Entry

Once onboarding reaches an appropriate active state:

```text
/onboarding
       ↓
MainShell
```

Main shell:

```text
Home
Learn
Explore
Calendar
Messages
```

---

# PART II — GLOBAL APP INFRASTRUCTURE

## 39. Routing Architecture

Use declarative routing.

Conceptually:

```text
/
├── splash
├── welcome
├── auth
│   ├── phone
│   └── otp
├── onboarding
│   ├── profile
│   ├── student-verification
│   └── class-verification
└── app
    ├── home
    ├── learn
    ├── explore
    ├── calendar
    ├── messages
    └── profile
```

Nested routes:

```text
/app/learn/course/:courseOfferingId
/app/learn/course/:courseOfferingId/resources/:resourceId
/app/explore/organization/:organizationId
/app/explore/event/:eventId
/app/messages/:conversationId
```

---

# 40. Navigation Rules

### Push navigation

Use when moving deeper into a context:

```text
Learn
 ↓
Course
 ↓
Resource
```

### Modal/sheet

Use for:

* filters
* quick actions
* small forms
* confirmations

### Full-screen form

Use for:

* complex creation
* multi-step editing
* large resource uploads
* profile editing where necessary.

---

# 41. Universal Deep-Link Resolution

Every object deep link follows:

```text
Deep link
 ↓
Authentication check
 ↓
Object lookup
 ↓
Permission check
 ↓
Lifecycle check
 ↓
Open canonical screen
```

Example:

```text
campusos://resource/res_123
```

If unauthenticated:

```text
Login
 ↓
Return to resource
```

If unauthorized:

```text
Access unavailable
```

---

# 42. Global Search

Search is accessible from the main application context.

Search must never leak private data.

The backend filters first.

---

# 43. Global Notifications

Bell icon opens:

```text
/notifications
```

Notification item:

```text
Dr Moyo
New Control Systems announcement

10 min ago
```

Tap:

```text
Notification
 ↓
sourceObject
 ↓
canonical screen
```

---

# 44. Global Offline Indicator

Do not put a giant "OFFLINE" banner permanently across the app.

Use contextual indication.

Example:

```text
Offline
Showing recent information
```

or a subtle connection indicator.

Pending action:

```text
⌛ Waiting to send
```

Failed:

```text
⚠ Couldn't send
```

---

# 45. Local Database

SQLite stores normalized cached domain objects.

At minimum:

```text
persons
roles
classes
class_memberships
courses
course_offerings
enrollments
organizations
organization_memberships
events
activities
resources
files
study_groups
study_group_memberships
conversations
messages
notifications
pending_actions
sync_metadata
```

Do not create a second unrelated data model merely for UI convenience.

---

# 46. Local Database Rule

Every local entity must be traceable to:

```text
server object ID
```

Example:

```text
server:
resource_123

local:
resource_123
```

Never use a random local ID as the only identity of a synchronized object.

---

# 47. Synchronization Metadata

Each synchronized object should have information such as:

```text
serverId
serverVersion
updatedAt
syncState
lastSyncedAt
```

Pending actions have:

```text
clientActionId
actionType
targetObject
payload
createdAt
retryCount
state
lastError
```

---

# 48. Security Boundary

Sensitive information should not casually enter SQLite.

Especially:

* OTP
* access tokens
* refresh tokens
* student ID verification evidence
* private security data

Tokens use secure storage.

Verification evidence should have a tightly controlled local policy and preferably not be cached after upload.

---

# 49. Connectivity Architecture

Connectivity status is informational.

Do not assume:

```text
Wi-Fi connected = Internet available.
```

API reachability is authoritative for actual network operations.

States:

```text
ONLINE
OFFLINE
LIMITED
```

---

# 50. Background Synchronization

When connectivity becomes available:

```text
Connectivity restored
 ↓
Sync queued actions
 ↓
Fetch changed server objects
 ↓
Resolve conflicts
 ↓
Update local DB
 ↓
Update UI
```

The app must avoid aggressive battery-draining polling.

Use appropriate iOS background mechanisms.

---

# 51. WebSocket Architecture

WebSockets are used for appropriate realtime functions:

* messages
* message delivery state
* relevant notifications
* presence where implemented
* selected live updates

WebSocket connection does **not** replace REST.

REST remains the authoritative request/data API.

---

# 52. WebSocket Reconnection

```text
CONNECTED
 ↓
DISCONNECTED
 ↓
BACKOFF
 ↓
RECONNECT
```

Use bounded exponential backoff.

Messages sent while disconnected go through the normal offline queue.

---

# 53. API Client

Every request should pass through a centralized API layer.

```text
ApiClient
├── authentication
├── headers
├── token refresh
├── request IDs
├── serialization
├── error mapping
└── retry policy
```

Feature repositories should not manually implement token refresh.

---

# 54. Request Identification

Each API request should carry a correlation/request ID.

Useful for:

* debugging
* support
* server logs
* crash reports
* synchronization issues

Never expose sensitive request details to the user.

---

# 55. Error Mapping

Server:

```text
PERMISSION_DENIED
```

Flutter:

> You don't have permission to do that.

Server:

```text
CONFLICT
```

Flutter:

> This information changed while you were editing it. Please review the latest version.

Server:

```text
RATE_LIMITED
```

Flutter:

> Too many attempts. Please wait and try again.

---

# 56. Testing Requirements

The iOS implementation must have:

### Unit tests

For:

* validators
* repository logic
* sync state
* serialization
* routing decisions
* permission presentation logic

### Widget tests

For:

* loading
* empty
* error
* offline
* permission states
* major components

### Integration tests

For:

* authentication
* onboarding
* course navigation
* resource download
* messaging
* synchronization
* deep links

### Backend contract tests

Client must be tested against actual API contracts.

---

# 57. Acceptance Criteria for Part I

The coding agent must not consider this section complete unless:

* app starts reliably
* authentication works
* OTP flow works
* sessions persist securely
* logout works
* profile creation works
* student verification flow exists
* sensitive evidence is protected
* class membership workflow exists
* no-rep state works
* routing works
* deep-link architecture exists
* local SQLite initializes
* offline state is represented
* sync engine has explicit states
* API errors are normalized
* authorization is not enforced solely by UI
* accessibility foundations exist
* automated tests cover critical flows.

---

# PART I STATUS

**Foundation + Startup + Authentication + Onboarding + Identity + Verification: LOCKED.**

The next section is where the actual **CampusOS experience begins**:

# PART III — HOME

We will specify Home down to:

* exact hierarchy
* every component
* responsive behaviour on iPhone sizes
* Up Next algorithm/data contract
* Today
* Needs Your Attention
* Your Campus
* Discover
* pull-to-refresh
* loading skeletons
* empty states
* offline state
* notification interactions
* deep links
* API endpoints
* SQLite entities
* Riverpod providers
* actions
* permissions
* acceptance tests

Then we move directly into **Learn → Course → Resources → Assignments → Class → Study Groups**, followed by Explore, Calendar, Messages, Profile, Settings and Administration.
