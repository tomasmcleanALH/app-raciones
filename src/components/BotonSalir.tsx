"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function BotonSalir({ className }: { className?: string }) {
  const router = useRouter();

  async function salir() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button onClick={salir} className={className}>
      Salir
    </button>
  );
}
