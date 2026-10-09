import type { TrainingModuleDetail } from "@satisfy/core/api";
import { db } from "@/lib/db";
import { todayISO } from "@/lib/dates";
import { failure, json, mobileHandler } from "@/lib/mobile-auth";
import { moduleSummary } from "@/lib/mobile-api/training";
import { trainingContext } from "@/lib/volunteer-data";

export const dynamic = "force-dynamic";

// The segment is the module code here and the module id under /complete:
// Next.js needs one name for a dynamic segment at each level.
export const GET = mobileHandler<{ module: string }>(async (me, _request, { params }) => {
  const { module: code } = await params;
  const mod = await db.trainingModule.findUnique({ where: { code } });
  if (!mod) return failure(404, "Module not found.");
  const today = todayISO();
  const { statuses } = await trainingContext(me, today);
  const status = statuses.find((s) => s.module.id === mod.id)!;
  return json<TrainingModuleDetail>({ today, module: moduleSummary(status), paragraphs: (mod.content ?? "").split("\n\n").filter(Boolean) });
});
