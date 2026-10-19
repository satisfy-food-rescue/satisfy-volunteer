"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { CalendarCheck, Check, CheckCircle2, KeyRound, Loader2, Mail, Phone, Send, type LucideIcon } from "lucide-react";
import type { SignUpField, SignUpInput } from "@satisfy/core/api";
import { SIGN_UP_HINT, SIGN_UP_INTRO, SIGN_UP_PRIVACY, SIGN_UP_THANKS, signUpSteps, type SignUpStep } from "@satisfy/core/sign-up";
import { ROLE_DESCRIPTION, ROLE_LABEL, VOLUNTEER_ROLES, type VolunteerRole } from "@/lib/domain";
import { signUp } from "@/app/sign-up/actions";
import { FieldError } from "@/components/admin/field-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { FormNotice } from "./form-notice";

type Values = Omit<SignUpInput, "birthYear"> & { birthYear: string };

const EMPTY: Values = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  suburb: "",
  birthYear: "",
  interests: [],
  availability: "",
  emergencyName: "",
  emergencyPhone: "",
  message: "",
  privacy: false,
};

/** The element each field's error is shown against and focused on. */
const FIELD_ID: Record<SignUpField, string> = {
  firstName: "su-first",
  lastName: "su-last",
  email: "su-email",
  phone: "su-phone",
  suburb: "su-suburb",
  birthYear: "su-birth",
  interests: "su-interests",
  availability: "su-availability",
  emergencyName: "su-em-name",
  emergencyPhone: "su-em-phone",
  message: "su-message",
  privacy: "su-privacy",
};

/** Signing up to volunteer: an application the coordinator approves. */
export function SignUpForm() {
  const [v, setV] = useState<Values>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<SignUpField, string>>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [sent, setSent] = useState<{ firstName: string; email: string } | null>(null);
  const [pending, start] = useTransition();
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Move focus to what needs attention: the first field to fix, or the thank-you.
  useEffect(() => {
    const first = (Object.keys(FIELD_ID) as SignUpField[]).find((f) => errors[f]);
    if (first) document.getElementById(FIELD_ID[first])?.focus();
    // Only after a submit, not as each error is cleared.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);
  useEffect(() => {
    if (sent) {
      headingRef.current?.focus();
      window.scrollTo({ top: 0 });
    }
  }, [sent]);

  const set = <K extends keyof Values>(key: K, value: Values[K]) => {
    setV((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };
  const text = (key: Exclude<keyof Values, "interests" | "privacy">) => ({
    id: FIELD_ID[key],
    value: v[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set(key, e.target.value),
    "aria-invalid": errors[key] ? true : undefined,
    "aria-describedby": errors[key] ? `${FIELD_ID[key]}-error` : undefined,
  });
  const errorFor = (field: SignUpField) => errors[field] && <FieldError id={`${FIELD_ID[field]}-error`}>{errors[field]}</FieldError>;

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const website = String(new FormData(e.currentTarget).get("website") ?? "");
    const year = v.birthYear.trim();
    const input: SignUpInput = { ...v, birthYear: year === "" ? null : /^\d+$/.test(year) ? Number(year) : 0 };
    start(async () => {
      const r = await signUp({ ...input, website });
      if (r.ok) return setSent({ firstName: v.firstName.trim(), email: v.email.trim() });
      setErrors(r.fields ?? {});
      setNotice(r.fields ? null : r.error);
      setAttempt((n) => n + 1);
    });
  };

  if (sent) return <SignUpSent ref={headingRef} {...sent} />;

  return (
    <div className="rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-8">
      <h1 className="text-2xl text-ink sm:text-3xl">Sign up to volunteer</h1>
      <p className="mt-2 text-ink-soft">{SIGN_UP_INTRO}</p>

      <form onSubmit={submit} noValidate className="mt-6 flex flex-col gap-8">
        {notice && <FormNotice tone="error">{notice}</FormNotice>}

        <Section title="About you">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="First name" autoComplete="given-name" {...text("firstName")}>{errorFor("firstName")}</TextField>
            <TextField label="Last name" autoComplete="family-name" {...text("lastName")}>{errorFor("lastName")}</TextField>
          </div>
          <TextField label="Email" type="email" inputMode="email" autoComplete="email" {...text("email")} hint={SIGN_UP_HINT.email}>{errorFor("email")}</TextField>
          <TextField label="Mobile" type="tel" autoComplete="tel" {...text("phone")}>{errorFor("phone")}</TextField>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Suburb or town" autoComplete="address-level2" {...text("suburb")}>{errorFor("suburb")}</TextField>
            <TextField label="Year of birth" optional inputMode="numeric" autoComplete="bday-year" maxLength={4} {...text("birthYear")}>{errorFor("birthYear")}</TextField>
          </div>
        </Section>

        <Section title="How you would like to help" id={FIELD_ID.interests} invalid={Boolean(errors.interests)} hint={SIGN_UP_HINT.interests}>
          <div className="grid gap-2">
            {VOLUNTEER_ROLES.map((r) => (
              <RoleOption
                key={r}
                role={r}
                checked={v.interests.includes(r)}
                onChange={(on) => set("interests", on ? VOLUNTEER_ROLES.filter((x) => x === r || v.interests.includes(x)) : v.interests.filter((x) => x !== r))}
              />
            ))}
          </div>
          {errorFor("interests")}
        </Section>

        <Section title="When you are free">
          <TextField label="Usual availability" multiline hint={SIGN_UP_HINT.availability} {...text("availability")}>{errorFor("availability")}</TextField>
        </Section>

        <Section title="Emergency contact" hint={SIGN_UP_HINT.emergency}>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Their name" autoComplete="off" {...text("emergencyName")}>{errorFor("emergencyName")}</TextField>
            <TextField label="Their phone" type="tel" autoComplete="off" {...text("emergencyPhone")}>{errorFor("emergencyPhone")}</TextField>
          </div>
        </Section>

        <Section title="Anything else?">
          <TextField label="Message for the coordinator" optional multiline hint={SIGN_UP_HINT.message} {...text("message")}>{errorFor("message")}</TextField>
        </Section>

        {/* Hidden from people. Bots that fill in every field give themselves away. */}
        <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
          <label>
            Website
            <input type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
          </label>
        </div>

        <div className="flex flex-col gap-2">
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-4 has-focus-visible:outline-3 has-focus-visible:outline-ring has-aria-invalid:border-status-bad">
            <TickBox checked={v.privacy} />
            <input
              id={FIELD_ID.privacy}
              type="checkbox"
              checked={v.privacy}
              onChange={(e) => set("privacy", e.target.checked)}
              aria-invalid={errors.privacy ? true : undefined}
              aria-describedby={errors.privacy ? `${FIELD_ID.privacy}-error` : undefined}
              className="sr-only"
            />
            <span className="text-base text-ink">
              {SIGN_UP_PRIVACY.before}{" "}
              <Link href="/privacy" target="_blank" className="font-semibold text-teal underline underline-offset-4">
                {SIGN_UP_PRIVACY.link}
              </Link>{" "}
              {SIGN_UP_PRIVACY.after}
            </span>
          </label>
          {errorFor("privacy")}
        </div>

        <Button type="submit" size="lg" className="h-12 text-base" disabled={pending}>
          {pending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <Send className="size-5" aria-hidden />}
          Send my application
        </Button>
      </form>
    </div>
  );
}

function Section({ title, hint, id, invalid, children }: { title: string; hint?: string; id?: string; invalid?: boolean; children: React.ReactNode }) {
  const hintId = useId();
  return (
    <fieldset id={id} tabIndex={id ? -1 : undefined} aria-invalid={invalid || undefined} aria-describedby={hint ? hintId : undefined} className="min-w-0 outline-none">
      <legend className="font-display text-sm font-bold uppercase tracking-wide text-teal">{title}</legend>
      {hint && <p id={hintId} className="mt-1 text-sm text-muted-foreground">{hint}</p>}
      <div className="mt-4 flex flex-col gap-4">{children}</div>
    </fieldset>
  );
}

type TextFieldProps = {
  id: string;
  label: string;
  hint?: string;
  optional?: boolean;
  multiline?: boolean;
  children?: React.ReactNode;
} & Omit<React.InputHTMLAttributes<HTMLInputElement> & React.TextareaHTMLAttributes<HTMLTextAreaElement>, "id" | "children">;

function TextField({ id, label, hint, optional, multiline, children, "aria-describedby": describedBy, ...rest }: TextFieldProps) {
  const hintId = `${id}-hint`;
  const described = [describedBy, hint && hintId].filter(Boolean).join(" ") || undefined;
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label htmlFor={id} className="text-base">
        {label}
        {optional && <span className="font-normal text-muted-foreground">(optional)</span>}
      </Label>
      {multiline ? (
        <Textarea id={id} rows={3} className="min-h-24 text-base" aria-describedby={described} {...rest} />
      ) : (
        <Input id={id} className="h-12 text-base" aria-describedby={described} {...rest} />
      )}
      {hint && <p id={hintId} className="text-sm text-muted-foreground">{hint}</p>}
      {children}
    </div>
  );
}

function RoleOption({ role, checked, onChange }: { role: VolunteerRole; checked: boolean; onChange: (on: boolean) => void }) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors has-focus-visible:outline-3 has-focus-visible:outline-ring",
        checked ? "border-teal bg-teal-tint" : "border-border bg-card hover:border-teal/50",
      )}
    >
      <input type="checkbox" className="sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <TickBox checked={checked} />
      <span className="min-w-0">
        <span className={cn("block font-semibold", checked ? "text-teal-deep" : "text-ink")}>{ROLE_LABEL[role]}</span>
        <span className="block text-sm text-ink-soft">{ROLE_DESCRIPTION[role]}</span>
      </span>
    </label>
  );
}

/** The drawn box for a visually hidden checkbox. */
function TickBox({ checked }: { checked: boolean }) {
  return (
    <span aria-hidden className={cn("mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-[5px] border-2", checked ? "border-teal bg-teal text-white" : "border-ink-soft/40 bg-card")}>
      {checked && <Check className="size-3.5" strokeWidth={3} />}
    </span>
  );
}

const STEP_ICON: Record<SignUpStep["key"], LucideIcon> = { read: Mail, invite: KeyRound, call: Phone, book: CalendarCheck };

function SignUpSent({ firstName, email, ref }: { firstName: string; email: string; ref: React.Ref<HTMLHeadingElement> }) {
  return (
    <div className="rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-8" role="status">
      <span className="flex size-12 items-center justify-center rounded-full bg-status-good-bg text-status-good">
        <CheckCircle2 className="size-7" aria-hidden />
      </span>
      <h1 ref={ref} tabIndex={-1} className="mt-4 text-2xl text-ink outline-none sm:text-3xl">
        Thanks, {firstName}
      </h1>
      <p className="mt-2 text-ink-soft">{SIGN_UP_THANKS}</p>
      <ol className="mt-6 flex flex-col gap-5">
        {signUpSteps(email).map((s, i) => {
          const Icon = STEP_ICON[s.key];
          return (
            <li key={s.key} className="flex gap-4">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-teal-tint text-teal">
                <Icon className="size-5" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block font-semibold text-ink">
                  <span className="sr-only">Step {i + 1}: </span>
                  {s.title}
                </span>
                <span className="block text-ink-soft">{s.body}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
