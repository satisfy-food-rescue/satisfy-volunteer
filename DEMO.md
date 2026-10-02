# Demo walkthrough (about 12 minutes)

Start with `pnpm dev` and open http://localhost:3000. Have the browser at desktop width for admin and use responsive mode at 375px (or a phone) for the volunteer app. Everything below is seeded relative to today, so the dates you see will match the calendar.

## 1. Coordinator view (Phillipa) - 2 min

Sign in as **Phillipa**.

- Dashboard: point at the four tiles. "Gaps, next 14 days" is the pain point from the discovery call: who is away and what is uncovered.
- Scroll to **Coverage gaps**: two seeded absences (Brian on holiday, Heather off sick) have released their shifts. The line under each gap says exactly why it exists.
- **Training attention** on the right: Tony's Manual Handling is overdue, several others are due within 30 days.
- Click **Roster** in the sidebar: week view with each day's shifts, pink edge on anything short. Flip to **Month** to show the whole picture. Mention **Bulk schedule** (preview before anything is created, regulars land on their weekday).

## 2. The training gate (Tony) - 3 min

Switch persona (sidebar footer icon) and sign in as **Tony Ratana**. Narrow the window to phone width.

- Home: the red banner says one refresher is overdue and route shifts are blocked.
- Tap **Cover** (bottom bar). Route shifts need driver help. The cards are locked: "Complete the Manual Handling refresher to book driver help shifts". Tap **Go to training**.
- Tap **Manual Handling**, scroll the four points, tick the confirmation box, **Confirm and record completion**. The chip flips to Complete with a new expiry 12 months out.
- Back to **Cover**: the lock is gone. Tap **I can cover this**. Tony is now on the shift; the Outbox has his confirmation email.

## 3. Marking away creates a gap, admin covers it - 2 min

Still as Tony:

- Tap **Me**, then **My regular slot and absences** (or Home > Mark me away). Pick next week, reason Holiday. The preview says which of his regular Wednesday route shifts will be released. Submit.
- Switch persona back to **Phillipa**. The dashboard now shows a new gap: "Driver help: Rangiora / Kaiapoi ... Tony Ratana away (holiday)". Click it.
- On the shift page, the **Find cover** panel lists only volunteers who hold the driver help role, are training-current, are not away and are free that day. The **Last-minute available** group is people who opted in to last-minute cover. Click **Add** on one (Steve Kirkwood is the backup driver). The chip flips to Covered.
- For a gap close to the start, the panel also says who already got a last-minute push notification. The seed always has one: a route shift on the next working day that someone called in sick for this morning (Roster, pink edge).
- **Absences** in the sidebar shows the same story as a calendar: bars for who is away, with each released shift marked open or covered.

## 4. Automatic reminders - 1 min

- **Outbox** in the sidebar. Filter by **Training overdue** and open one of Tony's weekly reminders. This is the exact email a volunteer would receive: branded header, plain language, one button.
- Filter by **Last-minute cover** to see a push notification as it would land on a volunteer's phone.
- Optional: **Training > Reminders** tab shows the rule set (30 days before, on the day, weekly while overdue) and a **Run reminder check now** button.

## 5. Applications and the welcome call - 2 min

- **Applications**. Three pending, mocked as arriving from the Infoodle sign-up form. Open Aroha Ngata and click **Approve**: account created, welcome email queued.
- Open **Volunteers > Jess Moorhouse**. The banner says she has not had an initial visit yet, with her number to call. Click **Book initial visit**, pick a new time or the open slot, and book. Jess gets an email and the banner flips to the booked time.
- While "on the call": **Edit details** to update her emergency contact or availability, and **Log a call** in Communication history. The timeline shows the call alongside every email she has been sent.
- Under **Training record**, **Mark complete** asks for the date the stage was done, not just today.

## 6. Filters and shift types - 1 min

- **Training > Modules**: click a count such as "1 overdue" under a module. The **People** tab opens filtered to exactly those volunteers. Filter by module, status, expiry window or name, and sort by any column.
- **Shift types**: names, times, crew sizes, who volunteers work with, and per-type last-minute thresholds. Route shifts push to last-minute volunteers 3 days out and alert the coordinator at 36 hours; the warehouse sort uses 2 days and 1 day.

## 7. Rebrand-ready and Infoodle - 1 min

- **Settings**. First card: the brand colours and fonts from the Brand Guidelines, all theme tokens in one file. Second card: the Infoodle panel with "API: pending confirmation" and what would sync in each direction. Third: the email templates.

## If something looks off

- Dates are relative to today and the database reseeds automatically on a new day. To reset mid-demo: stop the server and run `pnpm db:reset`, then `pnpm dev`.
- Persona switching is just a cookie. If you end up on the wrong surface, go to `/sign-in`.
