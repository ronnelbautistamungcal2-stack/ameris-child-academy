# Feature Matrix (Spec vs Current App)

Legend:
- ✅ Wired: UI page exists and calls a working API route
- 🟡 Partial: UI exists but is placeholder/limited, or API coverage is incomplete
- ⛔ Blocked: missing UI and/or missing API (needs backend work)

## Admin

- ✅ Users & RBAC: `/admin/users` → `/api/v1/users`
- ✅ Centers: `/admin/centers` → `/api/v1/centers`
- ✅ Classrooms: `/admin/classes` → `/api/v1/classes`
- ✅ Students (Children): `/admin/children` → `/api/v1/children`
- ✅ Lesson plans: `/admin/lessons` → `/api/v1/lessons`
- ✅ Checklists: `/admin/checklists` → `/api/v1/checklists`, `/api/v1/child-tasks`
- ✅ Activity overrides (backdating): `/admin/activity-overrides` → `/api/v1/activities`
- ✅ Subscriptions (manual status/tier): `/admin/subscriptions` → `/api/v1/subscriptions`
- ✅ Policies publish (URLs + roles): `/admin/policies` → `/api/v1/policies`
- ✅ Forms templates: `/admin/forms` → `/api/v1/forms/templates`
- 🟡 Reporting & analytics (query builder, charts, teacher grading): UI not implemented; basic counts only via `/api/v1/metrics/me`
- ⛔ Staff management (evaluations, PTO, time-off calendar, budgets): missing UI + APIs
- ⛔ Data import (Excel/PDF conversion), export/transfer history: only basic `/api/v1/upload` exists; conversion/export missing
- ⛔ Push notifications preferences + missed-compliance alerts: missing push infrastructure + APIs

## Teacher

- ✅ Teacher home: `/teacher` (RBAC gated)
- ✅ Assigned children: `/teacher/children` → `/api/v1/children` (filtered by assignment)
- ✅ Daily activity logging (no backdating): `/teacher/logs` → `/api/v1/activities` (API rejects backdating for non-admin)
- ✅ Lesson plans access: `/teacher/lessons` → `/api/v1/lessons`
- ✅ Checklists: `/teacher/checklists` → `/api/v1/checklists`, `/api/v1/child-tasks`
- ✅ Policies view: `/teacher/policies` → `/api/v1/policies`
- 🟡 Performance metrics/training/reports: `/teacher/metrics` → `/api/v1/metrics/me` (basic only)
- ⛔ Training media library / professional development tracking: missing APIs + richer UI

## Parent

- ✅ My children: `/parent/children` → `/api/v1/children` (parent-owned)
- ✅ Progress/goals: `/parent/progress` → `/api/v1/progress` (read-only)
- ✅ Messaging (threads + send): `/parent/messages` → `/api/v1/messages/*`
- ✅ Online forms submit: `/parent/forms` → `/api/v1/forms/*` (templates created in `/admin/forms`)
- ✅ Policies handbook: `/parent/policies` → `/api/v1/policies`
- 🟡 Billing: `/parent/billing` (placeholder; no payment integration yet)

## Coach

- ✅ Compliance summary: `/coach/compliance` → `/api/v1/compliance/summary`
- ✅ Policies handbook: `/coach/policies` → `/api/v1/policies`
- 🟡 Checklists: `/coach/checklists` (limited; depends on existing checklist APIs)
- ⛔ Training materials + staff progression tracking: `/coach/training` placeholder; missing APIs
- ⛔ Coach reports: `/coach/reports` placeholder; missing APIs

## Subscriber (External daycare)

- 🟡 Subscriber portal: `/subscriber` (shows subscription info via centers + subscription)
- 🟡 Tiered feature enable/disable: basic “active subscription required” gate exists in `/api/v1/children`; full tier matrix missing
- ⛔ Auto-payment + auto-suspension on failure: missing payment provider integration + APIs

## Shared / System-level

- ✅ Login + NextAuth session role: `/login`, `/api/v1/auth/[...nextauth]`
- ✅ Role-based routing: role-gated layouts + API role checks across `/api/v1/*`
- 🟡 Dashboard: `/dashboard` role-based nav + child-centric widgets (continues to evolve)
- ⛔ Real-time notifications (push) & full realtime messaging: socket present, but end-to-end push workflows missing
- ⛔ Mobile apps (Android/iOS): out of scope for this repo currently

