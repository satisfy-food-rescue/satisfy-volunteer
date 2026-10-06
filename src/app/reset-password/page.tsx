import type { Metadata } from "next";
import Link from "next/link";
import { findUsableToken } from "@/lib/auth";
import { AuthShell } from "@/components/auth/auth-shell";
import { FormNotice } from "@/components/auth/form-notice";
import { LinkRequestForm } from "@/components/auth/link-request-form";
import { SetPasswordForm } from "@/components/auth/set-password-form";

export const metadata: Metadata = { title: "Choose a password", referrer: "no-referrer" };
export const dynamic = "force-dynamic";

// Opening the link only looks the token up. It is used when the form is
// submitted, so mail scanners that pre-fetch links cannot burn it.
export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  const record = await findUsableToken(token);

  if (!record) {
    return (
      <AuthShell
        title="This link has expired"
        description="Sign-in links work once and only for a limited time. Enter your email and we will send a fresh one."
        footer={<Link href="/sign-in" className="font-semibold text-green-text">Back to sign in</Link>}
      >
        <LinkRequestForm />
      </AuthShell>
    );
  }

  const invite = record.purpose === "INVITE";
  const hasPassword = record.volunteer.passwordHash !== null;
  return (
    <AuthShell
      title={invite ? `Welcome, ${record.volunteer.firstName}` : hasPassword ? "Choose a new password" : "Choose a password"}
      description={
        invite
          ? "Choose a password for your Satisfy volunteer account. You will use it with your email to sign in."
          : `For ${record.volunteer.email}.`
      }
    >
      <div className="flex flex-col gap-5">
        {invite && <FormNotice tone="info">Signing in as {record.volunteer.email}</FormNotice>}
        <SetPasswordForm token={token} email={record.volunteer.email} submitLabel={invite ? "Set password and sign in" : "Save and sign in"} />
      </div>
    </AuthShell>
  );
}
