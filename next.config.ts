import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Nur für den Entwicklungsmodus: Ohne diesen Eintrag blockiert Next.js die
  // JavaScript-Dateien, sobald die Seite nicht über "localhost", sondern über
  // die Adresse im WLAN geöffnet wird - etwa beim Testen mit dem Handy.
  // Im Deployment auf Vercel hat der Eintrag keine Wirkung.
  allowedDevOrigins: ["192.168.178.74", "*.local"],
};

export default nextConfig;
