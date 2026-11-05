# Demo walkthrough (about 15 minutes)

Use the demo deployment, or run it locally with `DEMO_MODE=1` in `.env` (see the README for setup) and open http://localhost:3000. Have the browser at desktop width for admin and use responsive mode at 375px (or a phone) for the volunteer app. Everything below is generated relative to today, so the dates you see will match the calendar. Nothing in the demo sends email.

## 1. Coordinator view (Phillipa) - 2 min

Sign in as **Phillipa**.

- **Today**: the coverage board opens the page. This week and next, every shift is a block: green is covered, orange needs cover, today is outlined. This is the pain point from the discovery call, answered at a glance: who is away and what is uncovered. Any block opens its shift.
- Scroll to **Gaps to fill**: two seeded absences (Brian on holiday, Heather off sick) have released their shifts. Each gap says exactly why it exists.
- **Training** on the right: Tony's Manual Handling is overdue, several others are due within 30 days.
- Click **Roster** in the sidebar: week view with each day's shifts, anything short tinted orange with a gap count. Flip to **Month** to show the whole picture. Mention **Bulk schedule** (preview before anything is created, regulars land on their weekday).

## 2. The training gate (Tony) - 3 min

Switch persona (sidebar footer icon) and sign in as **Tony Ratana**. Narrow the window to phone width.

- Home: the red banner says one refresher is overdue and route shifts are blocked.
- Tap **Cover** (bottom bar). Route shifts need driver help. The cards are locked: "Complete the Manual Handling refresher to book driver help shifts". Tap **Go to training**.
- Tap **Manual Handling**. The confirmation box is locked: under it, "Read to the end" and "Open the video" are both unticked. Scroll through the five points (the first ticks), open the two-minute video (the second ticks), then tick the box and **Record completion**. The chip flips to Complete with a new expiry 12 months out.
- Back to **Cover**: the lock is gone. Tap **I can cover this**. Tony is now on the shift; the Outbox has his confirmation email.

## 3. Marking away creates a gap, admin covers it - 2 min

Still as Tony:

- On Home, under his next shift, tap **Can't make one? Mark me away** (or Me, then **My regular slot and absences**). Pick next week, reason Holiday. The preview says which of his regular Wednesday route shifts will be released. Submit.
- Switch persona back to **Phillipa**. The coverage board turns that day orange and **Gaps to fill** shows the new gap: "Driver help: Rangiora / Kaiapoi ... Tony Ratana away (holiday)". Click it.
- On the shift page, the **Find cover** panel lists only volunteers who hold the driver help role, are training-current, are not away and are free that day. The **Last-minute available** group is people who opted in to last-minute cover. Click **Add** on one (Steve Kirkwood is the backup driver). The chip flips to Covered.
- For a gap close to the start, the panel also says who already got a last-minute push notification. The seed always has one: a route shift on the next working day that someone called in sick for this morning (Roster, tinted orange).
- **Absences** in the sidebar shows the same story as a calendar: bars for who is away, with each released shift marked open or covered.

## 4. Automatic reminders - 1 min

- **Outbox** in the sidebar. Filter by **Training overdue** and open one of Tony's weekly reminders. This is the exact email a volunteer would receive: branded header, plain language, one button.
- Filter by **Last-minute cover** to see a push notification as it would land on a volunteer's phone.
- Optional: **Training > Reminders** tab shows the rule set (30 days before, on the day, weekly while overdue) and a **Run reminder check now** button.

## 5. Applications and the welcome call - 2 min

- **Sign up**. Signed out, open **/sign-up** (linked from the persona picker, and **Sign up to volunteer** in the app). Fill it in and send: the applicant sees what happens next, and the application lands in Phillipa's Applications with a confirmation and a coordinator email in the Outbox.
- **Applications**. Three pending, from the website and the app sign-up forms. Open Aroha Ngata and click **Approve**: account created and an invite to set a password emailed (it shows in the Outbox without its link, which is never stored).
- Open **Volunteers > Jess Moorhouse**. The banner says she has not had an initial visit yet, with her number to call. Click **Book initial visit**, pick a new time or the open slot, and book. Jess gets an email and the banner flips to the booked time.
- While "on the call": **Edit details** to update her emergency contact or availability, and **Log a call** in Communication history. The timeline shows the call alongside every email she has been sent.
- Under **Training record**, **Mark complete** asks for the date the stage was done, not just today.

## 6. Filters and shift types - 1 min

- **Training > Modules**: click a count such as "1 overdue" under a module. The **People** tab opens filtered to exactly those volunteers. Filter by module, status, expiry window or name, and sort by any column.
- **Coordinators**: who can use this admin. **Add coordinator** takes a name and email; someone already on the system, such as a regular volunteer, becomes a coordinator and keeps volunteering. **Also volunteers** puts a coordinator in the volunteer lists (it turns on by itself when they book a shift or do training in the volunteer app). Phillipa cannot remove her own access, so there is always a coordinator.
- **Shift types**: names, times, crew sizes, who volunteers work with, and per-type last-minute thresholds. Route shifts push to last-minute volunteers 3 days out and alert the coordinator at 36 hours; the warehouse sort uses 2 days and 1 day. **Add a shift type**, for example "Harvest: schools and corporates", to plan and message a group separately (Announcements, **A shift type**).

## 6b. Induction, sorting stages and policies - 3 min

As **Phillipa**:

- **Induction**: the Ministry of Justice check is needed for warehouse, driver help and driver roles. Margaret's renews within 60 days and Frank's has run out (both have had their emails, in the Outbox). Jess has not sent hers: **Record check** asks for the date on it. The Agreements card shows who has signed what; four volunteers still have to sign the new Confidentiality Agreement.
- **Volunteers > Liz Stratford**: the Induction section, then the Training record with Sorting T1 and T2 done, T3 ready to **Mark complete** and T4 "After Sorting T3". **Training > Modules** shows "After ..." on each stage; **Edit module** has **Comes after**, **Never expires** and **Still in development**.
- **Policies**: each document with how many have read or signed the latest version and who has not. **Publish a new version** asks for a note and can email and notify volunteers.
- **Emails and import**: open any automatic message, change the wording with placeholders, and watch the preview. **Use the standard wording** puts it back.

Switch to **Jess** at phone width: Home says **Start with your induction**. The induction page explains the Ministry of Justice check (with help for anyone without a computer), then the two agreements, signed together. Training stays locked until the induction is done. **Me > Policies** has the Health and Safety Policy to read and confirm,. Anyone in the harvest pool sees Ladders and Sun Safety under Training as coming soon.

## 7. Harvests and announcements - 3 min

As **Phillipa**:

- **Harvests** in the sidebar: pool size, how many have finished harvest training, a published lemon and grapefruit harvest with three pickers, and a rhubarb harvest still in **Draft** (only coordinators see drafts). Open the draft: **Publish** offers to send the callout to the whole harvest pool by email and push notification.
- **Plan a harvest** opens the one-off shift form: what's being picked, where, pickers needed and details for volunteers. **Save as draft** or **Publish and send callout**. The same form (**New shift** on the Roster) adds a one-off sorting morning.
- On a published harvest, **Message crew** opens **Announcements** with that crew picked. Announcements also go to everyone or to chosen roles, with a live recipient count and an email preview.
- **Add** someone to a shift and they get an email and a push notification saying who added them (Outbox, **Added to a shift**).
- **Training > Modules > Edit module**: content and video links are edited here, and **Add a module** creates new ones (ladders, sun safety) as the SOPs arrive.

Switch to **Margaret** at phone width: **Me > Harvest**, **Count me in for harvests**. Her Manual Handling and Slips, Trips and Falls are current, so the harvests open straight away: tap one and **Sign me up**. Jess or Emma would see the two modules to finish first.

## 8. Rebrand-ready and Infoodle - 1 min

- **Settings**. First card: the logo, colours, tints, footer and font from the 2026 brand refresh, all theme tokens in one file. Second card: the Infoodle import, a one-off bring-across of existing volunteers at go-live (no ongoing sync; new volunteers come through the sign-up form). Third: the automatic emails, each with its wording editable here.

## If something looks off

- Dates are relative to today and the demo regenerates its data every new day and on every restart. To reset mid-demo locally, run `pnpm db:seed`; on the demo deployment, restart it in Coolify.
- If you end up on the wrong surface, use Switch persona (Me tab, or the sidebar footer) to get back to the persona picker.
- Production differs in a few places: people sign in with a password, Google, Apple or a passkey; email is really sent (the Outbox shows whether each one was delivered); push notifications go to volunteers' phones, or by email to anyone not using the app.
