"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { browserSupportsWebAuthn, startRegistration, WebAuthnError } from "@simplewebauthn/browser";
import { Fingerprint, KeyRound, Laptop, Loader2, LogOut, Plus, Trash2 } from "lucide-react";
import { beginPasskeyRegistration, changePassword, disconnectGoogle, finishPasskeyRegistration, removePasskey, signOutOtherDevices } from "@/app/account/actions";
import type { ActionResult } from "@/app/app/actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PASSWORD_MIN } from "@/lib/auth-shared";
import { cn } from "@/lib/utils";
import { FormNotice } from "./form-notice";
import { GoogleButton, GoogleMark } from "./google-button";
import { PasswordInput } from "./password-input";

export type PasskeyRow = { id: string; name: string; added: string; lastUsed: string | null };

export type SecurityProps = {
  hasPassword: boolean;
  passkeys: PasskeyRow[];
  google: { email: string | null } | null;
  googleAvailable: boolean;
  otherSessions: number;
  /** Returned from the Google connect round trip. */
  notice: { tone: "success" | "error"; text: string } | null;
  returnPath: string;
};

const noop = () => () => {};

function Section({ id, title, description, children }: { id: string; title: string; description: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div>
        <h2 id={id} className="text-xl text-ink">{title}</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}

function useAction() {
  const [pending, start] = useTransition();
  const router = useRouter();
  const run = (action: () => Promise<ActionResult>, onOk?: () => void) =>
    start(async () => {
      const r = await action();
      if (r.ok) {
        toast.success(r.message ?? "Saved");
        onOk?.();
        router.refresh();
      } else toast.error(r.error);
    });
  return [pending, run] as const;
}

function PasswordSection({ hasPassword }: { hasPassword: boolean }) {
  const [pending, run] = useAction();
  const [key, setKey] = useState(0);
  return (
    <Section id="pw-h" title="Password" description={hasPassword ? "Change the password you sign in with." : "You sign in without a password at the moment. Add one if you like."}>
      <form
        key={key}
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          run(() => changePassword({ current: String(f.get("current") ?? ""), password: String(f.get("password")), confirm: String(f.get("confirm")) }), () => setKey((k) => k + 1));
        }}
      >
        {hasPassword && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="current" className="text-base">Current password</Label>
            <PasswordInput id="current" name="current" autoComplete="current-password" required />
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="new-password" className="text-base">New password</Label>
          <PasswordInput id="new-password" name="password" autoComplete="new-password" required minLength={PASSWORD_MIN} aria-describedby="new-password-help" />
          <p id="new-password-help" className="text-sm text-muted-foreground">At least {PASSWORD_MIN} characters.</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="confirm-password" className="text-base">Type it again</Label>
          <PasswordInput id="confirm-password" name="confirm" autoComplete="new-password" required />
        </div>
        <Button type="submit" size="lg" className="h-12 self-start px-5 text-base" disabled={pending}>
          {pending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <KeyRound className="size-5" aria-hidden />}
          {hasPassword ? "Change password" : "Set password"}
        </Button>
      </form>
    </Section>
  );
}

function PasskeySection({ passkeys }: { passkeys: PasskeyRow[] }) {
  const supported = useSyncExternalStore(noop, browserSupportsWebAuthn, () => false);
  const [pending, run] = useAction();
  return (
    <Section id="pk-h" title="Passkeys" description="Sign in with your fingerprint, face or phone lock instead of typing a password. Add one on each device you use.">
      {passkeys.length > 0 && (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
          {passkeys.map((p) => (
            <li key={p.id} className="flex items-center gap-3 px-3.5 py-3">
              <Fingerprint className="size-5 shrink-0 text-green-text" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-ink">{p.name}</p>
                <p className="text-sm text-muted-foreground">Added {p.added}{p.lastUsed ? ` · last used ${p.lastUsed}` : ""}</p>
              </div>
              <Button type="button" variant="ghost" size="icon-lg" className="tap text-muted-foreground hover:text-status-bad" disabled={pending} aria-label={`Remove ${p.name}`}
                onClick={() => {
                  if (window.confirm(`Remove the passkey “${p.name}”?`)) run(() => removePasskey(p.id));
                }}
              >
                <Trash2 className="size-5" aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      )}
      {supported ? (
        <Button type="button" variant="outline" size="lg" className="h-12 self-start px-5 text-base" disabled={pending}
          onClick={() =>
            run(async () => {
              const begin = await beginPasskeyRegistration();
              if (!begin.ok) return begin;
              try {
                const response = await startRegistration({ optionsJSON: begin.options });
                return finishPasskeyRegistration(response);
              } catch (err) {
                if (err instanceof WebAuthnError && err.code === "ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED") return { ok: false, error: "This device already has a passkey for your account." };
                if (err instanceof Error && err.name === "NotAllowedError") return { ok: false, error: "Passkey setup was cancelled." };
                return { ok: false, error: "This device could not create a passkey." };
              }
            })
          }
        >
          {pending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <Plus className="size-5" aria-hidden />}
          Add a passkey on this device
        </Button>
      ) : (
        <p className="text-sm text-muted-foreground">This browser does not support passkeys.</p>
      )}
    </Section>
  );
}

function GoogleSection({ google, returnPath }: { google: SecurityProps["google"]; returnPath: string }) {
  const [pending, run] = useAction();
  return (
    <Section id="g-h" title="Google" description="Sign in with your Google account instead of a password.">
      {google ? (
        <div className="flex flex-wrap items-center gap-3">
          <GoogleMark />
          <p className="min-w-0 flex-1 font-semibold text-ink">Connected{google.email ? ` as ${google.email}` : ""}</p>
          <Button type="button" variant="outline" size="lg" className="h-11 px-4" disabled={pending} onClick={() => run(() => disconnectGoogle())}>
            Disconnect
          </Button>
        </div>
      ) : (
        <div className="self-start">
          <GoogleButton next={returnPath} label="Connect Google" />
        </div>
      )}
    </Section>
  );
}

export function SecuritySettings({ hasPassword, passkeys, google, googleAvailable, otherSessions, notice, returnPath }: SecurityProps) {
  const [pending, run] = useAction();
  return (
    <div className="flex flex-col gap-5">
      {notice && <FormNotice tone={notice.tone}>{notice.text}</FormNotice>}
      <PasswordSection hasPassword={hasPassword} />
      <PasskeySection passkeys={passkeys} />
      {(googleAvailable || google) && <GoogleSection google={google} returnPath={returnPath} />}
      <Section id="dev-h" title="Other devices" description={otherSessions === 0 ? "You are only signed in here." : `You are also signed in on ${otherSessions} other ${otherSessions === 1 ? "device" : "devices"}.`}>
        <Button type="button" variant="outline" size="lg" className={cn("h-12 self-start px-5 text-base")} disabled={pending || otherSessions === 0} onClick={() => run(() => signOutOtherDevices())}>
          {pending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : otherSessions === 0 ? <Laptop className="size-5" aria-hidden /> : <LogOut className="size-5" aria-hidden />}
          Sign out everywhere else
        </Button>
      </Section>
    </div>
  );
}
