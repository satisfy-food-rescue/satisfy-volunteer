import { requireAdmin } from "@/lib/session";
import { NewShift } from "@/components/admin/new-shift";

export const metadata = { title: "New shift" };

export default async function NewShiftPage({ searchParams }: { searchParams: Promise<{ kind?: string; date?: string }> }) {
  await requireAdmin();
  const { kind, date } = await searchParams;
  return <NewShift kind={kind} date={date} from="roster" />;
}
