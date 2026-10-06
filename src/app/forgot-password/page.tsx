import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { LinkRequestForm } from "@/components/auth/link-request-form";

export const metadata: Metadata = { title: "Set or reset your password" };

export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ email?: string; first?: string }> }) {
  const { email, first } = await searchParams;
  const firstTime = first === "1";
  return (
    <AuthShell
      title={firstTime ? "Set up your password" : "Forgot your password?"}
      description={
        firstTime
          ? "Enter the email address you volunteer with and we will send you a link to choose a password."
          : "Enter your email and we will send you a link to choose a new one."
      }
      footer={
        <Link href="/sign-in" className="inline-flex min-h-11 items-center gap-1 font-semibold text-green-text">
          <ChevronLeft className="size-4" aria-hidden /> Back to sign in
        </Link>
      }
    >
      <LinkRequestForm initialEmail={email} />
    </AuthShell>
  );
}
