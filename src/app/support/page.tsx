import type { Metadata } from "next";
import { ORG } from "@/lib/brand";
import { LegalLink, LegalList, LegalPage, Term } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Support",
  description: `Help with the ${ORG.name} volunteer website and app: signing in, updating your details and reporting a problem.`,
};

/** A mailto link to the volunteer coordinators, with a subject when it helps them sort the email. */
function Email({ subject }: { subject?: string }) {
  const query = subject ? `?subject=${encodeURIComponent(subject)}` : "";
  return <LegalLink href={`mailto:${ORG.coordinatorEmail}${query}`}>{ORG.coordinatorEmail}</LegalLink>;
}

// The page the app stores link to as the support URL, so it must make sense to
// someone who has never signed in.
export default function SupportPage() {
  return (
    <LegalPage
      eyebrow="Āwhina · Help"
      title="Support"
      intro={
        <p>
          Help with the {ORG.shortName} Volunteers website and app. If you cannot find what you need here, email our volunteer
          coordinators at <Email /> and we will get back to you.
        </p>
      }
      sections={[
        {
          id: "who-its-for",
          title: "Who the app is for",
          body: (
            <>
              <p>
                The website and the {ORG.shortName} Volunteers app are for people volunteering with {ORG.name} in {ORG.coverage}.
                You use them to book shifts, keep your training up to date and keep your details current.
              </p>
              <p>
                Would you like to volunteer? <LegalLink href="/sign-up">Sign up to volunteer</LegalLink> here or in the app. Signing up
                sends an application to our volunteer coordinator, and once it is approved we email you a link to set up your account.
              </p>
            </>
          ),
        },
        {
          id: "signing-in",
          title: "Help signing in",
          body: (
            <>
              <LegalList>
                <li>
                  <Term>First time.</Term> <LegalLink href="/forgot-password?first=1">Set up your password</LegalLink> with the
                  email address you volunteer with, and we will email you a link to choose one.
                </li>
                <li>
                  <Term>Forgotten password.</Term> Use <LegalLink href="/forgot-password">Forgot your password?</LegalLink> and we
                  will email you a link to choose a new one. The link works once and expires, so ask for another if it has stopped
                  working.
                </li>
                <li>
                  <Term>No email arrived.</Term> Check your junk or spam folder, and that you used the email address you gave{" "}
                  {ORG.shortName}. The same applies to Continue with Google: it only works with that address.
                </li>
              </LegalList>
              <p>
                Still stuck, or told your account is no longer active? Email <Email subject="Help signing in" /> and a coordinator
                will sort it out.
              </p>
            </>
          ),
        },
        {
          id: "your-details",
          title: "Updating or deleting your details",
          body: (
            <>
              <p>
                Once signed in, you can change your phone number, suburb, emergency contact and availability in{" "}
                <LegalLink href="/app/profile">your profile</LegalLink>, and manage passkeys, Google and your signed-in devices in{" "}
                <LegalLink href="/app/security">Sign-in and security</LegalLink>. In the app, both are under Me.
              </p>
              <p>
                To change your name or email address, or to ask us to delete the information we hold about you, email{" "}
                <Email subject="My details" />. Our <LegalLink href="/privacy">privacy policy</LegalLink> explains what we keep and
                why.
              </p>
            </>
          ),
        },
        {
          id: "report-a-problem",
          title: "Reporting a problem",
          body: (
            <>
              <p>
                If something in the website or app is not working, email <Email subject="Problem with the volunteer app" />. It
                helps us fix it faster if you tell us:
              </p>
              <LegalList>
                <li>what you were trying to do and what happened instead;</li>
                <li>whether you were using the app or the website, and on which phone, tablet or computer;</li>
                <li>a screenshot, if you can take one.</li>
              </LegalList>
            </>
          ),
        },
        {
          id: "contact",
          title: "Contact us",
          body: (
            <p>
              For anything else about volunteering, your shifts or the website and app, email our volunteer coordinators at{" "}
              <Email />. {ORG.name} is based in {ORG.base}.
            </p>
          ),
        },
      ]}
    />
  );
}
