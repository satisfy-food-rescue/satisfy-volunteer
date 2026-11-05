import type { InductionOverview } from "@satisfy/core/api";
import { MOJ_CHECK_URL } from "@/lib/domain";
import { ORG } from "@/lib/brand";
import { todayISO } from "@/lib/dates";
import { json, mobileHandler } from "@/lib/mobile-auth";
import { inductionFor } from "@/lib/induction-data";
import { inductionToDo } from "@/lib/induction";
import { documentsFor } from "@/lib/documents";
import { documentItem } from "@/lib/mobile-api/documents";

export const dynamic = "force-dynamic";

export const GET = mobileHandler(async (me) => {
  const today = todayISO();
  const [induction, documents] = await Promise.all([inductionFor(me, today), documentsFor(me)]);
  const required = new Set(induction.agreements.filter((a) => a.required).map((a) => a.document.id));
  return json<InductionOverview>({
    today,
    complete: induction.complete,
    toDo: inductionToDo(induction),
    moj: {
      status: induction.moj.status,
      required: induction.moj.required,
      checkedISO: induction.moj.checkedISO,
      renewsISO: induction.moj.renewsISO,
      requestUrl: MOJ_CHECK_URL,
      coordinatorEmail: ORG.coordinatorEmail,
    },
    agreements: documents.filter((d) => required.has(d.document.id)).map(documentItem),
  });
});
