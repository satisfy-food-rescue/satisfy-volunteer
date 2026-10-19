import type { Metadata } from "next";
import { ORG } from "@/lib/brand";
import { LegalLink, LegalList, LegalPage, Term } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Terms of use",
  description: `The terms for using the ${ORG.name} volunteer website and app.`,
};

// Change this whenever the substance of the terms changes.
const UPDATED = "19 October 2026";

export default function TermsPage() {
  const contact = <LegalLink href={`mailto:${ORG.coordinatorEmail}`}>{ORG.coordinatorEmail}</LegalLink>;
  return (
    <LegalPage
      eyebrow="Ngā tikanga · Terms"
      title="Terms of use"
      updated={UPDATED}
      intro={
        <p>
          The ground rules for using the {ORG.shortName} Volunteers website and app. By signing in you agree to them. They are short
          and, we hope, unsurprising.
        </p>
      }
      sections={[
        {
          id: "about",
          title: "About these terms",
          body: (
            <p>
              These terms cover the {ORG.shortName} Volunteers website and app, run by {ORG.name} in {ORG.base}. They do not
              replace what you have agreed with {ORG.shortName} about volunteering itself, such as your volunteer agreement and the
              induction and health and safety guidance you are given. If anything here differs from those, those come first.
            </p>
          ),
        },
        {
          id: "who-can-use-it",
          title: "Who can use it",
          body: (
            <p>
              The website and app are for people {ORG.shortName} has accepted as volunteers or coordinators. {ORG.shortName} sets up
              each account, from an approved application or an invitation from a coordinator. There is no public sign-up.
            </p>
          ),
        },
        {
          id: "your-account",
          title: "Your account",
          body: (
            <LegalList>
              <li>Your account is for you alone. Do not share your password, passkeys or sign-in links.</li>
              <li>Keep your details up to date, especially your phone number and emergency contact.</li>
              <li>
                If you think someone else has used your account, sign out your other devices in Sign-in and security and tell us at{" "}
                {contact}.
              </li>
            </LegalList>
          ),
        },
        {
          id: "shifts",
          title: "Booking shifts",
          body: (
            <LegalList>
              <li>
                <Term>A booking is a promise.</Term> Coordinators plan each day around who has booked, so book the shifts you mean to
                do.
              </li>
              <li>
                <Term>Let us know early.</Term> If you cannot make a shift, cancel it or mark yourself away as soon as you know, so
                someone else can cover it.
              </li>
              <li>
                <Term>Training comes first.</Term> Some roles need training before you can book them. The website and app show what
                you need.
              </li>
              <li>
                <Term>Plans change.</Term> Coordinators may change or cancel shifts, for example when a pickup falls through, and will
                let you know.
              </li>
            </LegalList>
          ),
        },
        {
          id: "fair-use",
          title: "Using it fairly",
          body: (
            <>
              <p>Please do not:</p>
              <LegalList>
                <li>use information about other volunteers, donors or recipients for anything other than volunteering with us;</li>
                <li>try to reach parts of the website or app that are not meant for you, or test or get around its security;</li>
                <li>interfere with how the website or app works, or use it for anything unlawful.</li>
              </LegalList>
            </>
          ),
        },
        {
          id: "messages",
          title: "Emails and notifications",
          body: (
            <p>
              We send you emails and, if you use the app, notifications about your shifts, training and account. They are part of how
              volunteering works, so you cannot turn them all off, but requests for last-minute cover only come if you have said yes to
              them in your profile. You can turn app notifications off in your phone&apos;s settings.
            </p>
          ),
        },
        {
          id: "availability",
          title: "Keeping it running",
          body: (
            <p>
              The website and app are free for our volunteers. We work to keep them running and accurate, but cannot promise they will
              always be available or free of mistakes, and we may change, add or remove features. If something looks wrong, such as a
              shift time, check with a coordinator.
            </p>
          ),
        },
        {
          id: "ending",
          title: "Ending your access",
          body: (
            <p>
              You can stop using the website and app at any time and ask us to close your account. {ORG.shortName} may close an
              account when someone stops volunteering, or if these terms are not followed. Closing an account signs it out
              everywhere.
            </p>
          ),
        },
        {
          id: "responsibility",
          title: "Our responsibility",
          body: (
            <p>
              As far as the law allows, {ORG.name} is not responsible for any loss that comes from using the website or app, or from
              not being able to use them. Nothing in these terms takes away rights you have under New Zealand law that cannot be
              taken away.
            </p>
          ),
        },
        {
          id: "privacy",
          title: "Your privacy",
          body: (
            <p>
              Our <LegalLink href="/privacy">privacy policy</LegalLink> explains what we collect about you and how we look after it.
            </p>
          ),
        },
        {
          id: "changes",
          title: "Changes to these terms",
          body: (
            <p>
              We may update these terms as the website and app change. We will update the date at the top, and tell volunteers by
              email about any significant change. New Zealand law applies to these terms.
            </p>
          ),
        },
        {
          id: "contact",
          title: "Contact us",
          body: <p>For any question about these terms, email {contact}.</p>,
        },
      ]}
    />
  );
}
