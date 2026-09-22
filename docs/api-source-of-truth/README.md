# Locked API source of truth (copied)

`services/api` is **not required** in the Android workspace. These files are copies of the locked NestJS policy, rules, freeze, access, and error modules.

The Android agent may, and should, start writing screens after reading this folder. Do not wait for the NestJS runtime, Prisma, or the full monorepo.

## Read first

| File | Why |
|---|---|
| `architecture/architecture-freeze.ts` | Frozen invariants. Canonical objects. Authorization chain. |
| `common/errors.ts` | Error codes and default copy. |
| `common/access.service.ts` | Course-offering permissions the UI may consult. |

## Then the domain rules

| File | Domain |
|---|---|
| `home/home-rules.ts` | Up Next scoring, first-time Home, attention merge. |
| `search/search-rules.ts` | Type normalize, ranking, study-group discoverability. |
| `study-groups/study-group-policy.ts` | Join, actions, forbidden replacements. |
| `resources/resource-policy.ts` | Historical resources, metadata window, announcement push. |
| `people/profile-policy.ts` | Field visibility, never-public fields. |
| `people/social-rules.ts` | Username, audience, block, messaging policy. |
| `settings/settings-policy.ts` | Reauth, cacheable settings, analytics forbidden keys. |
| `settings/account-lifecycle.ts` | Deletion grace, attribution. |
| `content/feed-query.ts` | Feed eligibility. Client never hides posts the server sent. |
| `content/viewer-context.ts` | Memberships the feed uses. |
| `content/content-policy.ts` | Posts, comments, reactions. |
| `files/file-policy.ts` | Security class, signed URL TTL, quotas. |
| `messaging/messaging-rules.ts` | Edit window, derived participants. |
| `notifications/notification-rules.ts` | Quiet hours, deep links. |
| `campus-services/booking-rules.ts` | Slot consumption, timezone offset 120. |
| `campus-services/service-rules.ts` | Discoverable / bookable statuses. |
| `campus-services/commerce-policy.ts` | Payments not required for MVP. |
| `administration/governance-policy.ts` | CampusOS is not the university ERP. |
| `administration/approval-policy.ts` | Class-rep approval tiers. |
| `administration/admin-authorization.ts` | Context admin is not university admin. |
| `locations/location-policy.ts` | Discovery does not grant object access. |
| `locations/map-provider.ts` | Android should prefer Google Maps / OSM, not Apple. |
| `synchronization/sync-rules.ts` | What may queue offline. |
| `moderation/moderation-rules.ts` | Reports. Do not make reported content searchable. |

These copies are for reading. Do not edit them to invent a second architecture. If the live API later changes, the repository `services/api/src` is the origin.
