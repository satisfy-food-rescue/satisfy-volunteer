# Demo walkthrough (about 10 minutes)

Start with `pnpm dev` and open http://localhost:3000. Have the browser at desktop width for admin and use responsive mode at 375px (or a phone) for the volunteer app. Everything below is seeded relative to today, so the dates you see will match the calendar.

## 1. Coordinator view (Philippa) - 2 min

Sign in as **Philippa**.

- Dashboard: point at the four tiles. "Gaps, next 14 days" is the pain point from the discovery call: who is away and what is uncovered.
- Scroll to **Coverage gaps**: two seeded absences (Brian on holiday, Heather off sick) have released their shifts. The line under each gap says exactly why it exists.
- **Training attention** on the right: Tony's Manual Handling is overdue, several others are due within 30 days.
- Click **Roster** in the sidebar: week view with each day's shifts, magenta edge on anything short. Flip to **Month** to show the whole picture. Mention **Bulk schedule** (preview before anything is created, regulars land on their weekday).

## 2. The training gate (Tony) - 3 min

Switch persona (sidebar footer icon) and sign in as **Tony Ratana**. Narrow the window to phone width.

- Home: the red banner says one refresher is overdue and route shifts are blocked.
- Tap **Cover** (bottom bar). Tomorrow's Christchurch North route needs a driver's assistant. The card is locked: "Complete the Manual Handling refresher to book driver's assistant shifts". Tap **Go to training**.
- Tap **Manual Handling**, scroll the four points, tick the confirmation box, **Confirm and record completion**. The chip flips to Complete with a new expiry 12 months out.
- Back to **Cover**: the lock is gone. Tap **I can cover this**. Tony is now on the shift; the Outbox has his confirmation email.

## 3. Marking away creates a gap, admin covers it - 2 min

Still as Tony:

- Tap **Me**, then **My regular slot and absences** (or Home > Mark me away). Pick next week, reason Holiday. The preview says which of his regular Wednesday route shifts will be released. Submit.
- Switch persona back to **Philippa**. The dashboard now shows a new gap: "Driver's assistant: Rangiora / Kaiapoi ... Tony Ratana away (holiday)". Click it.
- On the shift page, the **Find cover** panel lists only volunteers who hold the driver's assistant role, are training-current, are not away and are free that day. The **Last-minute available** group is people who opted in to be phoned. Click **Add** on one (Steve Kirkwood is the backup driver). The chip flips to Covered.
- **Absences** in the sidebar shows the same story as a calendar: bars for who is away, with each released shift marked open or covered.

## 4. Automatic reminders - 1 min

- **Outbox** in the sidebar. Filter by **Training overdue** and open one of Tony's weekly reminders. This is the exact email a volunteer would receive: branded header, plain language, one button.
- Optional: **Training > Reminders** tab shows the rule set (30 days before, on the day, weekly while overdue) and a **Run reminder check now** button.

## 5. Applications from the Infoodle form - 1 min

- **Applications**. Three pending, mocked as arriving from the Infoodle sign-up form. Open Aroha Ngata and click **Approve**. The note under the buttons says what happens: account created, induction booked, welcome email queued. Check **Recently reviewed** and the Outbox if there is time.

## 6. Rebrand-ready and Infoodle - 1 min

- **Settings**. First card: every colour and font is a theme token in one file, ready for the brand refresh. Second card: the Infoodle panel with "API: pending confirmation" and what would sync in each direction. Third: the email templates.

## If something looks off

- Dates are relative to today and the database reseeds automatically on a new day. To reset mid-demo: stop the server and run `pnpm db:reset`, then `pnpm dev`.
- Persona switching is just a cookie. If you end up on the wrong surface, go to `/sign-in`.
