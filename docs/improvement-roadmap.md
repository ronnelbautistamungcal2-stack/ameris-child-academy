# Improvement Roadmap

Last updated: 2026-03-26

This backlog is based on the current codebase, not the older top-level README. The app already has a broad admin/teacher/parent/coach surface, so the best next work is to close partial flows, harden the platform, and finish the features that are already visible in the UI.

## Recommended Next 5

### 1. Fix login + E2E auth regression

- Priority: P0
- Why it matters: Playwright smoke coverage is blocked at sign-in, which makes every UI change riskier.
- Main areas:
  - `tests/helpers/e2e.js`
  - `src/pages/api/v1/auth/[...nextauth].js`
  - `prisma/seed.js`
- Done when:
  - Demo admin, teacher, coach, and parent accounts can sign in reliably.
  - Role-based dashboard smoke tests pass.
  - `centerId` persistence flows can be re-tested.

### 2. Add request validation and consistent API errors

- Priority: P0
- Why it matters: the app now has many write endpoints, and malformed payloads will become harder to control as usage grows.
- Main areas:
  - Shared validator helper in `src/lib/`
  - `src/pages/api/v1/*` write routes
- Done when:
  - Every POST/PUT/PATCH route validates input.
  - Validation failures return a consistent `400` response shape.
  - Frontend forms can display field-level errors without guesswork.

### 3. Finish coach reporting backend

- Priority: P1
- Why it matters: `/coach/reports` is already exposed in the app but still acts like a placeholder.
- Main areas:
  - `src/pages/coach/reports.js`
  - `src/pages/api/v1/coach/*`
  - `src/pages/api/v1/analytics/*`
- Done when:
  - Coaches can filter by center, teacher, and date range.
  - Trend views exist for observations, follow-ups, compliance, and teacher growth.
  - Exportable coach summaries are available.

### 4. Expand teacher metrics into a real performance workspace

- Priority: P1
- Why it matters: `/teacher/metrics` currently exposes only lightweight counts even though the app already tracks richer operational data.
- Main areas:
  - `src/pages/teacher/metrics.js`
  - `src/pages/api/v1/metrics/me.js`
  - `src/pages/api/v1/training-logs/*`
  - `src/pages/api/v1/evaluations/*`
- Done when:
  - Teachers can see logging consistency, attendance, progress outcomes, training completion, and evaluation history.
  - The page can be used during coaching and review cycles.

### 5. Build a real subscription tier matrix

- Priority: P1
- Why it matters: subscription gating exists, but feature access is still mostly binary.
- Main areas:
  - `src/pages/admin/subscriptions.js`
  - `src/pages/api/v1/subscriptions/*`
  - shared role/feature gate helpers
- Done when:
  - Each plan controls feature flags such as analytics, messaging, forms, exports, and notifications.
  - Subscriber and admin UIs clearly show what is enabled.

## Product Backlog

### Platform Stability

#### 6. Expand automated test coverage

- Priority: P0
- Add API tests for critical writes: activities, progress, checklists, messages, subscriptions, notifications, and forms.
- Add smoke coverage for each role dashboard and 2-3 critical end-to-end paths per role.

#### 7. Seed richer demo data

- Priority: P0
- Add realistic centers, classrooms, teachers, parents, children, subscriptions, notifications, forms, and archived progress records.
- Make empty states and analytics screens easier to validate locally.

#### 8. Standardize audit logging

- Priority: P1
- Track admin edits for subscriptions, policy publishing, form template changes, archive/export actions, and child transfers.
- Add a searchable admin audit page later.

#### 9. Harden file uploads

- Priority: P1
- Add MIME allowlists, virus-scan hook points, image/document previews, and attachment ownership rules.
- Connect uploads to lessons, activities, progress entries, and forms instead of leaving them mostly detached.

#### 10. Improve rate limiting coverage

- Priority: P1
- Extend the existing limiter beyond auth/public contact into sensitive write endpoints.
- Add per-user and per-IP controls for sign-in, message send, uploads, exports, and public signup/contact routes.

### Coach and Staff Operations

#### 11. Build coach training center

- Priority: P1
- Replace the placeholder `src/pages/coach/training.js` flow with training library, required modules, due dates, and completion tracking.
- Reuse `training-logs` APIs where possible.

#### 12. Complete staff evaluations

- Priority: P1
- Finish review cycles, acknowledgment flow, score history, and follow-up action plans.
- Connect evaluations to coach dashboards and teacher metrics.

#### 13. Finish PTO, shifts, and staffing calendar workflows

- Priority: P1
- Strengthen `time-off`, `shifts`, and staff attendance into one staffing operations flow.
- Add approval states, conflict warnings, classroom coverage gaps, and exportable schedules.

#### 14. Add classroom budgets with approval workflow

- Priority: P2
- The budget APIs exist; add spending thresholds, receipt attachment, approval status, and monthly summaries.

### Family Experience

#### 15. Implement payment provider integration

- Priority: P1
- Turn `parent/billing` from placeholder into a real billing portal with invoices, payment methods, renewals, and failed-payment handling.
- Candidate scope: Stripe subscriptions, receipts, and dunning webhooks.

#### 16. Add push notifications

- Priority: P1
- The notification bell and real-time socket layer already exist; add web push/mobile push infrastructure for urgent events.
- Target events: new message, incident note, form renewal, compliance alert, payment failure, pickup reminder.

#### 17. Improve family messaging

- Priority: P2
- Add attachments, read receipts, unread filters, archive/mute controls, and message templates for teachers/admins.

#### 18. Add parent self-service onboarding

- Priority: P2
- Extend invite/signup flow so parents can finish profile setup, add permissions, accept policies, and complete first-day forms without staff intervention.

### Curriculum, Reporting, and Data

#### 19. Finish advanced analytics

- Priority: P1
- Extend overview, child report, teacher performance, and query APIs with saved filters, scheduled reports, and comparative center benchmarks.
- Add export to CSV/PDF from report pages.

#### 20. Add coach-to-admin executive summaries

- Priority: P2
- Build monthly or quarterly summary packets for center health, staff performance, compliance risk, and child progress trends.

#### 21. Strengthen behavior plan workflows

- Priority: P1
- Add reminders, review cadence, intervention outcome tracking, and auto-generated follow-up tasks from behavior goals.

#### 22. Deepen progression and remediation

- Priority: P1
- Expand `progress/[id]/entries`, remediation generation, and milestone checklist flows into a fuller intervention system.
- Add catch-up plan templates and teacher recommendations.

#### 23. Complete import/export and transfer records

- Priority: P1
- Finish Excel import validation, export bundles, transfer history, and archive restore workflows.
- Add admin-friendly import preview, row errors, and rollback behavior.

#### 24. Add scheduled jobs infrastructure

- Priority: P2
- Centralize recurring jobs for compliance scans, form renewals, archive tasks, report generation, and notification digests.
- Add job history and failure alerts for admins.

### UX and Admin Productivity

#### 25. Finish responsive QA and empty-state polish

- Priority: P0
- Complete the follow-ups already documented in `docs/ui-ux-followups.md`.
- Focus on mobile drawer behavior, small-width layouts, long labels, and realistic no-data states.

#### 26. Add a command palette / quick actions

- Priority: P2
- Improve speed for admins, coaches, and teachers with shortcuts for "log activity", "open child", "create follow-up", "send message", and "switch center".

#### 27. Create an admin operations center

- Priority: P2
- One page for alerts, failed imports, inactive subscriptions, overdue forms, staff coverage gaps, and unresolved follow-ups.

## Suggested Build Order

1. Fix auth regression and restore reliable E2E coverage.
2. Add request validation, consistent errors, and richer seed data.
3. Finish coach reports and teacher metrics.
4. Implement subscription feature flags and payment integration.
5. Add push notifications and scheduled jobs.
6. Expand analytics, exports, and executive reporting.

## Best High-ROI Sprint

If only one short sprint is available, the highest return set is:

1. Auth/E2E fix
2. Validation across write APIs
3. Coach reports backend
4. Teacher metrics expansion
5. Push notifications for messages and compliance alerts
