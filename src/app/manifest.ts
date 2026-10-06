import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "HeroLeiros",
    short_name: "HeroLeiros",
    description:
      "Ensayo de batucada tipo Guitar Hero: elige canción e instrumento, toca con teclado, pantalla o micrófono y sigue el progreso del grupo.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#1a1726",
    theme_color: "#1a1726",
    lang: "es",
    dir: "ltr",
    categories: ["music", "education", "games"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
