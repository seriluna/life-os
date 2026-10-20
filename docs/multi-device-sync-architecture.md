# LIFE OS: Multi-device sync architecture plan

Status: design only. No application behavior, storage, or production data is changed by this document.

## 1. Current architecture (verified from main)

LIFE OS is a static HTML/JavaScript PWA hosted through GitHub Pages. It currently has no account system, API server, or multi-device sync. Records are saved in the current browser's `localStorage`.

### Storage-key inventory

| Data | Key pattern | Notes |
|---|---|---|
| Project list | `lifeos.projects.v1` | Shared list of projects on this browser |
| Active project | `lifeos.activeProject.v1` | Currently selected project ID |
| Routine/business/day records | `lifeos.records.v1.<projectId>` | Daily checklist, metrics, reflections |
| Routine settings | `lifeos.settings.v1.<projectId>` | Per-project goals/settings |
| Custom checklist groups | `lifeos.checklist.groups.v1.<projectId>` | Per-project custom groups |
| Health/food/activity logs | `lifeos.health.logs.v1.<projectId>` | Per-date health records |
| Health goals | `lifeos.health.goals.v1.<projectId>` | Weight target, deadline, daily and routine targets |
| Minimum/full mode by date | `lifeos.modes.v1` | Currently stored without project ID |
| Legacy routine records | `lifeos.records.v1` | Migrated to project1 if its scoped key is absent |
| Legacy routine settings | `lifeos.settings.v1` | Migrated to project1 if its scoped key is absent |
| Legacy timeline | `lifeos.project.timeline.v1` | Old project1 start/target date source |
| Legacy checklist groups | `lifeos.checklist.groups.v1` | Migrated to project1 if scoped key is absent |
| Legacy health logs | `lifeos.health.logs.v1` | Migrated to project1 if scoped key is absent |
| Legacy health goals | `lifeos.health.goals.v1` | Migrated to project1 if scoped key is absent |

Important: the app's JSON backup/restore also handles project-specific data and legacy health keys. Keep this existing safety path working throughout any future migration.

## 2. Product goals and non-goals

### Goals
- A signed-in user can access their own data from multiple devices.
- Existing local-only users can keep using the app without an account.
- A user can inspect and approve migration before local records are uploaded.
- Existing JSON export/restore remains available.
- Health/food/weight data is never uploaded without an explicit, informed action.

### Non-goals for the first sync release
- Multi-user sharing or social features.
- Background upload of existing local data before consent.
- Deleting local records automatically after upload.
- Replacing the working local-only mode immediately.

## 3. Recommended staged architecture

1. **Keep the frontend static.** GitHub Pages can continue serving the app.
2. **Add a managed identity + database provider only after provider review.** Candidates to compare: Supabase (Postgres/Auth/Row Level Security) and Firebase (Authentication/Firestore/Security Rules). Do not select based on marketing claims alone.
3. **Create a thin data-access layer.** UI code should call a local repository interface instead of directly depending on a provider SDK. First implementation remains local-only; a remote adapter is introduced later.
4. **Scope all remote rows to an authenticated owner.** Every read/write must be enforced by server-side policy, not just hidden in the UI.
5. **Use versioned records and explicit sync state.** Each record needs a stable ID, owner ID, schema version, updated timestamp, and deletion/tombstone behavior where needed. The exact schema requires a follow-up decision before coding.
6. **Keep offline-first behavior.** Local edits remain available offline. Failed sync must be retryable and must not erase local data.
7. **Preserve export and account deletion.** Users need a full export and a clear way to delete server copies.

## 4. Provider decision criteria

Compare at least Supabase and Firebase against:
- Reliable access from the user's actual countries/networks (test from mainland China if that is a target environment).
- Authentication options, account recovery, and session safety.
- Database access policies and ease of proving cross-account isolation.
- Free-tier limits, likely paid cost, bandwidth/storage, and upgrade path.
- Backup, restore, export, deletion, logs, and data-region options.
- SDK size, static-site compatibility, maintainability, and test tooling.

No provider is selected yet. Regional reachability, current pricing, and data-region/privacy terms must be checked from official documentation before a decision.

## 5. Migration flow (must be explicit)

1. User signs in or creates an account.
2. App scans local data and shows the record categories, date range, and estimated record counts to be uploaded.
3. App offers a downloadable JSON backup and recommends saving it.
4. User explicitly confirms upload of the previewed data.
5. App uploads in batches with stable IDs and idempotency keys.
6. Server validates ownership and schema; partial failures are reported clearly.
7. App reads back a sample or verifies counts/checksums before marking migration complete.
8. Local data remains intact. No silent deletion or replacement.
9. If migration fails, retry is safe and cannot create duplicate records.

## 6. Conflict and deletion rules to decide before implementation

- Do not use blind last-write-wins for an entire project's JSON blob.
- Prefer per-record IDs and version/timestamp comparison; show a recovery path when both local and remote copies changed.
- Define how deletions sync (tombstones) so old devices cannot accidentally resurrect deleted records.
- Avoid merging records across different accounts or project IDs.
- A sign-out must stop remote access and clear in-memory account data, but should not silently delete local records.
- Account deletion must clearly explain that server-side records will be deleted; local copies and downloaded backups should be described separately.

## 7. Security and privacy requirements

- Never commit real user food, weight, health, or activity data.
- Do not put service-role/admin secrets in frontend code. Only public client configuration may be shipped, with server-side access policies enabled.
- Require owner-scoped policies and automated tests proving user A cannot read/write user B's data.
- Minimize data collected; document retention, export, deletion, and support contact before enabling sync.
- Keep HTTPS, safe session handling, and dependency review.
- Treat health records as sensitive even if this is a personal-use MVP.

## 8. Required tests before release

- Existing local-only user continues to work without login.
- Empty account and first login.
- User A cannot read, update, or delete user B's records.
- Migration preview matches the local record categories/date range/counts.
- User cancels migration: no upload occurs.
- Partial network failure and retry produce no duplicates.
- Local and remote edits conflict; neither copy is silently lost.
- Sign-out, account deletion, export, and restore work as documented.
- Backup/restore browser regression suite remains green.
- No real personal records are used in fixtures or CI.

## 9. Implementation sequence

- [ ] Finish provider comparison with current official pricing, security, and region documentation.
- [ ] Write an architecture decision record (provider, schema, access rules, conflict policy).
- [ ] Add a tested local repository interface without changing behavior.
- [ ] Add remote schema and owner isolation policies in a separate PR.
- [ ] Add opt-in sync for a test account and synthetic data only.
- [ ] Add preview/confirm/verify migration flow.
- [ ] Run automated tests and a manual multi-device test before rollout.

## Current decision

**Do not implement remote sync yet.** The next safe deliverable is a provider decision based on actual region/network access and current official pricing/security information. This document records the plan; it does not enable sync or change the deployed app.
