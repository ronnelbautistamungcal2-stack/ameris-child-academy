# Tracker — 2026-10-29 requests

`Rnn` = workbook row. Tick items as they ship.

## A. Removals, wording and navigation

- [x] R8 Coach › Checklist Review: remove the Demo Center field
- [x] R20 All roles › My Performance › Checklist: remove the Role field at the top
- [x] R21 Admin › Users › Edit User: remove Department
- [x] R22 Remove the Subscriber role
- [x] R23 Coach & HR › Shift Schedules: remove Parent from the role dropdown
- [x] R25 Coach › Attendance: remove "Total hours worked by each employee…"
- [x] R26 Coach › Attendance: remove Department field
- [x] R30 Coach › Staff Positions: remove "Coaching Team", keep Classroom Assignments
- [x] R32 Coach › Staff Positions: remove assigned/unassigned bubbles
- [x] R33 Coach › Staff Positions: remove View Profile button
- [x] R35 Admin › Staff List › Employment Status: remove Print
- [x] R36 Admin › Calendar: remove Employee Summary
- [x] R37 Admin › Calendar › New Event: remove "Fill in the details…"
- [x] R39 Admin › Calendar: remove "Demo Center - 84…" and the bubble below; keep filters
- [x] R41 / R118 Coach › Staff Performance: remove "View and compare staff…"
- [x] R47 Teacher › My Classroom: remove Attendance Summary
- [x] R51 Teacher › My Classroom: remove Checked in Today
- [x] R52 Teacher › My Classroom: remove "Manage attendance, view the roster…"
- [x] R60 Admin › Policies: remove Common Parent Questions
- [x] R61 Admin › Resources › Add/Edit: remove Add to Home Page
- [x] R63 Coach: remove Other Pages (Compliance, Observations, Follow-ups, Family Permission Policies)
- [x] R64 Coach: Carpool Report moves into Reports
- [x] R65 Teacher: remove Other Pages and the Calendar page
- [x] R66 / R67 Parent: remove Other Pages; Contact Us becomes its own nav item
- [x] R68 Parent › Contact Us: remove the listed wording, Family Overview bubble, Message the Center button
- [x] R69 Admin: remove Other Pages, Affiliates & Partners, Subscriptions
- [x] R70 Admin: Kiosk Setup goes under Center Management
- [x] R76 Admin › Parent Involvement: remove "Post volunteer opportunities…"
- [x] R83 Admin › Compliance Requirements: remove Progress column
- [x] R84 Admin › Compliance: remove Teacher Logging Alerts tab
- [x] R101 Admin › Student Performance: remove "per-child progression, goals…"
- [x] R102 Admin › Class Performance: remove "compare classrooms on…"
- [x] R103 Admin › Class Performance: one set of classroom/date range/print controls
- [x] R107 Admin › Teacher Performance: remove class and age group filters
- [x] R108 Admin › Teacher Performance: remove "Logging compliance…"
- [x] R119 Coach › Reports: remove Coaching Activity
- [x] R125 Admin › Billing: remove room/class filter
- [x] R132 Coach › Parent Fees: remove classroom filter
- [x] R134 Coach › Billing: remove classroom column
- [x] R140 Admin › Lesson Bank: category/age/term as plain text, not bubbles
- [x] R141 Admin › Lesson Bank: remove "Manage early childhood…"
- [x] R142 Admin › Lesson Bank: remove the stat bubbles
- [x] R152 Admin › Student Profile: remove the row of children at the top
- [x] R157 / R160 Training Pathway (admin + coach): remove Description & Details and Reports tabs
- [x] R158 / R161 Training Pathway: remove Applies To / Description / Additional Info on the right
- [x] R188 Parent Dashboard: remove "IPPs need approval" bubble

## B. Bugs

- [x] R4 Checklist Review "last updated" time is in the wrong time zone
- [x] R5 Steps of Progression Bank import: allow 15 MB
- [x] R11 Staff Checklist Details: View Daily Log errors
- [x] R12 Staff Checklist Details: teacher's mark complete/incomplete not reflected
- [x] R43 / R44 / R45 Daily Log: photos don't show when viewing the log (teacher + coach)
- [x] R62 Teacher › Policies & Procedures sends to the dashboard
- [x] R71 / R73 Parent Involvement: child dropdown lists the whole center
- [x] R72 / R74 Parent Involvement: sign up / log errors "only parents can log involvement"
- [x] R75 HR › Parent Involvement says Coming Soon
- [x] R80 Parent › Forms: uploaded PDF errors when opened
- [x] R82 Compliance: check-off keeps the completed row and adds a new row for the next due date
- [x] R144 Bell red dot should appear as soon as a message arrives
- [x] R145 / R146 / R147 Messages: send to one selected role; sender doesn't see it in their other roles
- [x] R151 Admin › Edit Child: uploaded photo doesn't show
- [x] R153 Parent › Child Profile: list at top shows every student
- [x] R57 Parent › View Profile: shows whole class, editable; remove names at the top
- [x] R164 Training pathway PDF attachment won't open

## C. Checklists, staff management, training

- [x] R9 Checklist Review: no grade on days the center is closed
- [x] R10 Checklist Review role dropdown: add Kitchen, remove Coach
- [x] R17 My Checklist: a coach/admin with several roles sees only that role's checklist
- [x] R18 Checklist Manager › Create: Role field; checklist shows only for that role
- [x] R19 Checklist tasks linking to the kitchen menu can't be signed off until the link is opened
- [x] R24 Coach › Attendance: date range at the top
- [x] R27 Coach › Employee Time audit report & time sheet print portrait
- [x] R28 HR › Staff Attendance: add Kitchen, HR, Student Support to roles dropdown
- [x] R29 Admin: Staff Positions page after Staff List
- [x] R31 Coach: only see their assigned team on every page
- [x] R34 Admin › Staff List: Birthdate and Date of Hire columns
- [x] R42 Coach › Staff Performance: all columns in view
- [x] R154 / R155 Coach › View Training: center name, date range on report; date range filter
- [x] R162 Record Training: optional searchable Training Pathway; counts toward pathway %
- [x] R163 Create Evaluation: Citations and Commendations fields; shown on staff performance reports
- [x] R165 Observation/training request goes to the assigned coach only, as a Request, not to admin
- [x] R166 Training acknowledgment records the date

## D. Calendar

- [x] R38 New Event: Apply to Roles checkboxes (mockup `r038_22`)
- [x] R40 Coach calendar same view as Admin

## E. Teacher classroom

- [x] R46 My Classroom: Red Flagged Children above Class Roster
- [x] R48 My Classroom: student name goes to the Student Performance Report
- [x] R49 Individual student: log-type bubbles filter the list, with View All
- [x] R50 Class Roster as a table (mockup `r050_24`)
- [x] R139 IPP request sends a Request to Student Support and the coach
- [x] R171 Student Performance Report: only the teacher's class
- [x] R173 Class Performance Report: no class list; only the teacher's class

## F. Parent

- [x] R53 Activity log: date separators
- [x] R54 Activity log: collapsible (drop down) section
- [x] R55 Activity log: notes shown inline
- [x] R56 Photos section with date range, multi-select download
- [x] R187 Dashboard: sign children in/out button
- [x] R189 Dashboard: new messages bubble

## G. Student support

- [x] R6 Initial Developmental Assessment starts at the child's current age
- [x] R7 Step age ranges shown as years + months
- [x] R137 IPP: searchable student dropdown, no classroom suffix
- [x] R138 IPP: Close Plan button

## H. Billing

- [x] R58 Classroom Budget › Edit: every field editable
- [x] R126 Add Charge: parent search
- [x] R127 Add Charge: Charge Type (Tuition, Supplies, Other)
- [x] R128 Parent invoices all shown, month filter
- [x] R129 View recorded payments
- [x] R130 / R136 Print Invoice portrait (admin + parent)
- [x] R131 Edit / delete a charge
- [x] R133 Coach billing lists only Supplies charges
- [x] R135 Coach billing: no edit/delete

## I. Menus and food reports

- [x] R85 Infant Feeding Report: Bottle Offered from Kitchen Infant Portions
- [x] R86 Infant Feeding Report: infants only, type-to-search
- [x] R87 Kitchen menus: one Copy button per age group next to "Actually Served"
- [x] R88 Admin menus: copy Planned menu from another age group
- [x] R89 Admin menus: editable component titles
- [x] R90 Admin menus: Clear Week
- [x] R91 Meal Claim: Export to Excel
- [x] R92 / R93 Meal Claim: sticky child columns and sticky date/meal header
- [x] R94 Meal Claim: classroom filter
- [x] R95 Meal Claim: sortable first/last name, DOB, classroom
- [x] R96 Meal Production Record: only open days
- [x] R97 Meal Production Record: sticky headings

## J. Curriculum

- [x] R143 Categories: rename categories / subjects / age ranges / types

## K. Performance charts

- [x] R14 / R182 Center Performance: click a chart bar → students logged → their log description
- [x] R15 / R183 Center Performance: student name → Student Performance Report
- [x] R16 Center Performance: center switcher
- [x] R168 Student Performance Report: click a course correction / character highlight → teacher's description
- [x] R169 Student Performance Report: fix IPP panel layout
- [x] R174 / R177 Class Performance Report: click a bar / milestone segment → students
- [x] R175 Class Performance Report: horizontal chart labels readable
- [x] R176 Class Performance Report: activity log as a per-child count grid (mockup `r176_30`)
- [x] R178 Teacher › My Performance: citizenship + milestones look like Class Performance
- [x] R179 Coach › My Performance: same, like Center Performance, scoped to the coach's team
- [x] R180 HR / Other Staff / Kitchen › My Performance: no citizenship/milestones
- [x] R181 Student Support › My Performance: combined, like Center Performance student section
- [ ] R172 Average SOP on Student Performance Report (waiting on the screenshot)

## L. Reports

- [x] R98 Student Performance: type-to-search child
- [x] R100 Student Performance: class/age filters narrow the child list
- [x] R99 / R104 / R105 / R106 / R117 Print-friendly reports: report only, center name centered on top
- [x] R110 Milestones Progress Report prints portrait
- [x] R109 Teacher Performance → "Staff Performance Report", any staff member
- [x] R111 / R123 Center Performance Overview report (date range, print); Overview = it, # children, # staff bubbles
- [x] R112 Staff Performance Overview report (date range, print)
- [x] R113 Student Time Sheets report (all/enrolled, print all, PDF/Excel)
- [x] R114 Student Time Overview report
- [x] R115 Staff Time Sheets report (all/current, print all, PDF/Excel)
- [x] R116 Staff Time Overview report
- [x] R120 / R121 / R122 Admin reports match the coach versions
- [x] R124 Export every admin/coach report to Excel or PDF
- [x] R156 Staff Training report (date range, staff search, print/export, all staff)
- [x] R167 Milestone change log report (date range, child, portrait)
- [x] R170 IPP print: portrait, no duplicates, center name

## M. Center, settings, kiosk, compliance, dashboards

- [x] R77 Delete center asks for the password twice
- [x] R78 / R79 Account Settings layout (mockups `r077_9`, `r079_25`)
- [x] R81 Compliance requirement: "Don't repeat" option
- [x] R184 Kiosk: click an enrolled kiosk to open it at the top
- [ ] R185 / R186 / R190 "Not updated yet" — see open question 2
</content>

## Notes on how items were done

- R4 / R12: the Checklist Review read the day before on servers west of UTC; fixed in `dayKey` (src/lib/checklistReview.js).
- R43 / R80 / R151 / R164 (and probably R62): uploads saved after the last build weren't served in production; `/uploads/:name` now falls back to `src/pages/api/v1/uploaded-files/[name].js`.
- R57 / R153 / R145-R147 / R171 / R173: access checks used every role a person holds; they now follow the signed-in role (`signedInAs` in src/lib/roles.js, `participantRoleWhere` for messages).
- R71-R76 were already reworked in 543af77 (after the version the client tested).
- R185: coach Student List now uses the admin Student List (src/components/children/StudentListWorkspace.js). R186: Account Settings rebuilt to the r077 / r079 mockups. R190 still needs the client to say which dashboards.
- Account Preferences (language, date format, time zone) are kept in the browser only; they don't change how dates show yet.
- Center delete needs the admin's password twice (server-checked); the API test helper sends the demo admin password.
