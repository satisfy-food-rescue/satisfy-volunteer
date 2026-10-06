import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/session";
import { googleConfigured, isDemo } from "@/lib/env";
import { postSignInPath, safeNextPath } from "@/lib/auth-shared";
import { ORG } from "@/lib/brand";
import { AuthShell } from "@/components/auth/auth-shell";
import { DemoPersonas } from "@/components/auth/demo-personas";
import { FormNotice } from "@/components/auth/form-notice";
import { GoogleButton } from "@/components/auth/google-button";
import { PasskeySignInButton } from "@/components/auth/passkey-sign-in-button";
import { SignInForm } from "@/components/auth/sign-in-form";

export const metadata: Metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

const ERRORS: Record<string, (email?: string) => string> = {
  google_cancelled: () => "Google sign-in was cancelled.",
  google_failed: () => "Google sign-in did not work just now. Please try again, or use your email and password.",
  google_unavailable: () => "Google sign-in is not available. Use your email and password instead.",
  google_unverified: () => "Google has not verified that email address, so we cannot use it to sign you in. Use your email and password instead.",
  google_unknown: (email) =>
    `We could not find a volunteer account for ${email ?? "that Google account"}. Try the email address you gave Satisfy, or contact the volunteer coordinator.`,
  inactive: () => "This account is no longer active. Contact the volunteer coordinator if that is a mistake.",
};

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string; email?: string }> }) {
  const { next: rawNext, error, email } = await searchParams;
  const next = safeNextPath(rawNext);
  const user = await currentUser();
  if (user) redirect(postSignInPath(user.role, next));
  if (isDemo()) return <DemoPersonas />;

  const google = googleConfigured();
  return (
    <AuthShell
      title="Sign in"
      description={<>For volunteers and coordinators at {ORG.name}.</>}
      footer={
        <>
          First time here?{" "}
          <Link href="/forgot-password?first=1" className="font-semibold text-green-text underline underline-offset-4">
            Set up your password
          </Link>{" "}
          with the email you volunteer with.
        </>
      }
    >
      <div className="flex flex-col gap-5">
        {error && ERRORS[error] && <FormNotice tone="error">{ERRORS[error](email)}</FormNotice>}
        <SignInForm next={next} />
        <div className="flex items-center gap-3 text-sm text-muted-foreground" aria-hidden>
          <span className="h-px flex-1 bg-border" />
          or
          <span className="h-px flex-1 bg-border" />
        </div>
        <div className="flex flex-col gap-3">
          {google && <GoogleButton next={next} />}
          <PasskeySignInButton next={next} />
        </div>
      </div>
    </AuthShell>
  );
}
