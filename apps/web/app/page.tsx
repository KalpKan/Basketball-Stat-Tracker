import { getDashboardPayload } from "../lib/dashboard-data";
import { DashboardPage } from "../components/dashboard-page";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const initialData = await getDashboardPayload();
  return <DashboardPage initialData={initialData} />;
}

