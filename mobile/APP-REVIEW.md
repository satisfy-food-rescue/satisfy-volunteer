# App Review: answering Apple's Guideline 2.1 request

Apple paused the first iOS submission (build 8, 22 Oct 2026) under Guideline 2.1 "Information Needed". It is not a rejection for a bug: they want a screen recording, a description and a reviewer account before they test. This file holds the text to paste back, the notes for App Store Connect, the recording script and the gaps to close before resubmitting. Keep it current for the next submission: Apple asks for the same information every time.

Facts the answers rely on (checked 31 Oct 2026):

- The store build talks to production, `https://volunteer.satisfyfoodrescue.org.nz` (`EXPO_PUBLIC_API_URL` in the EAS `production` environment). There is no demo deployment, so the reviewer needs a real volunteer account on production, not a persona.
- Production offers password and Google sign-in. Apple and passkeys are off because `APPLE_*` and `APPLE_TEAM_ID` are not set (see "Before resubmitting").
- The app has a sign-up form ("Sign up to volunteer"), which sends an application a coordinator approves, and Me > Delete my account, which deletes the account at once (added for this resubmission).

## Before resubmitting

Do these first. The reply text below assumes they are done.

1. **Ship a build with account deletion.** The reviewer's message says it plainly: account deletion is required in apps that support account creation, and Apple treats the in-app sign-up form as account creation (Guideline 5.1.1(v)). Me > Delete my account does it at once: signed out everywhere, off the roster, personal details removed, the coordinator emailed. Build 8 predates it, so the resubmitted build must be made from `main` after it merged.
2. **Offer Sign in with Apple wherever Google is offered** (Guideline 4.8). Build 8 predates the Sign in with Apple work, and production reports `apple: false`. Either set `APPLE_TEAM_ID`, `APPLE_SERVICES_ID`, `APPLE_KEY_ID` and `APPLE_PRIVATE_KEY` on production (DEPLOY.md, step 5) and ship a build from current `main`, or turn Google off. Do not resubmit a build that shows Google without Apple.
3. **Create the reviewer's account on production.** Admin > Volunteers > Add volunteer, a name like "App Reviewer", an email you control, roles Sorting and Driver help so Shifts, Cover and Training all have content, then set its password from the invite. Make sure there are upcoming published shifts with space, at least one gap for Cover, and an online module it can complete. Put the email and password in App Store Connect under App Review Information > Sign-in required. Never put them in this repo.
4. **Record the demo on a real iPhone on the latest iOS**, not the simulator (script below). Upload it to a place Apple can open without signing in (an unlisted YouTube link or an iCloud or Drive share link works) and paste the link into the reply and the notes.
5. **Check who owns the App Store Connect account.** If it is not Satisfy Food Rescue's own account, have a short letter from Satisfy authorising Awhina Tech to publish the app on its behalf ready to attach: Apple asks for this under Guideline 5.2.1 when the developer and the organisation differ.
6. Build and submit from current `main` (`pnpm release` in `mobile/`), then reply in App Store Connect.

## Screen recording script

One take, portrait, sound off, about three minutes. Start from the home screen so the launch is on the recording.

1. Tap the Satisfy icon. Splash, then the sign-in screen.
2. Tap "Sign up to volunteer". Fill the first step with obviously fake details, scroll to show the steps, then go back without sending (say in the notes that sending creates an application for a coordinator, not an account).
3. Back on sign-in, enter the reviewer account's email and password and sign in. Allow notifications when asked.
4. Home: today's date, the next shift, the alert card, the roster. Pull to refresh.
5. Shifts: open an upcoming shift, tap "Book this shift", show the confirmation and the badge change, open it again and tap "Cancel my booking".
6. Cover: open a shift that needs cover and tap "I can cover this".
7. Training: open an online module, scroll to the end, open the link or video, confirm it, show it marked Complete with the next due date.
8. Me: My roles, "My regular slot and absences" (Mark me away: pick dates and save, then remove it), Harvest, the short-notice cover switch, Sign-in and security, the privacy policy link.
9. Me > Delete my account (the last item, under the legal links): the sheet explains what happens, tap "Delete my account", confirm "Delete" in the alert, and show that the app returns to sign-in. Do this on a throwaway account you created for the purpose, not the reviewer's.
10. Stop recording.

## Reply to paste into App Store Connect

Replace the parts in square brackets.

---

Thank you for the review. Here is the information requested. It has also been added to the Notes field under App Review Information.

**1. Screen recording**

[link]. It was recorded on an iPhone [model] running iOS [version], starting from launching the app. It shows signing up (the form that sends a volunteer application), signing in, booking and cancelling a shift, covering a shift that needs help, completing a training module, marking an absence, the sign-in and security settings, and deleting the account.

The app has no paid content, in-app purchases, subscriptions or advertising. It has no user-generated content visible to other users: the only text a volunteer enters (their profile, a sign-up message, an absence note, a request to change roles) is seen by the charity's coordinators, never by other volunteers, so there is no content to report or block.

**2. Purpose and audience**

Satisfy Volunteers is the volunteer app for Satisfy Food Rescue, a registered New Zealand charity based in Rangiora, North Canterbury. Satisfy collects surplus food from supermarkets, growers and producers and redistributes it to community organisations across Waimakariri, Hurunui and Christchurch. Its work is done by volunteers who sort and pack food in the warehouse, drive collection and delivery routes, and harvest donated produce.

The app is for those volunteers, and for anyone in the region who wants to join them. Until now the roster was run through spreadsheets, group emails and phone calls, so volunteers could not see which shifts were coming up, where help was needed or whether their training was current. The app shows each volunteer their upcoming shifts, lets them book and cancel, shows shifts that need cover, lets them complete online training modules and see when a refresher is due, lets them mark themselves away so their regular shift is released for someone else, and sends reminders and short-notice cover requests as push notifications. The coordinator tools live on the charity's website; the app is the volunteer side only. It is free, with no monetisation.

**3. Setting up and using the app**

A demo volunteer account is in App Review Information (Sign-in required). Sign in with that email and password on the sign-in screen. Google and Apple sign-in are also offered, but they only sign in people who already have an account; the demo account uses a password.

- Home shows today, the next shift and anything that needs attention.
- Shifts lists the volunteer's upcoming shifts and shifts they can book. Open one and tap "Book this shift"; open a booked one and tap "Cancel my booking".
- Cover lists shifts short of people. Open one and tap "I can cover this".
- Training lists the volunteer's modules. Open an online module, read to the end, open its links, then confirm. In-person modules are marked complete by a coordinator.
- Me holds the volunteer's roles, "My regular slot and absences" (including Mark me away), Harvest (the harvest pool), the short-notice cover setting, Sign-in and security (passkeys, connected accounts) and Delete my account.

Account creation: "Sign up to volunteer" on the sign-in screen sends an application to Satisfy's volunteer coordinator. Accounts are created when the coordinator approves the application, because every volunteer is met in person and inducted before their first shift. Any email address can be entered, and nothing further happens unless Satisfy approves it, so the reviewer can submit the form with test details.

Account deletion: Me > Delete my account, at the bottom of the Me tab. The sheet explains what happens and asks for confirmation. Deletion is immediate: the volunteer is signed out on every device, taken off the roster, and their name, contact details, emergency contact and notes are removed. The charity keeps only an anonymous record of the shifts and training completed, which no longer identifies the person.

**4. External services**

- Our own server (Next.js and PostgreSQL in Docker, deployed with Coolify on a server we operate) at volunteer.satisfyfoodrescue.org.nz, for all data and sign-in. We do not use a backend-as-a-service.
- Resend, for transactional email (invites, password resets, reminders).
- Expo: EAS Build for building the app, EAS Update for delivering our own JavaScript updates to this build, and the Expo push service, which relays our notifications to APNs.
- Sign in with Apple and Google Sign-In (OAuth, authorisation code flow), as optional sign-in methods for people who already have an account.
- No analytics, advertising, payment or AI services.

**5. Regional differences**

There are none. Satisfy Food Rescue operates only in Canterbury, New Zealand, and the app is only useful to its volunteers, but it behaves identically in every region. Dates and times are shown in New Zealand time. The interface is in English with a few Māori greetings (Kia ora, Ngā mihi), which is normal usage in New Zealand.

**6. Regulated industry and third-party material**

Food rescue is not a regulated industry and the app handles no payments, health records or similar data. The app contains no third-party protected material: the Satisfy Food Rescue name, logo and photographs belong to the charity, which has authorised this app. [If the account is not the charity's: A letter from Satisfy Food Rescue authorising Awhina Tech to publish on its behalf is attached.]

If the reviewer would prefer, we are happy to answer further questions or arrange a call.

---

## Notes for App Review Information

Shorter version for the Notes field. Keep it under the field's limit and update the credentials line every time they change.

---

Satisfy Volunteers is the volunteer app for Satisfy Food Rescue, a registered charity in Rangiora, New Zealand, that collects surplus food and redistributes it to community organisations. Volunteers use it to see and book shifts, cover shifts that need help, complete training, mark themselves away and get reminders by push notification. The coordinator side is on the charity's website. Free, no purchases, no ads, no user content visible to other users.

Demo account (a real volunteer account on our production server): see Sign-in required above. Sign in with email and password. Google and Apple sign-in only work for existing accounts.

"Sign up to volunteer" sends an application to the charity; it does not create an account. Accounts are created when the coordinator approves the application, because volunteers are inducted in person. Account deletion: Me > Delete my account (bottom of the Me tab), immediate.

Services: our own server (volunteer.satisfyfoodrescue.org.nz), Resend (email), Expo (build, updates, push relay to APNs), Sign in with Apple, Google Sign-In. No analytics, payment or AI services. Same behaviour in every region; times are New Zealand time.

Screen recording: [link]

---
