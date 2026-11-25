import { requireAdmin } from "@/lib/session";
import { todayISO } from "@/lib/dates";
import { parseReportFilter, volunteerReport } from "@/lib/volunteer-report";

// The volunteer report as a spreadsheet download, from the form on Reports.
export async function GET(request: Request) {
  await requireAdmin();
  const filter = parseReportFilter(new URL(request.url).searchParams);
  const csv = await volunteerReport(filter);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="satisfy-volunteers-${todayISO()}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
