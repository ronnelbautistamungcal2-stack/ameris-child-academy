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
| B | Child limit per center (one number, every center) | **done 2026-11-10** (see below) |
| C | Lesson and step **Type** multi-select (three fixed options) | **done 2026-11-10** (see below) |
| D | Character Guide **Import** for Teacher Training subscribers | nothing |
| E | Banks move to the Global admin; subscriber Lesson Calendar (own start day and closed days, view-only lessons, live updates, filtered by the account's type and age groups) | **done 2026-11-10** (see below) |
| F | Customer Support tickets with Request / Grant / End center access (ends on End Access) | **done 2026-11-10** (see below) |
| G | Quote → enrollment → Stripe payment → embedded DocuSign → Pending → Activate | question 6 (accounts, keys, prices) |

## Step A — add-on locks (done 2026-11-07)

- Whole pages: `src/lib/addOns.js` (by route). HR and Other Staff get Staff Management on every page except Dashboard, Messages and My Performance (whose tabs lock themselves), read from the sheet's "All Full Pages are locked" row.
- My Performance tabs: Evaluations = Staff Management, Professional Development and Training = Teacher Training. The My Performance tab is Staff Management for Teacher, Kitchen, HR and Other Staff; for Admin, Coach and Student Support its staff sections need Staff Management and its student section Steps of Progression.
- Sections: Student Performance Report Active Goals and Milestones, Class Performance Milestones Grade, Center Performance Overview (Teacher chart and Staff overview = Staff Management; Student chart and the Milestones column = Steps of Progression), the Average SOP % column, the teacher checklist's lesson plan (Curriculum), and the dashboard bubbles "Staff Members Signed In" (admin) and "Pending Time Off Requests" (coach).
- Reports hub: Milestone Progress, Child Steps and Milestone Change Log = Steps of Progression; Staff Performance Overview / Report and all four Time Sheets reports = Staff Management; Staff Training = Teacher Training.
- Locks are on screen only. The APIs still return the data to anyone who asks for it directly; blocking them server-side is a follow-up.

## Step B — child limit per center (done 2026-11-10)

- The account's "# of Children" is now a limit for each center: adding a child counts only that center's children (`assertChildLimit` in `src/lib/subscriberAccounts.js`). The error names the center.
- Admin > Subscription shows one "Children at {center}: N of max" row per center; the Global admin labels say "allowed per center" and the detail lists each center's count.

## Step C — curriculum types (done 2026-11-10)

- Lessons and steps have `types` (one or more of Non-Denominational, Non-Denominational Christian, Other). The old single free-text `type` is kept in the database but no longer shown; the migration copied its values across where they named one of the three types. Existing lessons otherwise start with no type, so Ameris needs to tick them. The migration gives the Ameris account (C-1001) all three types.
- Lesson Bank create/edit and the Steps of Progression Bank editor use checkboxes. The steps import's Type column takes a comma list; "Standard" and "Faith Based" are read as the two types.
- The Global admin picks the subscriber's Curriculum Types on Add Subscriber and Edit Subscription; changes go to the account notes.
- The Type list under Curriculum > Categories is gone (the three types are fixed).
- Not yet used for filtering: the subscriber Lesson Calendar (step E) will show only lessons of the account's types.

## Step E — Ameris curriculum for subscribers (done 2026-11-10)

- **Where the curriculum lives:** one center is the Ameris curriculum center (the migration picked the C-1001 center with the most lessons; in dev that's Demo Center). Its Lesson Bank, Lesson Planner and Steps of Progression Bank are the Ameris banks. Each of its classrooms is one **age group** with its own planner.
- **Global admin > Lesson Bank & SOP Bank** (new nav item): shows the curriculum center and its age groups, can move the curriculum to another center, and has Open buttons for the Lesson Bank, Lesson Planner, Steps of Progression Bank and Categories. Those open the existing editors in the Admin portal on the curriculum center (the global admin needs the Admin role too). Global admins can always reach the curriculum center.
- **Subscriber's account:** Global admin > Subscribers > Edit Subscription (and Add Subscriber) has **Curriculum Age Groups** checkboxes next to Curriculum Types. Changes go to the account notes.
- **Subscriber's Lesson Calendar:** the subscriber still sets their own start day and closed days. A **Follows Age Group** picker chooses which of the account's age groups each classroom follows (with one age group it's automatic). Each day shows that age group's planned lessons, **only lessons of the account's curriculum types**; clicking one opens it view-only (description, supplies, the protected lesson file). Ameris edits show right away; nothing is copied.
- **Teacher's weekly plan** shows the same Ameris lessons and categories for a subscriber classroom.
- **Initial Developmental Assessment and Progression Tracking** use the Ameris steps of the account's types.
- **Subscribers don't get the banks:** the Lesson Planner, Lesson Bank, Categories and Steps bank tabs are hidden and those pages show "Provided by Ameris Solutions".
- Centers in the account that owns the curriculum center (C-1001 Ameris Academy) keep working as before.
- Migration `20261110120000_curriculum_source`.

**Guesses to confirm with the client:**
- Lessons and steps with **no type ticked are hidden** from subscribers. Ameris needs to tick types on its existing lessons and steps first, or subscribers will see empty calendars.
- An age group is a classroom of the curriculum center (e.g. "Toddlers"), not a separate list.
- Free-text planner cells (no bank lesson attached) are shown to every subscriber, whatever their types.
- Hiding the bank pages is on screen only; their APIs aren't blocked for subscribers yet (same as the add-on locks).
- Reports that read steps (milestone reports, child steps) still use the child's own center; moving them to the Ameris steps is a follow-up.

## Step F — Customer Support and center access (done 2026-11-10)

- **Subscriber side:** Admin > Customer Support (bottom of the admin nav, no add-on needed). The admin opens a ticket (subject, description, optional center), replies, closes or reopens it. A reply on a closed ticket reopens it. When Ameris asks for access, a banner shows and the ticket has **Grant Access** / **Decline**; once granted, **End Access**.
- **Ameris side:** Global admin > Customer Support. Queue with Open / In Progress / Closed counts, search, and a "Centers With Access" count. Ameris replies (an Open ticket moves to In Progress), sets the status, opens tickets for a subscriber, picks one of the subscriber's centers for **Request Center Access** (with an optional reason), and can **Withdraw Request** or **End Access**.
- **What access does:** while a grant is on, every Ameris global admin who also has the Admin role sees that center in their Admin portal center list and can open its pages, people included. It ends only when someone clicks End Access. Closing the ticket does not end it (client answer 4).
- Every step (request, grant, decline, end, status change) is written into the ticket's conversation, and the other side gets an in-app notification that links to the ticket.
- Tickets are numbered T-1001 upwards. Tables: `SupportTicket`, `SupportTicketMessage`, `SupportAccessGrant` (migration `20261110090000_support_tickets`).

**Guesses to confirm with the client:**
- Access is given to the whole Ameris support team (every global admin), not only the person who asked.
- A global admin reaches the center through the Admin portal (switch role to Admin, pick the center). There's no separate "view as subscriber" screen.
- Some older routes check the account directly rather than the center list, so a few pages may still refuse a granted center. Fix as found.
- No email is sent, only in-app notifications.
