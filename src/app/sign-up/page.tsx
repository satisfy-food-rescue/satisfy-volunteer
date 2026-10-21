import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/session";
import { postSignInPath } from "@/lib/auth-shared";
import { ORG } from "@/lib/brand";
import { SignedOutFrame } from "@/components/auth/auth-shell";
import { SignUpForm } from "@/components/auth/sign-up-form";

export const metadata: Metadata = { title: "Sign up to volunteer" };
export const dynamic = "force-dynamic";

export default async function SignUpPage() {
  const user = await currentUser();
  if (user) redirect(postSignInPath(user.role, null));
  return (
    <SignedOutFrame width="form">
      <SignUpForm />
      <p className="mt-6 text-center text-ink-soft">
        Already volunteering with {ORG.shortName}?{" "}
        <Link href="/sign-in" className="whitespace-nowrap font-semibold text-teal underline underline-offset-4">
          Sign in
        </Link>
      </p>
    </SignedOutFrame>
  );
}
