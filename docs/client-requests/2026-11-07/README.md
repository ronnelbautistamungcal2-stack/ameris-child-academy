# Client answers — 2026-11-07 (subscriptions and curriculum)

Answers to the 14 questions we sent on 2026-11-07. The client numbered their
reply 1–10 in their own order. The sheet they refer to is
`Pages and Sections to Grey out based on Add ons.xlsx` (Google Drive >
website development > Ameris Solutions home pages; local copy in Downloads).

## What they said

| # | Topic | Answer |
|---|---|---|
| 1 | Payments | Stripe. |
| 2 | Contract | DocuSign, but the subscriber signs the agreement inside our website (embedded signing). |
| 3 | Lesson types | Lessons get a multi-select **Type**: Non-Denominational, Non-Denominational Christian, Other. A lesson can have several types. A subscriber sees the lessons of the type(s) they pay for. The Steps of Progression bank gets the same Type field. |
| 4 | Lesson Calendar | Each subscriber sets their own start day and closed days and sees their whole calendar. They can open a lesson on their planner (description, supplies, view-only file). They can't add or swap lessons. |
| 5 | Lesson updates | Subscribers see changes to Ameris lessons right away (no copies). |
| 6 | Support access | Global admin's Customer Support ticket page gets a **Request Center Access** button. The subscriber grants it; when the problem is solved, access ends. |
| 7 | Child limit | Per center, not per account. |
| 8 | Average SOP columns | Without Staff Management, the whole Staff Management area is greyed out (Average SOP included). With Staff Management but without Steps of Progression, only the Average SOP column is greyed out. |
| 9 | Rows with nothing marked | "Staff members signed in" (admin dashboard) and Time Sheets reports belong to Staff Management. |
| 10 | Character Guide | Not locked. When a subscriber buys Teacher Training, Ameris asks whether they want the Ameris Character Guide; an **Import** button copies it into theirs. |

## Still unanswered from our list

- Home Daycare programs: their own lesson set, or the same lessons grouped differently?
- One center or several: implied yes by "child limit per center"; not confirmed in words.
- Reports: developmental age, Excelling never counting, removing the old staff report links (R109), the staff overall grade weights, Red Flag rule.
- 10-29 list: R185 / R186 / R190 screens, R31 "team".

## New questions their answers raise

1. **Type "Other"**: is "Other" a third fixed option, or can Ameris type its own type names?
2. **Which type a subscriber gets**: set by Global admin on the account (one or several types)? Is "Standard" = Non-Denominational and "Faith Based" = Non-Denominational Christian?
3. **Which planner a classroom follows**: curriculum is sold per classroom per age group. Does each subscriber classroom pick an age group, and does its calendar follow the Ameris planner for that age group?
4. **Support access**: does access end when the ticket is closed, after a time limit (e.g. 24 hours), or when either side clicks "End access"?
5. **Child limit**: one number on the account that applies to each center, or a different limit per center?
6. **Stripe and DocuSign**: we need their Stripe account (test keys first), a DocuSign developer account with an integration key, and the agreement document/template. Also the prices: per add-on, per classroom, per child range.

## Answers to the follow-up questions (2026-11-07)

1. **Type "Other"**: a fixed third option (Non-Denominational, Non-Denominational Christian, Other).
2. **Type per account**: set by the Global admin on the subscriber's account. "Standard" = Non-Denominational; "Faith Based" = Non-Denominational Christian.
3. **Planner per classroom**: each subscriber follows the curriculum for the age group(s) they subscribe to.
4. **Support access**: ends when someone clicks **End Access** (no time limit, not tied to closing the ticket).
5. **Child limit**: one number on the account that applies to every center.
6. Stripe / DocuSign accounts, keys and prices: not answered yet.

## Build plan

| Step | What | Waits on |
|---|---|---|
| A | Add-on locks from the sheet (pages and sections), with answers 8 and 9 | **done 2026-11-07** (see below) |
| B | Child limit per center (one number, every center) | ready |
| C | Lesson and step **Type** multi-select (three fixed options) | ready |
| D | Character Guide **Import** for Teacher Training subscribers | nothing |
| E | Banks move to the Global admin; subscriber Lesson Calendar (own start day and closed days, view-only lessons, live updates, filtered by the account's type and age groups) | ready |
| F | Customer Support tickets with Request / Grant / End center access (ends on End Access) | ready |
| G | Quote → enrollment → Stripe payment → embedded DocuSign → Pending → Activate | question 6 (accounts, keys, prices) |

## Step A — add-on locks (done 2026-11-07)

- Whole pages: `src/lib/addOns.js` (by route). HR and Other Staff get Staff Management on every page except Dashboard, Messages and My Performance (whose tabs lock themselves), read from the sheet's "All Full Pages are locked" row.
- My Performance tabs: Evaluations = Staff Management, Professional Development and Training = Teacher Training. The My Performance tab is Staff Management for Teacher, Kitchen, HR and Other Staff; for Admin, Coach and Student Support its staff sections need Staff Management and its student section Steps of Progression.
- Sections: Student Performance Report Active Goals and Milestones, Class Performance Milestones Grade, Center Performance Overview (Teacher chart and Staff overview = Staff Management; Student chart and the Milestones column = Steps of Progression), the Average SOP % column, the teacher checklist's lesson plan (Curriculum), and the dashboard bubbles "Staff Members Signed In" (admin) and "Pending Time Off Requests" (coach).
- Reports hub: Milestone Progress, Child Steps and Milestone Change Log = Steps of Progression; Staff Performance Overview / Report and all four Time Sheets reports = Staff Management; Staff Training = Teacher Training.
- Locks are on screen only. The APIs still return the data to anyone who asks for it directly; blocking them server-side is a follow-up.
