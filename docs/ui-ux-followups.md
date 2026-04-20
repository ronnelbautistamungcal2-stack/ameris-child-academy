# UI/UX Follow-ups

Last updated: 2026-04-15

## Current QA Task

- Do end-to-end QA for activity override create/edit/delete flows, especially photos, assessments, and backdated logs.
- Polish validation and UI behavior for admin and teacher progress pages.
- Fix edge cases found during testing and continue any remaining admin module cleanup.

## Verified in this pass

- Activity override forms now block save while photo uploads are in flight and show inline validation for invalid extra JSON and reversed nap time ranges.
- Admin and teacher progress pages now reset stale class/child scope when centers change, clear child-driven lesson filters when appropriate, and keep the teacher page usable before a center is selected.
- Added targeted regression coverage in `tests/e2e/admin-activity-overrides.e2e.spec.js`, `tests/e2e/progress-pages.e2e.spec.js`, and `tests/api/activities.api.spec.js`.
- Verified the new coverage with passing Playwright E2E and API runs, then confirmed the app still passes a production `next build`.
- Dashboard and checklist polish changes compile successfully with `npm run build`.
- Updated Admin, Teacher, and Coach dashboard and milestone checklist routes build cleanly.
- Shared shell copy and mobile drawer changes are in place, including the visible close button and drawer accessibility attributes.
- Center-scoped dashboard flows now use a shared `centerId` sync pattern so linked pages can preserve selected context.

## QA status

- Login-based Playwright coverage is working again for the admin and teacher flows touched in this pass.
- Activity override and progress-page regressions now have dedicated browser coverage instead of relying on manual smoke checks.
- The new activities API coverage exercises admin backdated assessment create/update/delete behavior plus teacher backdating restrictions.

## Remaining follow-up items

- Expand the refreshed E2E pass beyond these routes into the broader Admin, Teacher, and Coach smoke suites.
- Add explicit E2E coverage for `centerId` persistence when navigating from coach KPI cards into messages, follow-ups, and checklist views.
- Validate empty-state copy with seed data that exercises empty centers, no-plan periods, and no-assignment teacher scenarios.
- Complete responsive QA on small mobile widths for the shared shell drawer, long nav labels, and footer wrapping.
- Standardize remaining legacy branding and copy on untouched screens outside the shared shell.

## Notes

- Production build succeeds, but the clean script still reports a non-blocking `EPERM` rename warning for `.next-dev` during cleanup.
