import { requireAdmin } from "@/lib/session";
import { NewShift } from "@/components/admin/new-shift";

export const metadata = { title: "Plan a harvest" };

export default async function NewHarvestPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  await requireAdmin();
  const { date } = await searchParams;
  return <NewShift kind="HARVEST" date={date} from="harvests" />;
}
