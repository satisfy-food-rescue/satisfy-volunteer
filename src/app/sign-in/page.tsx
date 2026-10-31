import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/session";
import { isProviderSignInError, providerSignInMessage } from "@satisfy/core/sign-in";
import { appleConfigured, googleConfigured, isDemo } from "@/lib/env";
import { postSignInPath, safeNextPath } from "@/lib/auth-shared";
import { ORG } from "@/lib/brand";
import { AuthShell } from "@/components/auth/auth-shell";
import { DemoPersonas } from "@/components/auth/demo-personas";
import { FormNotice } from "@/components/auth/form-notice";
import { OtherSignInMethods } from "@/components/auth/other-sign-in-methods";
import { SignInForm } from "@/components/auth/sign-in-form";

export const metadata: Metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string; email?: string; deleted?: string }> }) {
  const { next: rawNext, error, email, deleted } = await searchParams;
  const next = safeNextPath(rawNext);
  const user = await currentUser();
  if (user) redirect(postSignInPath(user.role, next));
  if (isDemo()) return <DemoPersonas />;
  const notice = isProviderSignInError(error) ? providerSignInMessage(error, email ?? null) : null;

  return (
    <AuthShell
      title="Sign in"
      description={<>For volunteers and coordinators at {ORG.name}.</>}
      footer={
        <div className="flex flex-col gap-3">
          <p>
            New to {ORG.shortName}?{" "}
            <Link href="/sign-up" className="whitespace-nowrap font-semibold text-teal underline underline-offset-4">
              Sign up to volunteer
            </Link>
          </p>
          <p>
            Already volunteering but never signed in?{" "}
            <Link href="/forgot-password?first=1" className="whitespace-nowrap font-semibold text-teal underline underline-offset-4">
              Set up your password
            </Link>
          </p>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        {notice && <FormNotice tone="error">{notice}</FormNotice>}
        {deleted === "1" && !notice && <FormNotice tone="success">Your account has been deleted. Thank you for volunteering with {ORG.shortName}.</FormNotice>}
        <SignInForm next={next} />
        <OtherSignInMethods google={googleConfigured()} apple={appleConfigured()} next={next} />
      </div>
    </AuthShell>
  );
}
