import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    // Versión de la web (commit de Vercel): cuando cambia, el celular vuelve a guardar las pantallas.
    NEXT_PUBLIC_BUILD: process.env.VERCEL_GIT_COMMIT_SHA ?? "dev",
  },
};

export default nextConfig;
