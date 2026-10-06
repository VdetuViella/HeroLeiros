# HeroLeiros

Juego de ritmo tipo Guitar Hero para ensayar batucada. Cada integrante elige canción e
instrumento (surdos, caixa, repinique, tamborim, agogô, chocalho), toca su parte con el
teclado o la pantalla táctil mientras suena el resto del grupo, y recibe una puntuación
golpe a golpe.

## Qué incluye este MVP

- **Canciones desde MIDI**: el director deja `song.mid` + `meta.json` en `content/songs/<slug>/`.
  Una pista por instrumento, una nota por tipo de golpe. Ver [`docs/convencion-midi.md`](docs/convencion-midi.md).
- **Acompañamiento generado desde el MIDI** con Tone.js: cambiar la velocidad (50–100 %) solo
  cambia cuándo se dispara cada sonido, sin estirar audio.
- **Práctica**: tu pista silenciada / baja / normal, mezclador con volumen, mute y solo por
  instrumento, metrónomo, cuenta atrás de 1 o 2 compases, y bucle A-B por sección o por compases.
- **Carril Canvas** a 60 fps sincronizado con el reloj de audio, con un carril por golpe (2–4).
- **Entrada**: teclado (D F J K por defecto, configurable) y pads táctiles multitáctiles.
- **Micrófono** (fase A): toca tu instrumento de verdad; un AudioWorklet detecta cada golpe y
  se juzga solo el tiempo. Prueba de nivel, ruido de la sala, sensibilidad, aviso de auriculares
  y calibración con un clic de prueba. Opcional y experimental: distinguir el tipo de golpe
  con un perfil entrenado (fase B). Ver [`docs/microfono.md`](docs/microfono.md).
- **Juez de tiempos**: Perfecto ±35 ms, Bien ±70 ms, Regular ±120 ms, golpes de más y carril
  equivocado; combo, multiplicador ×1–×4, precisión, estrellas y resultado por sección.
- **Calibración de latencia** por dispositivo y tipo de entrada (`/calibracion`).
- **Samples opcionales**: si `public/samples/` está vacío, cada golpe se sintetiza en el navegador.

## Requisitos

- Node.js 22 (o 20.19+) y npm.

## Puesta en marcha

```bash
npm ci
npm run dev        # http://127.0.0.1:43147
```

## Scripts

| Comando                       | Qué hace |
| ----------------------------- | -------- |
| `npm run dev`                 | Servidor de desarrollo en el puerto 43147. |
| `npm run build` / `npm start` | Compilación y servidor de producción. |
| `npm test`                    | Tests de Vitest (parser, mapeo, juez, línea de tiempo, síntesis, calibración). |
| `npm run lint`                | ESLint. |
| `npm run typecheck`           | `tsc --noEmit`. |
| `npm run songs:check`         | Valida las canciones de `content/songs` (pistas, notas sin mapear, compases, secciones). |
| `npm run songs:generate`      | Regenera los `.mid` de ejemplo y la plantilla MIDI. |
| `npm run samples:manifest`    | Escanea `public/samples/` y escribe `manifest.json`. |
| `npm run worklet:build`       | Regenera `public/worklets/onset-processor.js` (detector del micrófono). |
| `npm run mic:wav`             | Genera un WAV de golpes para usarlo como micrófono falso en Chrome. |

## Añadir una canción

1. Crea `content/songs/<slug>/` con `song.mid` y `meta.json` (parte de
   `docs/plantillas/plantilla-heroleiros.mid` o del proyecto de Reaper).
2. Ejecuta `npm run songs:check -- <slug>` y corrige lo que avise.
3. Recarga la app: la canción aparece en la portada.

## Añadir grabaciones reales

Copia los archivos a `public/samples/<instrumento>/<golpe>.wav` (por ejemplo
`public/samples/caixa/aro.wav`) y ejecuta `npm run samples:manifest`. Detalles en
[`public/samples/README.md`](public/samples/README.md).

## Arquitectura

```
content/songs/<slug>/{song.mid,meta.json}
        │  src/lib/songs/load.ts (servidor)
        ▼
src/lib/chart/     parseChart() → Chart tipado (pistas → carriles → notas en pulsos y segundos)
        │
        ▼  (props de la página /canciones/[slug])
src/components/game/song-player.tsx
        ├─ src/lib/session/timeline.ts      plan de la partida: velocidad, cuenta atrás, bucle A-B
        ├─ src/lib/session/game-session.ts  programa audio, recibe golpes, alimenta al juez
        ├─ src/lib/audio/                   AudioEngine (Tone.js), samples + sintetizador
        ├─ src/lib/input/                   InputSource: teclado, táctil y micrófono
        ├─ src/lib/mic/                     detector de ataques, AudioWorklet, reloj y ajustes del micro
        ├─ src/lib/judge/                   Judge: ventanas, combo, precisión, estrellas
        └─ src/lib/attempts/                AttemptResult + reportAttempt() (hoy localStorage)
```

### Puntos de extensión

- **Nuevas entradas**: implementa `InputSource` (`src/lib/input/types.ts`) y pásala en
  `inputs` de `GameSession`. Con `lanesAware: false`, el juez acepta cualquier carril
  (`Judge.hit(null, t)`), como hace `MicInputSource`. Los golpes deben venir en el reloj
  `AudioEngine.heardTime()`. La latencia por fuente se guarda con `saveLatencyMs(kind, …)`.
- **Partitura**: el `Chart` (`src/lib/chart/types.ts`) trae cada nota con pulso, compás, golpe y
  acento; `GameSession.now()` y `positionAt()` dan la posición actual para un cursor sincronizado.
- **Backend de intentos**: cada partida terminada produce un `AttemptResult`
  (`src/lib/attempts/types.ts`). `reportAttempt()` lo guarda hoy en `localStorage`; basta con
  `setAttemptReporter({ submit: (r) => fetch("/api/attempts", …) })` para enviarlo al servidor.
  `SongPlayer` también acepta `onAttemptComplete`.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · shadcn/ui (Base UI) ·
Tone.js · @tonejs/midi · Vitest.

Configuración de MCP para Cursor en local: [`docs/cursor-local.md`](docs/cursor-local.md).
