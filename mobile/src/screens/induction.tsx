import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { Linking, Pressable, View } from "react-native";

import type { DocumentItem, InductionOverview } from "@satisfy/core/api";
import { formatDate } from "@satisfy/core/dates";
import { MOJ_RENEWAL_DAYS } from "@satisfy/core/domain";
import { agreementState, ChangeNote, DocumentBody } from "@/components/document";
import { QueryScreen } from "@/components/screen";
import { useToast } from "@/components/toast";
import { Button } from "@/components/ui/button";
import { CheckRow } from "@/components/ui/check-row";
import { Chip } from "@/components/ui/chip";
import { Icon, type IconName } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { TAB } from "@/lib/links";
import { actions, useAction, useInduction, useSession } from "@/lib/queries";
import { radius, TAP, useTheme } from "@/theme";

type Moj = InductionOverview["moj"];

/** The steps before training or shifts, in the order they are best done, as
 *  on the web: the Ministry of Justice check first (a failed check would
 *  waste training time), then the agreements, then training. */
export function InductionScreen() {
  const query = useInduction();
  const firstName = useSession().data?.me.firstName ?? null;
  return <QueryScreen query={query}>{(induction) => <Induction induction={induction} firstName={firstName} />}</QueryScreen>;
}

function Induction({ induction, firstName }: { induction: InductionOverview; firstName: string | null }) {
  const { moj, agreements } = induction;
  const toSign = agreements.filter((a) => a.needsAction);
  const showMoj = moj.required || moj.checkedISO !== null;
  let step = 0;
  return (
    <>
      <View style={{ gap: 8 }}>
        <Text variant="eyebrow" tone="tealText">
          Getting started
        </Text>
        <Text variant="body" tone="inkSoft">
          {induction.complete
            ? "All done. Thank you: your training and shifts are open to you."
            : `Before your first training session or shift, we need ${induction.toDo}. It keeps everyone safe, including you.`}
        </Text>
      </View>

      <View>
        {showMoj && (
          <Step n={++step} done={moj.status === "CURRENT" || moj.status === "NOT_REQUIRED"} icon="idCheck" title="Ministry of Justice check" chip={<MojChip moj={moj} />}>
            <MojStep moj={moj} />
          </Step>
        )}

        {agreements.length > 0 && (
          <Step
            n={++step}
            done={toSign.length === 0}
            icon="signature"
            title={agreements.length === 1 ? agreements[0]!.title : "Volunteer agreements"}
            chip={toSign.length === 0 ? <Chip tone="good" icon="checkCircle" label="Signed" small /> : <Chip tone="info" label="To sign" small />}
          >
            <Text variant="body" tone="inkSoft">
              {toSign.length === 0
                ? "Thanks for signing. You can read them again at any time under Policies."
                : agreements.length === 1
                  ? "Please read it before you come onto the premises, even for training."
                  : "You will see confidential information while volunteering, and these cover how we look after it and each other. Please read them before you come onto the premises, even for training."}
            </Text>
            {agreements.map((a) => (
              <AgreementCard key={a.id} doc={a} />
            ))}
            {toSign.length > 0 && <AgreementSigning agreements={toSign} firstName={firstName} />}
          </Step>
        )}

        <Step n={++step} done={false} icon="training" title="Training" last>
          <Text variant="body" tone="inkSoft">
            {induction.complete
              ? "Your training is open. Start with your initial visit to the warehouse, then the online modules."
              : "Your training opens as soon as the steps above are done. You can look at what is involved now."}
          </Text>
          <Button label="Go to my training" variant={induction.complete ? "primary" : "outline"} block onPress={() => router.navigate(TAB.training)} />
        </Step>
      </View>
    </>
  );
}

/** A numbered step with a line down to the next, ticked once done. */
function Step({ n, done, icon, title, chip, last, children }: { n: number; done: boolean; icon: IconName; title: string; chip?: React.ReactNode; last?: boolean; children: React.ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: "row", gap: 12, paddingBottom: last ? 0 : 16 }}>
      <View style={{ alignItems: "center" }}>
        <View
          accessibilityLabel={done ? `Step ${n}, done` : `Step ${n}`}
          style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: done ? t.greenTint : t.tealTint }}
        >
          {done ? (
            <Icon name="checkCircle" size={20} color={t.greenDeep} />
          ) : (
            <Text variant="bodyBold" tone="tealDeep" tabular>
              {n}
            </Text>
          )}
        </View>
        {!last && <View style={{ marginTop: 8, width: 2, flex: 1, borderRadius: 1, backgroundColor: t.border }} />}
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 12, padding: 16, borderRadius: radius.card, borderCurve: "continuous", borderWidth: 1, borderColor: t.border, backgroundColor: t.card }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: 10, rowGap: 6 }}>
          <Icon name={icon} size={20} color={t.tealText} />
          <Text variant="heading" accessibilityRole="header" style={{ flexShrink: 1 }}>
            {title}
          </Text>
          {chip}
        </View>
        {children}
      </View>
    </View>
  );
}

function MojChip({ moj }: { moj: Moj }) {
  if (moj.status === "CURRENT" || moj.status === "NOT_REQUIRED") return <Chip tone="good" icon="checkCircle" label="Recorded" small />;
  if (moj.status === "RENEWAL_DUE") return <Chip tone="warn" icon="clock" label="Renewal due" small />;
  if (moj.status === "EXPIRED") return <Chip tone="bad" icon="alert" label="Needs renewing" small />;
  return <Chip tone="info" label="To do" small />;
}

/** Opens a mailto link, saying where to write if the phone has no mail app. */
function useMail() {
  const toast = useToast();
  return async (email: string, subject?: string) => {
    const url = `mailto:${email}${subject ? `?subject=${encodeURIComponent(subject)}` : ""}`;
    try {
      await Linking.openURL(url);
    } catch {
      toast.show(`There is no email app on this phone. Write to ${email}.`, "error");
    }
  };
}

/** How to get the check, said supportively: it is free, done online, and
 *  anyone without a computer or scanner gets a hand from the coordinator. */
function MojStep({ moj }: { moj: Moj }) {
  const t = useTheme();
  const mail = useMail();
  if (moj.status === "CURRENT" || (moj.status === "NOT_REQUIRED" && moj.checkedISO)) {
    return (
      <Text variant="body" tone="inkSoft">
        Recorded by the coordinator, dated {formatDate(moj.checkedISO!)}.{moj.renewsISO ? ` It is renewed every three years: we will remind you before ${formatDate(moj.renewsISO)}.` : ""}
      </Text>
    );
  }
  const renewing = moj.status === "RENEWAL_DUE" || moj.status === "EXPIRED";
  return (
    <>
      <Text variant="body" tone="inkSoft">
        {moj.status === "EXPIRED"
          ? `Your check ran out on ${formatDate(moj.renewsISO!)}, so new bookings are paused until we have a new one. Your regular slot is not affected.`
          : moj.status === "RENEWAL_DUE"
            ? `Your check is three years old on ${formatDate(moj.renewsISO!)}. The Ministry can take up to 20 working days, so we ask for a new one ${MOJ_RENEWAL_DAYS} days ahead.`
            : "We ask every volunteer for a Ministry of Justice criminal record check before training, as we work alongside people from all walks of life. It is free, and you request it yourself online."}
      </Text>
      <View style={{ gap: 10 }}>
        <NumberedLine n={1}>
          <Text variant="body">
            {renewing ? "Request a new check" : "Request your own criminal record check"} on the Ministry of Justice website. You will need a photo ID, such as a driver licence or passport.
          </Text>
          <LinkRow icon="external" label="Request it at justice.govt.nz" hint="Opens in the browser" onPress={() => void WebBrowser.openBrowserAsync(moj.requestUrl)} />
        </NumberedLine>
        <NumberedLine n={2}>
          <Text variant="body">
            When it arrives by email, usually within 20 working days, forward it to{" "}
            <Text variant="bodySemibold" tone="tealText" accessibilityRole="link" onPress={() => void mail(moj.coordinatorEmail)}>
              {moj.coordinatorEmail}
            </Text>
            , or bring it in.
          </Text>
        </NumberedLine>
        <NumberedLine n={3}>
          <Text variant="body">The volunteer coordinator records the date here, and this step ticks itself off.</Text>
        </NumberedLine>
      </View>
      <View style={{ flexDirection: "row", gap: 12, padding: 14, borderRadius: radius.lg, borderCurve: "continuous", borderWidth: 1, borderColor: t.green50, backgroundColor: t.greenTintSoft }}>
        <View style={{ paddingTop: 2 }}>
          <Icon name="helpingHand" size={20} color={t.greenDeep} />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="small">
            <Text variant="smallBold">No computer, printer or scanner? That is fine.</Text> The volunteer coordinator is happy to sit down with you and do it together. Just get in touch.
          </Text>
          <LinkRow icon="mail" label="Ask for a hand" onPress={() => void mail(moj.coordinatorEmail, "Help with my Ministry of Justice check")} />
        </View>
      </View>
    </>
  );
}

function NumberedLine({ n, children }: { n: number; children: React.ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: "row", gap: 12 }}>
      <View style={{ width: 24, height: 24, marginTop: 1, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: t.muted }}>
        <Text variant="labelBold" tone="inkSoft" tabular>
          {n}
        </Text>
      </View>
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
}

function LinkRow({ icon, label, hint, onPress }: { icon: IconName; label: string; hint?: string; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityHint={hint}
      onPress={onPress}
      style={({ pressed }) => ({ minHeight: TAP, flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 6, opacity: pressed ? 0.6 : 1 })}
    >
      <Icon name={icon} size={16} color={t.tealText} />
      <Text variant="smallBold" tone="tealText">
        {label}
      </Text>
    </Pressable>
  );
}

/** One agreement, open to read while it is still to sign. */
function AgreementCard({ doc }: { doc: DocumentItem }) {
  const t = useTheme();
  const state = agreementState(doc);
  const [open, setOpen] = useState(state !== "SIGNED");
  return (
    <View style={{ borderRadius: radius.lg, borderCurve: "continuous", borderWidth: 1, borderColor: t.border, overflow: "hidden" }}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((o) => !o)}
        style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 56, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: pressed ? t.muted : "transparent" })}
      >
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="bodySemibold">{doc.title}</Text>
          <Text variant="small" tone="mutedText">
            {state === "SIGNED" && doc.readISO ? `Signed ${formatDate(doc.readISO)}` : doc.summary}
          </Text>
        </View>
        {state === "UPDATED" && <Chip tone="warn" label="Updated" small />}
        <Icon name={open ? "chevronDown" : "chevronRight"} size={16} color={t.mutedText} />
      </Pressable>
      {open && (
        <View style={{ gap: 12, padding: 12, borderTopWidth: 1, borderTopColor: t.border }}>
          {state === "UPDATED" && doc.versionNote && <ChangeNote lead="What changed:" note={doc.versionNote} />}
          <DocumentBody doc={doc} />
        </View>
      )}
    </View>
  );
}

/** One tick box per agreement, then one button: the agreements are signed
 *  together, the way they would be on paper. */
function AgreementSigning({ agreements, firstName }: { agreements: DocumentItem[]; firstName: string | null }) {
  const t = useTheme();
  const [ticked, setTicked] = useState<ReadonlySet<string>>(new Set());
  const sign = useAction(actions.signAgreements);
  const all = agreements.every((a) => ticked.has(a.id));
  const one = agreements.length === 1;
  const toggle = (id: string) =>
    setTicked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  return (
    <View style={{ gap: 12, padding: 16, borderRadius: radius.card, borderCurve: "continuous", borderWidth: 1, borderColor: t.tealTint, backgroundColor: t.tealTintSoft }}>
      <Text variant="bodyBold">
        Sign {one ? "it" : "them"}
        {firstName ? `, ${firstName}` : ""}
      </Text>
      {agreements.map((a) => (
        <CheckRow key={a.id} checked={ticked.has(a.id)} onToggle={() => toggle(a.id)}>
          I have read {a.readVersion !== null ? "the updated" : "the"} <Text variant="bodySemibold">{a.title}</Text> and agree to it.
        </CheckRow>
      ))}
      <Button
        label={one ? "Sign the agreement" : `Sign ${agreements.length === 2 ? "both" : "all"} agreements`}
        icon="signature"
        block
        disabled={!all}
        loading={sign.isPending}
        onPress={() => sign.mutate({ agreements: agreements.map((a) => ({ id: a.id, version: a.version })) })}
      />
      {!all && (
        <Text variant="small" tone="mutedText">
          Tick {one ? "the box" : "each box"} once you have read {one ? "it" : "them"}.
        </Text>
      )}
    </View>
  );
}
