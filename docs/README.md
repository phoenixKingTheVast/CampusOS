# CampusOS documentation for the Android agent

This `docs/` folder is a **complete workspace**. You do not need `services/api`, Prisma, or the NestJS server in this tree to start building the Android client.

If a previous instruction said to wait until `services/api` is readable: that wait is over. The freeze and every policy file are in `api-source-of-truth/`.

| File | What it is |
|---|---|
| `CAMPUSOS_ANDROID_AGENT_SPEC.md` | Binding handoff. Architecture freeze, every route, every API, remaining screens, Android-specific rules. **Start here.** |
| `api-source-of-truth/` | Copied freeze, access, errors, and every `*-policy.ts` / `*-rules.ts`. **This replaces `services/api` for the Android workspace.** |
| `original-ios-spec/` | Original iOS specifications, reproduced verbatim. |

## You may write Android screens now

After reading:

1. `CAMPUSOS_ANDROID_AGENT_SPEC.md`
2. `api-source-of-truth/architecture/architecture-freeze.ts`
3. `api-source-of-truth/README.md` and the listed policy files as you touch each domain

…implement the client. Point the app at an existing CampusOS API (`/api/v1`). Do not rebuild the backend. Do not invent a second object model.

Do not start from memory of a chat. Start from these files.
