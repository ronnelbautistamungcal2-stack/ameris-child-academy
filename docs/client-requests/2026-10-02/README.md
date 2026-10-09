# Client Requests — 2026-10-02

Source workbook: `Website Changes Sorted by Type - New 10-2-26 (2).xlsx` (41 sheets, 203 unique mockup images).

- **[TRACKER.md](TRACKER.md)** — every request as a checkbox, grouped by sheet → page, tagged with its phase and linked to its mockups. Tick items off as they ship.
- **`mockups/`** — the workbook's images, one folder per sheet (git-ignored, ~95 MB). File names are `<n>-<anchor cell>-<mockup title>`, so the cell ref in the tracker points at the picture next to it. Tiny annotation icons (arrows, dots) are extracted but not linked from the tracker.

Regenerate the mockups on a fresh checkout:

```bash
python -I scripts/extract-client-mockups.py "<path to workbook>.xlsx" docs/client-requests/2026-10-02/mockups
```

## Client ground rules (Navigation sheet)

- Navigation labels come from the Navigation sheet, **not** from the text in the mockups.
- Slight color/font differences in mockups are noise — use our existing colors and fonts.
- Icons are our choice.
- Ignore the logo in mockups; use the original Ameris logo.

## Phases

| Phase | Scope | Sheets |
|---|---|---|
| **P0** | Setup: mockups extracted, tracker built | — |
| **P1** | 1st priority: Steps of Progression "prior step" / "next step" fields; Age dropdowns 0–12 yrs / 1–12 mo | Navigation, Curriculum |
| **P2** | Foundation: 3 new roles (Kitchen, HR, Student Support), per-role nav config, blue sidebar + light-blue background, shared dashboard bubble colors, shared calendar legend, page removals | Navigation, Dashboards, Calendar |
| **P3** | Users, PINs & kiosk: middle initial, PIN / reset PIN / view PIN, kiosk screens, child + staff time sheets with audit reports, auto checkout | Kiosk, Users, Account Settings, Student List, Staff List-Time Management |
| **P4** | Center setup & menus: add/edit center tabs, selected meals drive menus, per-meal menu pages, copy/import, kitchen "copy planned", infant feeding plan | Center Management, Menu |
| **P5** | Curriculum, progress tracking & performance reports: lesson calendar/planner/bank, goal progression, milestone calculation, individual progress plans (IPP), student/class/center performance | Curriculum, SOP Tracking, IPP, Student/Class/Center Performance |
| **P6** | Staff management & checklists | Checklist Manager/Review, Checklists, Time off, Shift Schedules, Staff Attendance/Positions/Performance, Evaluations, Training |
| **P7** | Page-by-page polish | Billing, Messages, Daily Log, Supply List, Classroom Budget, Parent Involvement, Forms, Resources, Policies, Character Guide, Reports, etc. |

## Open questions for the client

1. **Kiosk** (Kiosk `A3`): do they need a separate app? Our recommendation: no. A locked-down web kiosk page writes straight to the same time sheets, so nothing has to sync.
2. **Moving a teacher mid-day** (Checklists `A7`): splitting required checklist items by the hours in each classroom is feasible but adds real work. Is it in scope for this round?
3. **Menu import** (Menu `B37`): the client writes "not sure how import will work yet". Is copying from an existing menu enough for now?
4. **Autofilling state licensing (CCL) forms** (Forms & Renewals `B6`): this works if the state's PDFs are fillable forms; scanned forms are unreliable. Need a sample.
5. **Billing `B66`**: "Can you make so that the monthly tuition charges auto…" is cut off. Does it mean posting tuition automatically each month?
6. **Classroom Budget `B12`**: "Only Jadmin can add a budget". Is that a typo for Admin, or a specific account?
7. **Admin menus** have no Dinner tab on the Navigation sheet, but Kitchen and Parent do. Should Admin get one?
8. **Parent dashboard `B13`**: "Do we want to change the picture?" Change it to what?
