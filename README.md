# CampusOS

University operating system for the University of Zimbabwe. This repository implements the locked iOS engineering specification: Flutter client, NestJS API, PostgreSQL, and local SQLite cache.

The server is authoritative for identity, roles, permissions, memberships, academic structure, verification, object lifecycle, and synchronization. The Flutter UI never authorizes on its own.

## Course, announcements and resources

Course screens are bound to a **Course Offering** ID (`/app/learn/course/:courseOfferingId`), not a course code. Announcements and resources live inside that offering. Historical files keep their original semester and never appear as current-offering material.

Files are physical objects. Resources are academic objects with provenance, versions, endorsement, a 45-minute server-side metadata window, and CampusOS-managed offline copies. File downloads use authenticated or short-lived signed URLs, never permanent public storage links.

## Architecture

```text
apps/mobile          Flutter + Riverpod + SQLite
services/api         NestJS modular monolith, REST /api/v1
PostgreSQL           authoritative store
SQLite               authorized client cache
```

## Prerequisites

- Node.js 20+
- Docker (PostgreSQL) or a local Postgres instance
- Flutter 3.24+ for the iOS client

## API

```bash
cd services/api
cp .env.example .env
docker compose up -d
npm install
npx prisma migrate dev
npx prisma db seed
npm run start:dev
```

API base: `http://localhost:3000/api/v1`

Development OTP for `+263771234567` is logged to the API console and accepted as `123456`.

## Flutter

```bash
cd apps/mobile
flutter pub get
flutter run
```

Point the client at the API with `--dart-define=API_BASE_URL=http://localhost:3000/api/v1`.
