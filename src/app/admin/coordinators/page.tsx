import { CircleCheck, Clock, Power, ShieldCheck } from "lucide-react";
import { requireAdmin } from "@/lib/session";
import { db } from "@/lib/db";
import { formatDay, formatInstant, instantToISO } from "@/lib/dates";
import { fullName } from "@/lib/domain";
import { PageHeader } from "@/components/shared/page-header";
import { AvatarBadge } from "@/components/shared/avatar-badge";
import { Chip } from "@/components/shared/status-chip";
import { AddCoordinatorButton, CoordinatorActions } from "@/components/admin/coordinator-controls";

export const metadata = { title: "Coordinators" };

export default async function CoordinatorsPage() {
  const me = await requireAdmin();
  const now = new Date();
  const admins = await db.volunteer.findMany({
    where: { role: "ADMIN" },
    include: {
      authTokens: { where: { purpose: "INVITE", usedAt: null, expiresAt: { gt: now } }, select: { createdAt: true }, orderBy: { createdAt: "desc" }, take: 1 },
      // The latest change that made them a coordinator, for "added by".
      contactLogs: { where: { kind: { in: ["ADMIN_ACCESS", "ACCOUNT_CREATED"] } }, include: { author: { select: { firstName: true } } }, orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: [{ status: "asc" }, { firstName: "asc" }, { lastName: "asc" }],
  });
  const active = admins.filter((a) => a.status === "ACTIVE").length;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8">
      <PageHeader
        eyebrow="Set-up"
        title="Coordinators"
        description={`${active} active ${active === 1 ? "coordinator" : "coordinators"}. Everyone here can use all of this admin.`}
        actions={<AddCoordinatorButton />}
      />
      <div className="grid items-start gap-6 @4xl/admin:grid-cols-[minmax(0,1fr)_20rem]">
        <ul className="flex flex-col divide-y divide-border rounded-2xl border border-border bg-card" aria-label="Coordinators">
          {admins.map((a) => {
            const isSelf = a.id === me.id;
            const added = a.contactLogs[0];
            const invite = a.authTokens[0];
            const hasSignedIn = Boolean(a.lastSignInAt || a.passwordHash);
            const inactive = a.status !== "ACTIVE";
            return (
              <li key={a.id} className="flex flex-wrap items-center gap-x-4 gap-y-3 p-4" aria-label={fullName(a)}>
                <AvatarBadge person={a} />
                <div className="min-w-0 flex-1 basis-56">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-ink">{fullName(a)}</span>
                    {isSelf && <Chip tone="info" size="sm">You</Chip>}
                  </p>
                  <p className="truncate text-sm text-ink-soft">{a.email}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    {inactive ? (
                      <span className="inline-flex items-center gap-1 font-semibold text-status-bad"><Power className="size-3.5" aria-hidden /> Inactive: cannot sign in</span>
                    ) : a.lastSignInAt ? (
                      <span className="inline-flex items-center gap-1"><CircleCheck className="size-3.5 text-status-good" aria-hidden /> Last signed in {formatInstant(a.lastSignInAt)}</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 font-semibold text-status-warn"><Clock className="size-3.5" aria-hidden /> {invite ? `Invited ${formatInstant(invite.createdAt)}, not signed in yet` : "Not signed in yet"}</span>
                    )}
                    {added && <span>{added.author ? `Added by ${added.author.firstName}` : "Added"}, {formatDay(instantToISO(added.createdAt))}</span>}
                  </p>
                </div>
                <CoordinatorActions coordinator={{ id: a.id, firstName: a.firstName, name: fullName(a) }} isSelf={isSelf} canInvite={!inactive && !hasSignedIn} />
              </li>
            );
          })}
        </ul>

        <aside className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 text-sm text-ink-soft" aria-labelledby="how-h">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-teal" aria-hidden />
            <h2 id="how-h" className="text-lg text-ink">How access works</h2>
          </div>
          <p>Coordinators run the roster, volunteers, training and messages. There is one level of access, so only add people you trust with volunteers&apos; contact details.</p>
          <p><span className="font-semibold text-ink">Someone new</span> gets an account and an emailed invite to choose a password, valid for 7 days. They can also sign in with Google.</p>
          <p><span className="font-semibold text-ink">An existing volunteer</span> moves here from Volunteers. Coordinators are not rostered, so they come off their regular slots and upcoming shifts. Their roles, training and history are kept.</p>
          <p><span className="font-semibold text-ink">Removing access</span> makes them a volunteer again, listed under Volunteers. To stop them signing in at all, deactivate them from their profile there.</p>
          <p>You cannot remove your own access, so there is always at least one coordinator.</p>
        </aside>
      </div>
    </div>
  );
}
