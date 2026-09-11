import CamposAdmin from "@/components/CamposAdmin";
import { requireDueno } from "@/lib/auth";

export default async function CamposAdminPage() {
  await requireDueno();
  return <CamposAdmin />;
}
