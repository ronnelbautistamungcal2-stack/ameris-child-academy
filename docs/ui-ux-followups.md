# UI/UX Follow-ups

Last updated: 2026-03-25

## Verified in this pass

- Dashboard and checklist polish changes compile successfully with `npm run build`.
- Updated Admin, Teacher, and Coach dashboard and milestone checklist routes build cleanly.
- Shared shell copy and mobile drawer changes are in place, including the visible close button and drawer accessibility attributes.
- Center-scoped dashboard flows now use a shared `centerId` sync pattern so linked pages can preserve selected context.

## QA blocker

- Playwright E2E coverage is currently blocked at login before role-specific dashboard assertions run.
- Existing failures time out in `tests/helpers/e2e.js` while waiting to leave `/login` after submitting demo credentials.
- Failure artifacts in `test-results/*/error-context.md` show the page still on the login screen with the submit button in a `Signing in...` state.
- Next step: validate local demo credentials, seed state, and NextAuth session/callback behavior before using E2E results for dashboard regression coverage.

## Remaining follow-up items

- Re-run Admin, Teacher, and Coach E2E smoke tests after the login/auth issue is fixed.
- Add explicit E2E coverage for `centerId` persistence when navigating from coach KPI cards into messages, follow-ups, and checklist views.
- Validate empty-state copy with seed data that exercises empty centers, no-plan periods, and no-assignment teacher scenarios.
- Complete responsive QA on small mobile widths for the shared shell drawer, long nav labels, and footer wrapping.
- Standardize remaining legacy branding and copy on untouched screens outside the shared shell.

## Notes

- Production build succeeds, but the clean script still reports a non-blocking `EPERM` rename warning for `.next-dev` during cleanup.
