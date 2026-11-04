# Client Requests — 2026-10-29

Source workbook: `New Updated Changes 10-29-26 (2).xlsx` (one sheet, "Ronnel", 185 rows, 31 screenshots).

- **[TRACKER.md](TRACKER.md)** — every row as a checkbox, grouped into work phases. The `Rnn` tag is the workbook row, so it points straight back at the client's wording.
- **`mockups/`** — the screenshots (git-ignored). Files are named `r<row>_<n>.png` after the row the picture is anchored to; a few sit one row above the request they illustrate (e.g. `r077_9` is the All Roles Account Settings picture for R78).

## Priority (highlighted yellow in the workbook)

Rows R4, R5, R6 and R7 are the client's priority. Status (2026-11-04): all four built and checked.

- **R4** Checklist Review time is wrong: the review read the previous day on a server west of UTC (Oct 29 became Oct 28, so the 4:58 pm update was yesterday's). Fixed in `dayKey` and the checklist % date range; "Today" now means the update itself was today.
- **R5** Steps import up to 15 MB: the import route accepts bodies up to 40 MB (checked with a 2.9 MB payload; other routes still stop at 1 MB) and the page checks the 15 MB file limit.
- **R6** Initial Developmental Assessment starts at the child's current age (steps already assessed stay; "Show steps for every age" shows the rest).
- **R7** Step ages read "1 yr 3 mo – 1 yr 8 mo" from a year on.

## Phases

| Phase | Scope |
|---|---|
| **A** | Removals, wording and navigation cleanup (no behavior change) |
| **B** | Bugs the client hit (errors, things not saving or not showing) |
| **C** | Checklists, staff management, training |
| **D** | Calendar |
| **E** | Teacher classroom pages |
| **F** | Parent portal |
| **G** | Student support (assessment, IPP) |
| **H** | Billing |
| **I** | Menus and food reports |
| **J** | Curriculum |
| **K** | Performance charts: click-through drill-downs and layout |
| **L** | Reports: print-friendly, export, new reports |
| **M** | Center management, account settings, kiosk, compliance, dashboards |

## Open questions for the client

1. **R172 Average SOP**: "sent a screen shot in Chat" — we don't have that screenshot. Average SOP shipped in `fe2d8c1`; we need the picture to know what is still missing.
2. **R185 / R186 / R190** "These have not been updated yet" (Student List pages, Account Settings, dashboards other than parent): which mockups do these refer to? We built Account Settings from R78/R79 in this round and the dashboards in `c559b70`.
3. **R31** "only see the team that they are assigned to on any page": we read "team" as the staff whose coach is this coach and the classrooms those staff are assigned to. Confirm.
4. **R109** Staff Performance Report: merged report replaces the separate Teacher/Coach/Staff reports. Confirm the old report links can go.
</content>
</invoke>
