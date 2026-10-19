// The words of the sign-up form, shared so the website (/sign-up) and the
// native app say the same thing. The rules are the server's
// (src/lib/applications.ts at the repo root).

export const SIGN_UP_INTRO =
  "Help rescue good food for people across Waimakariri, Hurunui and Christchurch City. Tell us a bit about yourself and our volunteer coordinator will be in touch.";

export const SIGN_UP_HINT = {
  email: "We will send your sign-in invite here.",
  interests: "Choose as many as you like. You can change this later.",
  availability: "For example, Tuesday and Thursday mornings.",
  emergency: "Someone we can call if anything happens while you are volunteering.",
  message: "How you heard about us, or anything we should know.",
} as const;

/** Around a link to the privacy policy. */
export const SIGN_UP_PRIVACY = { before: "I have read the", link: "privacy policy", after: "and am happy for Satisfy to keep these details to arrange my volunteering." } as const;

export type SignUpStep = { key: "read" | "invite" | "call" | "book"; title: string; body: string };

/** What happens after signing up, shown on the thank-you screen. */
export function signUpSteps(email: string): SignUpStep[] {
  return [
    { key: "read", title: "We read your application", body: `Our volunteer coordinator looks at every application. We have emailed a confirmation to ${email}.` },
    { key: "invite", title: "You get your sign-in invite", body: "Once you are approved, we email you a link to set up your account in the Satisfy volunteer app." },
    { key: "call", title: "We give you a call", body: "To say hello and book your initial visit to the warehouse, where you meet the team and get shown around." },
    { key: "book", title: "You book your first shift", body: "After your initial visit you can book shifts and choose a regular slot in the app." },
  ];
}

export const SIGN_UP_THANKS = "We have your application and will be in touch soon. Here is what happens next.";
