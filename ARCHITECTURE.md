# CampusOS Master Architecture

**Status: FROZEN**

CampusOS is a student-centered digital platform. Domain objects, relationships, permissions, workflows and integrations form one coherent system. New requirements are changes against this architecture, not a reason to redesign it.

> One person. One identity. Canonical objects. Contextual relationships. Centralized permissions. Reusable infrastructure. Server-authoritative state.

Build around objects and relationships, not around screens. The Home screen, navigation and UI may change. Faculties, services, organization types and communication channels may be added. The underlying objects remain coherent.

CampusOS is **not** a rebuild of every university ERP system.

Machine-checked invariants live in `services/api/src/architecture/architecture-freeze.ts`.

---

## 1. Product

CampusOS provides one platform for academic life, student communication, campus discovery, organizations, events, study groups, resources, university services, administrative workflows, campus locations, messaging, notifications, student-created content, and future service-provider commerce.

It remains **student-first, context-aware, permission-driven and integration-ready**.

## 2. Canonical objects

Do not create another object when an existing object already represents the concept. Contextualize instead.

| Need | Use |
| --- | --- |
| Study-group chat | `CONVERSATION` kind `STUDY_GROUP` |
| Organization event | `EVENT` |
| Resource bytes | `FILE` |
| Service alert | `NOTIFICATION` |
| Course membership | `ENROLLMENT` |
| Event on a calendar | `ACTIVITY` |
| Organization / study-group discussion | `POST` / `COMMENT` |

Canonical objects: `PERSON`, `CLASS`, `COURSE`, `COURSE_OFFERING`, `ORGANIZATION`, `EVENT`, `RESOURCE`, `STUDY_GROUP`, `SERVICE`, `ACTIVITY`, `CONVERSATION`, `POST`, `COMMENT`, `NOTIFICATION`, `FILE`, `MEDIA`, `LOCATION`, `SERVICE_REQUEST`, `BOOKING`, `ASSIGNMENT`, `ANNOUNCEMENT`, `ASSESSMENT`, `ENROLLMENT`, `MEMBERSHIP`, `RELATIONSHIP`, `PERMISSION`, `ROLE`, `ROLE_ASSIGNMENT`, `AUDIT_EVENT`, `INTEGRATION`.

## 3. Relationships

A `PERSON` owns/creates, follows, connects, joins, participates, authors or requests an object. That object may have `ACTIVITY`, `CONVERSATION`, `RESOURCE`/`FILE`, generate `NOTIFICATION`s, and is governed by `PERMISSION`s.

If a proposed feature cannot attach to this model, stop before implementing it.

## 4. Authorization

Every protected action follows:

`Person → Authentication → Role → Relationship/Membership → Scope → Object → Object State → Permission → Privacy/Policy → Approval → ALLOW/DENY`

The backend decides. Flutter may hide unavailable actions. The API must independently enforce them.

## 5. Identity

One Person identity, multiple roles, contextual memberships. A person may be student, class representative, organization officer, study-group admin and service provider without separate accounts.

Authentication: Phone → OTP → Session → Person. Institutional verification is a separate layer.

## 6. Stack

Flutter (iOS/Android) over HTTPS/WebSocket to a NestJS `/api/v1` modular monolith. Application use-cases sit above canonical domain objects. PostgreSQL is the source of truth. Redis is queues/cache. R2 (MinIO in development) is files. External systems integrate at the boundary; they remain authoritative where they already are.

## 7. Backend layout

Organize by domain (`auth`, `people`, `academic`, `organizations`, `events`, `content`, `resources`, `files`, `messaging`, `notifications`, `study-groups`, `locations`, `campus-services`, `search`, `moderation`, `administration`, `synchronization`, …). Keep business logic out of controllers. Do not duplicate engines under a new folder name.

## 8. Database

PostgreSQL is authoritative. Prisma is the data-access layer. Create a table when the domain requires persistent state — not because a future feature might need it.

## 9. Flutter layout

`apps/mobile/lib/` keeps `app/`, `core/`, `features/`, `shared/`. Feature modules own presentation/data/domain. Shared code is reusable infrastructure, not random business logic.

## 10. API

All APIs use `/api/v1`. HTTP status is the broad failure class; a stable machine-readable `code` is the application meaning. Success payloads carry `data` and optional `meta`.

## 11. Offline

Offline-capable, not offline-authoritative. The server owns identity, permissions, memberships, academic state, official workflows and authoritative transactions. The device may hold drafts, cached content and queued safe actions. Queueable mutations use `clientActionId` and must be idempotent.

## 12. Search

Indexing may be broad internally. Results are permission-filtered before exposure. Private metadata must not leak through counts, autocomplete, snippets, usernames, filenames or object existence.

## 13. Files

Never expose permanent private storage URLs. Authorize, then issue a short-lived signed URL. `RESOURCE`, `MESSAGE`, `PROFILE`, `EVENT`, `SERVICE_REQUEST` and `VERIFICATION` own files; they do not become separate storage systems.

## 14. Notifications

Domain event → rule → eligible recipients → preferences → notification → delivery (APNs / email / in-app). No feature implements its own delivery pipeline.

## 15. Realtime

REST is authoritative state. WebSocket is supplemental delivery. SQLite is local cache. Sync recovers missed changes after reconnect. Realtime is never the only way to obtain authoritative state.

## 16. Security

Authentication, authorization, validation, rate limiting, ownership, context permissions, privacy, audit. Verification evidence, registration numbers, private messages, protected files, administrative records and session material receive stronger protection than ordinary campus content.

Unauthorized access is denied without leaking protected information.

## 17. Observability

Logs debug operations. Metrics measure behaviour (latency, errors, queue depth, sync/push/file failures). Audit is accountability (role granted, membership approved, content removed, verification completed). Do not treat application logs as audit records.

## 18–19. Testing

Unit tests cover domain rules. Integration tests cover API, authz, files, queues. Widget tests cover screens, loading, offline and accessibility. End-to-end tests cover the MVP loop (OTP, verification, class, course, resource, message, RSVP, study group, service request, notification deep link, offline recovery).

Security tests must include cross-student private resources, other-class content, former members, blocked DMs, expired admin roles, forged `clientActionId`, duplicate mutations, expired signed URLs, malformed/oversized uploads and rate-limit bypass.

## 20–21. Deployment and environments

Production: Cloudflare → API + R2, PostgreSQL, Redis/BullMQ workers. Development: Docker PostgreSQL (Redis and MinIO when those workers exist). Environments: `development`, `staging`, `production`. Never use production credentials or production student data in ordinary development. Secrets live in environment configuration, not committed source.

## 22. Build order

1. Foundation (repo, Docker, Postgres, Redis, Prisma, API, Flutter shell, CI, logging)
2. Identity
3. Academic foundation
4. Student utility (Home, Learn, Search, Calendar, Events, Resources, Files, Notifications)
5. Communication
6. Community (Organizations, Study Groups, Locations)
7. Services
8. Administration
9. Hardening

## 23. MVP

The first usable release proves:

`LOGIN → VERIFY → JOIN CLASS → SEE CAMPUS/ACADEMIC CONTENT → ACCESS COURSES → COMMUNICATE → DISCOVER EVENTS/ORGANIZATIONS → USE SERVICES`

The architecture may support later complexity without forcing it into version one.

## 24. Do not build prematurely

Not a full ERP, banking system, complete LMS replacement, hospital system, giant social network, project-management platform, ride-hailing system, full e-commerce platform, or a replacement for every UZ database. Integrate where an authoritative external system already exists.

## 25. Development rule

Before adding anything, ask:

1. Does an existing object already represent this?
2. Does an existing relationship already represent this?
3. Does an existing permission model already cover this?
4. Does an existing workflow already cover this?
5. Can this be implemented by contextualizing an existing object?

Only if every answer is **no** may a new domain object or subsystem be introduced.

## 26–27. Product shape

Academic (classes, courses, enrollments, resources, assignments), Community (organizations, study groups, posts, events) and Services (requests, workflows, bookings, providers) sit on a shared platform: identity, messaging, search, calendar, notifications, permissions, relationships, files, locations, offline/sync, administration, audit, integrations.

Administration is a control plane. It does not become the university’s system of record.

## 28. Definition of done for this freeze

Canonical domain, identity, authorization, lifecycle, REST, database, Flutter, offline/sync, files, notifications, realtime, administration, integration boundary, security, testing, deployment, MVP boundary and build sequence are defined.

From this point the implementation path is:

`ARCHITECTURE → REPOSITORY → DATABASE SCHEMA → BACKEND FOUNDATION → FLUTTER FOUNDATION → AUTHENTICATION → ACADEMIC CORE → MVP → TESTING → UZ PILOT`
