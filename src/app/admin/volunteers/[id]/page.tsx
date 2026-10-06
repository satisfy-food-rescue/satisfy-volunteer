import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarCheck, CalendarClock, CheckCircle2, ChevronLeft, Mail, MapPin, Phone, PhoneCall, Power, RefreshCw, Sprout, XCircle, Zap } from "lucide-react";
import { requireAdmin } from "@/lib/session";
import { db } from "@/lib/db";
import { addDays, dateToISO, formatDate, isWeekday, formatDay, formatDayRange, formatInstant, formatInstantTime, formatTimeRange, todayISO, WEEKDAY_LONG } from "@/lib/dates";
import { ABSENCE_REASON_LABEL, DELIVERY_LABEL, INITIAL_VISIT_CODE, fullName } from "@/lib/domain";
import { moduleStatuses, trainingSummary } from "@/lib/training";
import { AvatarBadge } from "@/components/shared/avatar-badge";
import { Chip, TrainingChip } from "@/components/shared/status-chip";
import { AccountControls, BookInitialVisitButton, ContactLogForm, NotesEditor, ProfileEditor, RecordCompletionButton, RolesEditor } from "@/components/admin/volunteer-admin-controls";
import { ContactTimeline } from "@/components/admin/contact-timeline";
import { RecordAbsenceForm } from "@/components/admin/record-absence-form";
import { cn } from "@/lib/utils";

export const metadata = { title: "Volunteer" };

function nextWorkingDay(iso: string) {
  let d = addDays(iso, 1);
  while (!isWeekday(d)) d = addDays(d, 1);
  return d;
}

export default async function VolunteerProfilePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ history?: string }> }) {
  const admin = await requireAdmin();
  const { id } = await params;
  const { history: historyParam } = await searchParams;
  const today = todayISO();
  const now = new Date();
  const [v, modules, visitSlots] = await Promise.all([
    db.volunteer.findUnique({
      where: { id },
      include: {
        trainingRecords: { include: { session: true }, orderBy: { completedAt: "desc" } },
        regularSlots: { include: { template: true }, orderBy: { weekday: "asc" } },
        absences: { orderBy: { startDate: "desc" } },
        emails: { select: { id: true, channel: true, kind: true, subject: true, status: true, createdAt: true }, orderBy: { createdAt: "desc" } },
        passkeys: { select: { id: true } },
        oauthAccounts: { select: { provider: true } },
        contactLogs: { include: { author: { select: { id: true, firstName: true } } }, orderBy: { createdAt: "desc" } },
        sessionRsvps: { where: { status: "GOING", session: { startsAt: { gte: now }, module: { code: INITIAL_VISIT_CODE } } }, include: { session: true } },
        assignments: { where: { status: { in: ["ATTENDED", "NO_SHOW", "CONFIRMED", "RELEASED"] } }, include: { shift: { include: { template: true } } }, orderBy: { shift: { date: "desc" } }, take: 200 },
      },
    }),
    db.trainingModule.findMany({ orderBy: { order: "asc" } }),
    db.trainingSession.findMany({ where: { startsAt: { gte: now }, module: { code: INITIAL_VISIT_CODE } }, include: { rsvps: { where: { status: "GOING" } } }, orderBy: { startsAt: "asc" } }),
  ]);
  if (!v) notFound();
  const statuses = moduleStatuses(v, modules, v.trainingRecords, today);
  const summary = trainingSummary(statuses);
  const history = v.assignments.filter((a) => dateToISO(a.shift.date) < today);
  const attended = history.filter((a) => a.status === "ATTENDED").length;
  const noShows = history.filter((a) => a.status === "NO_SHOW").length;
  const upcoming = v.assignments.filter((a) => dateToISO(a.shift.date) >= today && a.status === "CONFIRMED").sort((a, b) => a.shift.date.getTime() - b.shift.date.getTime()).slice(0, 4);
  const initialVisit = statuses.find((s) => s.module.code === INITIAL_VISIT_CODE && s.required);
  const visitBooked = v.sessionRsvps[0]?.session ?? null;
  const needsVisit = initialVisit && initialVisit.status === "NOT_STARTED";
  const openSlots = visitSlots
    .filter((s) => s.id !== visitBooked?.id && s.rsvps.length < s.capacity)
    .map((s) => ({ value: s.id, label: `${formatInstant(s.startsAt)} to ${formatInstantTime(s.endsAt)} · ${s.capacity - s.rsvps.length} of ${s.capacity} ${s.capacity === 1 ? "place" : "places"} free` }));
  const visitButton = needsVisit ? <BookInitialVisitButton volunteer={{ id: v.id, firstName: v.firstName }} openSlots={openSlots} today={today} defaultDate={nextWorkingDay(today)} rebook={!!visitBooked} /> : null;
  const signInMethods = [
    v.passwordHash && "Password",
    v.oauthAccounts.length > 0 && "Google",
    v.passkeys.length > 0 && `${v.passkeys.length} ${v.passkeys.length === 1 ? "passkey" : "passkeys"}`,
  ].filter((m): m is string => Boolean(m));
  const hours = history.filter((a) => a.status === "ATTENDED").reduce((n, a) => { const [sh, sm] = a.shift.startTime.split(":").map(Number); const [eh, em] = a.shift.endTime.split(":").map(Number); return n + (eh * 60 + em - sh * 60 - sm) / 60; }, 0);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <Link href="/admin/volunteers" className="-ml-1 inline-flex min-h-11 items-center gap-1 self-start pr-2 text-sm font-semibold text-muted-foreground hover:text-ink"><ChevronLeft className="size-5" aria-hidden /> Volunteers</Link>

      <header className="flex flex-wrap items-start gap-5 rounded-2xl border border-border bg-card p-5">
        <AvatarBadge person={v} size="lg" />
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl text-ink">{fullName(v)}</h1>
          <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-soft">
            {v.suburb && <span className="inline-flex items-center gap-1"><MapPin className="size-4 text-green-text" aria-hidden />{v.suburb}{v.birthYear ? `, ${new Date().getFullYear() - v.birthYear}` : ""}</span>}
            {v.phone && <span className="inline-flex items-center gap-1 tabular"><Phone className="size-4 text-green-text" aria-hidden />{v.phone}</span>}
            <span className="inline-flex items-center gap-1"><Mail className="size-4 text-green-text" aria-hidden />{v.email}</span>
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {v.status === "INACTIVE" && <Chip tone="muted" size="sm" icon={Power}>Inactive</Chip>}
            <TrainingChip status={summary.worst} size="sm" />
            {v.isRegular && <Chip tone="good" size="sm" icon={CalendarCheck}>Regular</Chip>}
            {v.inHarvestPool && <Chip tone="info" size="sm" icon={Sprout}>Harvest pool</Chip>}
            {v.lastMinuteOk && <Chip tone="neutral" size="sm" icon={Zap}>Last-minute OK</Chip>}
            <span className="text-xs text-muted-foreground">Joined {formatDate(dateToISO(v.joinedAt))}</span>
          </div>
        </div>
        <dl className="grid grid-cols-3 gap-4 text-center">
          {[["Shifts", attended], ["Hours", Math.round(hours)], ["No-shows", noShows]].map(([l, n]) => (
            <div key={l}><dd className="font-display font-bold text-2xl text-ink tabular">{n}</dd><dt className="text-xs font-semibold text-muted-foreground">{l}</dt></div>
          ))}
        </dl>
      </header>

      {needsVisit && (
        <section aria-label="Initial visit" className={visitBooked ? "flex flex-wrap items-center gap-4 rounded-2xl border border-green/40 bg-green-tint-soft p-4" : "flex flex-wrap items-center gap-4 rounded-2xl border border-status-info/30 bg-status-info-bg p-4"}>
          <span className={visitBooked ? "flex size-11 shrink-0 items-center justify-center rounded-xl bg-green-tint text-green-deep" : "flex size-11 shrink-0 items-center justify-center rounded-xl bg-card text-status-info"}>
            {visitBooked ? <CalendarClock className="size-6" aria-hidden /> : <PhoneCall className="size-6" aria-hidden />}
          </span>
          <div className="min-w-0 flex-1">
            {visitBooked ? (
              <>
                <p className="font-bold text-ink">Initial visit booked for {formatInstant(visitBooked.startsAt)}</p>
                <p className="text-sm text-ink-soft">{visitBooked.location}. Shifts unlock once {v.firstName}&apos;s in-person training is marked complete.</p>
              </>
            ) : (
              <>
                <p className="font-bold text-status-info">{v.firstName} has not had an initial visit yet</p>
                <p className="text-sm text-ink-soft">Give {v.firstName} a welcome call{v.phone ? <> on <span className="tabular font-semibold">{v.phone}</span></> : null} and book a time that suits. They cannot book shifts until it is done.</p>
              </>
            )}
          </div>
          {visitButton}
        </section>
      )}

      <div className="grid grid-cols-1 gap-6 @4xl/admin:grid-cols-5">
        <div className="flex flex-col gap-6 @4xl/admin:col-span-3">
          <section className="flex flex-col gap-3" aria-labelledby="tr-h">
            <h2 id="tr-h" className="text-2xl text-ink">Training record</h2>
            <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
              {statuses.filter((s) => s.required).map((s) => (
                <li key={s.module.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-ink">{s.module.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {s.module.validityMonths ? `${s.module.validityMonths}-month validity` : "Once only"} · {DELIVERY_LABEL[s.module.delivery]}
                      {s.completedISO && ` · completed ${formatDate(s.completedISO)}${s.record?.method === "SESSION" ? " (session)" : s.record?.method === "ONLINE" ? " (online)" : s.record?.method === "COORDINATOR" ? " (coordinator)" : ""}`}
                    </p>
                    {s.module.code === INITIAL_VISIT_CODE && s.status === "NOT_STARTED" && visitBooked && <p className="text-xs font-semibold text-green-text">Booked for {formatInstant(visitBooked.startsAt)}</p>}
                    {s.expiresISO && <p className={cn("text-xs tabular", s.status === "OVERDUE" ? "text-status-bad" : s.status === "DUE_SOON" ? "text-status-warn" : "text-muted-foreground")}>{s.status === "OVERDUE" ? "Expired" : "Expires"} {formatDate(s.expiresISO)}</p>}
                  </div>
                  <TrainingChip status={s.status} size="sm" />
                  {s.status !== "COMPLETE" && <RecordCompletionButton volunteerId={v.id} moduleId={s.module.id} moduleName={s.module.name} firstName={v.firstName} today={today} />}
                </li>
              ))}
            </ul>
          </section>

          <section className="flex flex-col gap-3" aria-labelledby="comm-h">
            <h2 id="comm-h" className="text-2xl text-ink">Communication history</h2>
            <ContactLogForm volunteerId={v.id} firstName={v.firstName} />
            <ContactTimeline
              emails={v.emails}
              logs={v.contactLogs.map((l) => ({ ...l, authorIsVolunteer: l.author?.id === v.id }))}
              absences={v.absences}
              limit={historyParam === "all" ? null : 8}
              showAllHref={`/admin/volunteers/${v.id}?history=all#comm-h`}
            />
          </section>

          <section className="flex flex-col gap-3" aria-labelledby="att-h">
            <h2 id="att-h" className="text-2xl text-ink">Attendance history</h2>
            {history.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">No shifts yet.</p>
            ) : (
              <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
                {history.slice(0, 12).map((a) => (
                  <li key={a.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                    <span className="w-24 shrink-0 text-muted-foreground tabular">{formatDay(dateToISO(a.shift.date))}</span>
                    <Link href={`/admin/roster/${a.shiftId}`} className="min-w-0 flex-1 truncate font-semibold text-ink hover:underline">{a.shift.template.name}</Link>
                    {a.status === "ATTENDED" && <Chip tone="good" size="sm" icon={CheckCircle2}>Attended</Chip>}
                    {a.status === "NO_SHOW" && <Chip tone="bad" size="sm" icon={XCircle}>No-show</Chip>}
                    {a.status === "RELEASED" && <Chip tone="neutral" size="sm">Away</Chip>}
                    {a.status === "CONFIRMED" && <Chip tone="neutral" size="sm">Not marked</Chip>}
                  </li>
                ))}
                {history.length > 12 && <li className="px-4 py-2 text-xs text-muted-foreground">Showing the last 12 of {history.length}.</li>}
              </ul>
            )}
          </section>
        </div>

        <div className="flex flex-col gap-6 @4xl/admin:col-span-2">
          <section className="rounded-2xl border border-border bg-card p-4" aria-labelledby="contact-h">
            <h2 id="contact-h" className="text-xl text-ink">Contact and availability</h2>
            <p className="mb-3 mt-1 text-xs text-muted-foreground">Edit while you are on the phone.</p>
            <ProfileEditor
              volunteerId={v.id}
              initial={{ phone: v.phone ?? "", suburb: v.suburb ?? "", emergencyName: v.emergencyName ?? "", emergencyPhone: v.emergencyPhone ?? "", availabilityNote: v.availabilityNote ?? "", lastMinuteOk: v.lastMinuteOk, inHarvestPool: v.inHarvestPool }}
            >
              <dl className="grid grid-cols-[7.5rem_1fr] gap-x-3 gap-y-2 text-sm">
                <dt className="font-semibold text-muted-foreground">Mobile</dt><dd className="text-ink tabular">{v.phone ?? <span className="text-muted-foreground">Not provided</span>}</dd>
                <dt className="font-semibold text-muted-foreground">Suburb</dt><dd className="text-ink">{v.suburb ?? <span className="text-muted-foreground">Not provided</span>}</dd>
                <dt className="font-semibold text-muted-foreground">Emergency</dt>
                <dd className="text-ink">{v.emergencyName ?? <span className="text-status-warn">Not provided</span>}{v.emergencyPhone && <span className="block text-ink-soft tabular">{v.emergencyPhone}</span>}</dd>
                <dt className="font-semibold text-muted-foreground">Availability</dt><dd className="text-ink-soft">{v.availabilityNote ?? <span className="text-muted-foreground">Not provided</span>}</dd>
                <dt className="font-semibold text-muted-foreground">Last-minute</dt><dd className="text-ink">{v.lastMinuteOk ? "Yes, send notifications" : "No"}</dd>
                <dt className="font-semibold text-muted-foreground">Harvest pool</dt><dd className="text-ink">{v.inHarvestPool ? "Yes" : "No"}</dd>
              </dl>
            </ProfileEditor>
          </section>

          <section className="rounded-2xl border border-border bg-card p-4" aria-labelledby="roles-h">
            <h2 id="roles-h" className="text-xl text-ink">Roles</h2>
            <p className="mb-3 mt-1 text-xs text-muted-foreground">Roles decide which shift types and training modules apply.</p>
            <RolesEditor volunteerId={v.id} initial={v.roles} />
          </section>

          <section className="rounded-2xl border border-border bg-card p-4" aria-labelledby="slot-h">
            <h2 id="slot-h" className="text-xl text-ink">Regular slot</h2>
            {v.regularSlots.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">No regular slot. Books one-off shifts.</p> : (
              <ul className="mt-2 flex flex-col gap-1.5">
                {v.regularSlots.map((s) => <li key={s.id} className="rounded-xl bg-green-tint-soft px-3 py-2 text-sm"><span className="font-bold text-ink">{WEEKDAY_LONG[s.weekday]}s</span> · {s.template.name} · <span className="tabular">{formatTimeRange(s.template.startTime, s.template.endTime)}</span></li>)}
              </ul>
            )}
            {upcoming.length > 0 && (
              <>
                <p className="font-display mt-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">Next up</p>
                <ul className="mt-1 text-sm text-ink-soft">{upcoming.map((a) => <li key={a.id} className="tabular">{formatDay(dateToISO(a.shift.date))} · {a.shift.template.kind === "WAREHOUSE" ? "Warehouse" : a.shift.template.name.split(": ")[1]}</li>)}</ul>
              </>
            )}
          </section>

          <section className="rounded-2xl border border-border bg-card p-4" aria-labelledby="notes-h">
            <h2 id="notes-h" className="text-xl text-ink">Coordinator notes</h2>
            <div className="mt-2"><NotesEditor volunteerId={v.id} initial={v.notes ?? ""} /></div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-4" aria-labelledby="abs-h">
            <h2 id="abs-h" className="text-xl text-ink">Absences</h2>
            {v.absences.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">None recorded.</p> : (
              <ul className="mt-2 flex flex-col gap-1 text-sm">
                {v.absences.slice(0, 6).map((a) => <li key={a.id} className="flex items-center justify-between gap-2"><span className="tabular">{formatDayRange(dateToISO(a.startDate), dateToISO(a.endDate))}</span><Chip tone="neutral" size="sm">{ABSENCE_REASON_LABEL[a.reason]}</Chip></li>)}
              </ul>
            )}
            <details className="mt-3">
              <summary className="cursor-pointer text-sm font-semibold text-green-text">Record an absence for {v.firstName}</summary>
              <div className="mt-3"><RecordAbsenceForm today={today} defaultVolunteerId={v.id} volunteers={[{ id: v.id, name: fullName(v) }]} /></div>
            </details>
          </section>

          <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4" aria-labelledby="acct-h">
            <h2 id="acct-h" className="text-xl text-ink">Account</h2>
            <dl className="grid grid-cols-[7.5rem_1fr] gap-x-3 gap-y-2 text-sm">
              <dt className="font-semibold text-muted-foreground">Status</dt>
              <dd className="text-ink">{v.status === "ACTIVE" ? "Active" : "Inactive: cannot sign in"}</dd>
              <dt className="font-semibold text-muted-foreground">Last sign-in</dt>
              <dd className="text-ink">{v.lastSignInAt ? formatInstant(v.lastSignInAt) : <span className="text-muted-foreground">Not yet</span>}</dd>
              <dt className="font-semibold text-muted-foreground">Signs in with</dt>
              <dd className="text-ink">{signInMethods.length ? signInMethods.join(", ") : <span className="text-muted-foreground">Nothing set up yet</span>}</dd>
            </dl>
            <AccountControls
              volunteer={{ id: v.id, firstName: v.firstName, active: v.status === "ACTIVE", hasSignedIn: Boolean(v.lastSignInAt || v.passwordHash) }}
              isSelf={v.id === admin.id}
              upcomingShifts={v.assignments.filter((a) => a.status === "CONFIRMED" && dateToISO(a.shift.date) >= today).length}
              regularSlots={v.regularSlots.length}
            />
          </section>

          {v.infoodleId && (
            <div className="flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 text-sm">
              <RefreshCw className="size-4 text-green-text" aria-hidden />
              <span className="text-ink">Infoodle {v.infoodleId}</span>
              <span className="ml-auto text-xs text-muted-foreground">{v.infoodleSyncedAt ? `synced ${formatInstant(v.infoodleSyncedAt)}` : "not synced"}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
