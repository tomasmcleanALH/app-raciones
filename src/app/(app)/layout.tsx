import Nav from "@/components/Nav";
import { requireProfile } from "@/lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireProfile();

  return (
    <div className="flex min-h-screen flex-1 flex-col">
      <Nav nombre={profile.nombre} rol={profile.rol} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
