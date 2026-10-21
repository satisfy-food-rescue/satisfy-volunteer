import type { Metadata } from "next";
import { ORG } from "@/lib/brand";
import { LegalEmail, LegalLink, LegalList, LegalPage, Term } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: `How ${ORG.name} collects, uses and looks after the personal information in the volunteer website and app.`,
};

// Change this whenever the substance of the policy changes.
const UPDATED = "20 October 2026";

export default function PrivacyPage() {
  const contact = <LegalEmail address={ORG.coordinatorEmail} subject="Privacy request" />;
  return (
    <LegalPage
      eyebrow="Tō tūmataitinga · Your privacy"
      title="Privacy policy"
      updated={UPDATED}
      intro={
        <p>
          What the {ORG.shortName} Volunteers website and app collect about you, why, and how we look after it. We use your details to
          roster shifts, keep training up to date and look after you on the day. We never sell them or use them for advertising.
        </p>
      }
      sections={[
        {
          id: "who-we-are",
          title: "Who we are",
          body: (
            <p>
              The website and the {ORG.shortName} Volunteers app are run by {ORG.name}, based in {ORG.base}, for our volunteers and
              volunteer coordinators. We are responsible for the personal information you give us here and handle it in line with
              the New Zealand Privacy Act 2020.
            </p>
          ),
        },
        {
          id: "what-we-collect",
          title: "What we collect",
          body: (
            <>
              <p>Only what we need to run volunteering safely:</p>
              <LegalList>
                <li>
                  <Term>Your application.</Term> When you sign up to volunteer: your name, email address, phone number, suburb, year
                  of birth if you give it, the roles you are interested in, your availability, your emergency contact&apos;s name and
                  phone number, and anything else you tell us in the sign-up form.
                </li>
                <li>
                  <Term>Your profile.</Term> Your phone number, suburb, emergency contact&apos;s name and phone number, a note about
                  your availability, whether you are happy to be asked for last-minute cover, your roles and your regular slot.
                </li>
                <li>
                  <Term>Your volunteering.</Term> The shifts you book, cancel and attend, the training you have done and the sessions
                  you sign up for, and the times you mark yourself away, with the reason you choose (holiday, sick or other) and any
                  note you add.
                </li>
                <li>
                  <Term>Coordinator notes.</Term> Notes coordinators write and a record of contact with you, such as phone calls and
                  changes to your profile, roles or account.
                </li>
                <li>
                  <Term>Messages.</Term> A copy of the emails and app notifications we send you, and whether they were delivered.
                </li>
                <li>
                  <Term>Signing in.</Term> How you sign in (see below), when you last signed in, and for each signed-in device the
                  browser or phone it is. If you use the app and allow notifications, your phone&apos;s notification address and name.
                </li>
              </LegalList>
              <p>
                We do not use analytics, advertising or tracking cookies. The only cookies keep you signed in and complete a sign-in
                with Google, Apple or a passkey.
              </p>
            </>
          ),
        },
        {
          id: "signing-in",
          title: "How you sign in",
          body: (
            <>
              <LegalList>
                <li>
                  <Term>Password.</Term> We store only a one-way hash of your password, never the password itself, so nobody at{" "}
                  {ORG.shortName} can see it.
                </li>
                <li>
                  <Term>Google.</Term> If you choose “Continue with Google”, Google tells us your email address, whether Google has
                  verified it, and an identifier for your Google account. We use these only to match you to the volunteer account{" "}
                  {ORG.shortName} has already set up for you: Google sign-in never creates an account. We do not receive your Google
                  password and ask for no access to your Gmail, contacts, calendar or anything else in your Google account. Google&apos;s
                  own <LegalLink href="https://policies.google.com/privacy">privacy policy</LegalLink> also applies.
                </li>
                <li>
                  <Term>Apple.</Term> If you choose “Continue with Apple”, Apple tells us an identifier for your Apple Account and,
                  unless you choose to hide it, your email address. We use these only to match you to the volunteer account{" "}
                  {ORG.shortName} has already set up for you: Apple sign-in never creates an account. If you hide your email, Apple
                  gives us a relay address instead, which we keep only to show that Apple is connected. We do not ask for your name
                  or receive your Apple Account password. Apple&apos;s own{" "}
                  <LegalLink href="https://www.apple.com/legal/privacy/">privacy policy</LegalLink> also applies.
                </li>
                <li>
                  <Term>Passkeys.</Term> We store the public half of the passkey and the name you give it. The private half never
                  leaves your device, and a passkey gives us no access to anything else on it.
                </li>
                <li>
                  <Term>Sign-in links.</Term> Invite and password reset links work once and expire. We keep only a fingerprint of each
                  link, never the link itself.
                </li>
              </LegalList>
              <p>In Sign-in and security you can remove a passkey, disconnect Google or Apple and sign out your other devices.</p>
            </>
          ),
        },
        {
          id: "how-we-use-it",
          title: "How we use it",
          body: (
            <>
              <p>We use your information to:</p>
              <LegalList>
                <li>set up and protect your account and keep you signed in;</li>
                <li>roster you onto shifts and keep track of who is covering each one;</li>
                <li>
                  contact you about your shifts, training and account, including reminders and, if you have said yes to it, requests
                  for last-minute cover;
                </li>
                <li>make sure you have the training each role needs before you book it;</li>
                <li>reach your emergency contact if something happens to you while volunteering;</li>
                <li>report on our volunteering in totals that do not name you, and meet our legal and health and safety duties.</li>
              </LegalList>
            </>
          ),
        },
        {
          id: "who-sees-it",
          title: "Who sees it",
          body: (
            <>
              <p>
                {ORG.shortName}&apos;s volunteer coordinators see your profile, history and notes so they can roster and look after
                volunteers. Other volunteers cannot see your details. We also use a few services that handle information for us:
              </p>
              <LegalList>
                <li>
                  <Term>Infoodle</Term>, our supporter database, where we keep supporters&apos; contact details.
                </li>
                <li>
                  <Term>Resend</Term>, which delivers our emails.
                </li>
                <li>
                  <Term>Expo</Term>, which delivers app notifications through Apple&apos;s and Google&apos;s notification services.
                </li>
                <li>
                  <Term>Google</Term>, if you sign in with Google.
                </li>
                <li>
                  <Term>Apple</Term>, if you sign in with Apple.
                </li>
                <li>
                  <Term>Our hosting provider</Term>, which runs the server and database the website and app use.
                </li>
              </LegalList>
              <p>
                Some of these services store or process information outside New Zealand. We share only what each one needs to do its
                job, and otherwise disclose personal information only when the law requires or allows it, for example to deal with a
                serious threat to someone&apos;s safety.
              </p>
            </>
          ),
        },
        {
          id: "how-long",
          title: "How long we keep it",
          body: (
            <p>
              We keep your information while you volunteer with us and afterwards only as long as we need it for our legal, safety and
              reporting duties. A browser is signed out after 30 days without use, and after 180 days at most; the app after 180 days without use. When you stop
              volunteering a coordinator closes your account, which signs you out everywhere. You can ask us to delete your
              information at any time; we may need to keep some records where the law requires it.
            </p>
          ),
        },
        {
          id: "keeping-it-safe",
          title: "Keeping it safe",
          body: (
            <p>
              Only you and authorised coordinators can see your information. Everything is sent over encrypted connections, sign-in is
              limited to stop password guessing, and coordinators&apos; access is checked on every page. No system is perfectly
              secure, but we take reasonable steps to protect your information and review them as the service changes.
            </p>
          ),
        },
        {
          id: "your-rights",
          title: "Your rights",
          body: (
            <p>
              You can ask to see the information we hold about you and ask us to correct it. You can update most of it yourself in{" "}
              <LegalLink href="/app/profile">your profile</LegalLink> and{" "}
              <LegalLink href="/app/security">Sign-in and security</LegalLink>. For anything else, including deleting your
              information, email {contact}. If you are not happy with how we have handled your information, you can complain to the{" "}
              <LegalLink href="https://www.privacy.org.nz">Office of the Privacy Commissioner</LegalLink>.
            </p>
          ),
        },
        {
          id: "changes",
          title: "Changes to this policy",
          body: (
            <p>
              We may update this policy as the website and app change. We will update the date at the top, and tell volunteers by
              email about any significant change.
            </p>
          ),
        },
        {
          id: "contact",
          title: "Contact us",
          body: <p>For any question or request about your privacy, email {contact}.</p>,
        },
      ]}
    />
  );
}
