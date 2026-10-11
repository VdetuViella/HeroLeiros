# Estado de HeroLeiros

Documento vivo de **lo que ya está hecho**. Lo que falta está en [`roadmap.md`](roadmap.md). El plan original (decisiones y alcance) está en [`plan-desarrollo.md`](plan-desarrollo.md).

El repositorio vive en GitHub: [`VdetuViella/HeroLeiros`](https://github.com/VdetuViella/HeroLeiros). La app completa está en `main` (procede de la antigua rama `cursor/heroleiros-integracion-a812` de Cursor Origin, que ya no hace falta).

## Qué es

Aplicación web tipo Guitar Hero para un grupo de **batucada / samba**. El director mete canciones MIDI (una pista por instrumento, una nota por tipo de golpe). Cada integrante elige su instrumento, oye al resto del grupo, practica más lento o en bucle, y toca con teclado, pantalla táctil o micrófono. Hay puntuación, partitura y, si hay base de datos, cuentas con un panel para el director.

Se juega en el navegador (PC y móvil) y se puede instalar como PWA.

## Qué está hecho

### Canciones y MIDI

- Convención de pistas y golpes: [`convencion-midi.md`](convencion-midi.md).
- Plantillas de Reaper y MIDI en `docs/plantillas/`.
- Formato: `content/songs/<slug>/song.mid` + `meta.json`.
- Parser a un `Chart` tipado: `src/lib/chart/` (alias de pistas, mayúsculas, acentos).
- Validación: `npm run songs:check`.
- Tres canciones de ejemplo: **Samba de ensayo** (8 instrumentos), **Primeros pasos**, **Ijexá de ensayo** (semicorcheas y tresillos).

### Motor de audio y práctica

- Tone.js: el acompañamiento sale del MIDI, así que cambiar la velocidad (50–100 %) no estira audio.
- Mezclador por pista (volumen, mute, solo); la pista del jugador se puede silenciar o bajar.
- Metrónomo, cuenta atrás de 1 o 2 compases, bucle A-B por sección o por compases.
- Samples reales opcionales en `public/samples/<instrumento>/<golpe>.wav`; si no hay, se sintetiza. Ver `public/samples/README.md`.

### Juego (teclado y táctil)

- Carril Canvas a 60 fps, un carril por tipo de golpe (2–4).
- Teclado D F J K (configurable) y pads táctiles multitáctiles.
- Juez en `src/lib/judge/`: Perfecto ±35 ms, Bien ±70 ms, Regular ±120 ms; golpes de más y carril equivocado.
- Combo, multiplicador ×1–×4, precisión, estrellas y resultado por sección.
- Calibración de latencia por dispositivo y tipo de entrada: `/calibracion`.

### Micrófono

- Fase A (por defecto): se juzga **solo el tiempo**. Cualquier golpe vale para cualquier carril.
- AudioWorklet (energía + flujo espectral, umbral adaptativo, tiempo muerto).
- Prueba de nivel, medición de ruido de sala, sensibilidad, aviso de auriculares.
- Fase B **experimental**: distinguir abierto / apagado / aro tras entrenar un perfil. Probada con golpes sintéticos, no con el grupo real.
- Guía: [`microfono.md`](microfono.md).

### Partitura

- VexFlow, pentagrama de percusión de una línea, cuantización a semicorcheas o tresillos de corchea.
- Vistas **Carril / Partitura / Dividida**, cursor sincronizado, bucle eligiendo compases.
- Leyenda de símbolos en la partida y en [`partitura.md`](partitura.md).

### Cuentas y progreso

- Better Auth (email/contraseña), roles `director` / `miembro`, grupos con enlace `/unirse/<código>`.
- Postgres + Drizzle. En local: Docker en el puerto 54329 (`npm run db:up` + `npm run db:setup`).
- Cada partida produce un `AttemptResult`; con sesión se envía a `POST /api/attempts`. Sin red, cola en `localStorage` y reintentos. Sin cuenta se juega igual y las partidas quedan en el navegador; al entrar se ofrece subirlas.
- `/progreso`: historial, mejor marca por canción/instrumento, precisión por día.
- `/director`: integrantes × canciones, actividad reciente, secciones con más fallos (últimos 30 días).
- Demo: `directora@heroleiros.demo` / `batucada123`. Invitación `/unirse/ensayo2026`.

### PWA, tests y despliegue preparado

- Manifiesto, iconos, service worker que cacha samples y páginas de canciones (no intercepta `/api/`; el worklet va network-first).
- Vitest (parser, mapeo, juez, micrófono, partitura, cuentas con PGlite). Playwright: canción → teclado → resultados, toggle de partitura, selector de mic, aviso de cuentas sin DB, manifiesto y service worker.
- Guía Vercel + Neon en el [README](../README.md#despliegue-vercel--neon). El código está listo; **no hay un despliegue de producción permanente** (hace falta `vercel login` y un proyecto Neon).

## Cómo arrancarlo

```bash
npm ci
npm run dev        # http://127.0.0.1:43147
```

Cuentas (opcional): copia `.env.example` a `.env.local`, `npm run db:up` y `npm run db:setup`. Detalle en el README.

## Mapa rápido del código

| Área | Dónde |
| ---- | ----- |
| Parser MIDI → Chart | `src/lib/chart/` |
| Audio (Tone.js) | `src/lib/audio/` |
| Sesión, velocidad, bucles | `src/lib/session/` |
| Teclado / táctil / mic | `src/lib/input/`, `src/lib/mic/` |
| Juez y puntuación | `src/lib/judge/` |
| Partitura | `src/lib/notation/`, `src/components/notation/` |
| Resultado de partida | `src/lib/attempts/` |
| Auth, grupos, paneles | `src/server/`, `src/app/api/` |
| Canciones | `content/songs/` |
| UI de partida | `src/components/game/` |

Diagrama de flujo más largo: sección **Arquitectura** del [README](../README.md#arquitectura).
