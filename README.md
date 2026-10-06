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
- **Partitura** (VexFlow) en un pentagrama de percusión de una línea, cuantizada a semicorcheas o
  tresillos, con cursor sincronizado, vistas carril / partitura / dividida y bucle A-B eligiendo
  compases en la partitura. Símbolos y uso en [`docs/partitura.md`](docs/partitura.md).
- **Entrada**: teclado (D F J K por defecto, configurable) y pads táctiles multitáctiles.
- **Micrófono** (fase A): toca tu instrumento de verdad; un AudioWorklet detecta cada golpe y
  se juzga solo el tiempo. Prueba de nivel, ruido de la sala, sensibilidad, aviso de auriculares
  y calibración con un clic de prueba. Opcional y experimental: distinguir el tipo de golpe
  con un perfil entrenado (fase B). Ver [`docs/microfono.md`](docs/microfono.md).
- **Juez de tiempos**: Perfecto ±35 ms, Bien ±70 ms, Regular ±120 ms, golpes de más y carril
  equivocado; combo, multiplicador ×1–×4, precisión, estrellas y resultado por sección.
- **Calibración de latencia** por dispositivo y tipo de entrada (`/calibracion`).
- **Samples opcionales**: si `public/samples/` está vacío, cada golpe se sintetiza en el navegador.
- **PWA**: instalable en el móvil (manifiesto + iconos). Un service worker cacha samples y páginas
  de canciones; no intercepta `/api/` ni el worklet del micrófono en modo cache-first.
- **Cuentas y progreso en la nube** (opcional): email y contraseña, roles director/miembro,
  grupos con enlace de invitación, historial y evolución de cada integrante y un panel del
  director con la mejor precisión por canción, la actividad reciente y las secciones con más
  fallos. Sin cuenta (o sin base de datos) se juega igual y las partidas quedan en el navegador.

## Requisitos

- Node.js 22 (o 20.19+) y npm.

## Puesta en marcha

### Solo el juego (sin cuentas)

No hace falta Postgres ni secretos. MIDI, carril, teclado, táctil, micrófono y partitura
funcionan así:

```bash
npm ci
npm run dev        # http://127.0.0.1:43147
```

La primera vez que abras una partida el navegador pedirá gesto de usuario («Tocar …») para
arrancar el audio. En el móvil, Chrome/Safari ofrecerán «Añadir a pantalla de inicio».

### Con cuentas y progreso

Hace falta Postgres (Docker en local) y las variables de [`.env.example`](.env.example):

```bash
cp .env.example .env.local   # y cambia BETTER_AUTH_SECRET (openssl rand -base64 32)
npm run db:up                # Postgres 16 en 127.0.0.1:54329 (docker-compose.yml)
npm run db:setup             # migraciones + datos de demo
npm run dev
```

Cuentas de demo (contraseña `batucada123`):

| Cuenta                       | Rol        | Qué ver |
| ---------------------------- | ---------- | ------- |
| `directora@heroleiros.demo`  | directora  | `/director`: panel del grupo «Bloco Leiros» |
| `ana@heroleiros.demo`, `bruno@…`, `carla@…`, `diego@…`, `elena@…`, `fran@…`, `gael@…` | miembros | `/progreso`: historial, mejores marcas y evolución |

El enlace de invitación de la demo es `/unirse/ensayo2026`. `npm run db:seed` borra y recrea
solo a los usuarios `@heroleiros.demo`.

### Variables de entorno

| Variable               | Obligatoria | Para qué |
| ---------------------- | ----------- | -------- |
| `DATABASE_URL`         | Para cuentas | Conexión a Postgres. Sin ella la app funciona solo en local. |
| `BETTER_AUTH_SECRET`   | En producción | Firma de las sesiones (≥ 32 caracteres). |
| `BETTER_AUTH_URL`      | En producción | URL pública de la app (en local, `http://127.0.0.1:43147`). |
| `AUTH_TRUSTED_ORIGINS` | No | Orígenes extra permitidos para iniciar sesión, separados por comas. |

## Scripts

| Comando                       | Qué hace |
| ----------------------------- | -------- |
| `npm run dev`                 | Servidor de desarrollo en el puerto 43147. |
| `npm run build` / `npm start` | Compilación y servidor de producción. |
| `npm test`                    | Tests de Vitest (parser, mapeo, juez, micrófono, partitura, cuentas con PGlite). |
| `npm run test:e2e`            | Playwright: elegir canción, tocar, resultados, partitura y PWA. |
| `npm run lint`                | ESLint. |
| `npm run typecheck`           | `tsc --noEmit`. |
| `npm run songs:check`         | Valida las canciones de `content/songs` (pistas, notas sin mapear, compases, secciones). |
| `npm run songs:generate`      | Regenera los `.mid` de ejemplo y la plantilla MIDI. |
| `npm run samples:manifest`    | Escanea `public/samples/` y escribe `manifest.json`. |
| `npm run worklet:build`       | Regenera `public/worklets/onset-processor.js` (detector del micrófono). |
| `npm run mic:wav`             | Genera un WAV de golpes para usarlo como micrófono falso en Chrome. |
| `npm run db:up`               | Arranca Postgres con Docker Compose. |
| `npm run db:generate`         | Genera una migración en `drizzle/` tras cambiar `src/server/db/schema.ts`. |
| `npm run db:migrate`          | Aplica las migraciones a `DATABASE_URL`. |
| `npm run db:seed`             | Crea la directora, el grupo y los miembros de demo con tres semanas de partidas. |
| `npm run db:setup`            | `db:migrate` + `db:seed`. |
| `npm run icons:generate`      | Regenera los PNG de `public/icons/` (PWA). |

## Convención MIDI

Una pista por instrumento, una nota MIDI por tipo de golpe. Nombres de pista y tabla de notas:
[`docs/convencion-midi.md`](docs/convencion-midi.md). Plantilla de Reaper en
`docs/plantillas/plantilla-heroleiros.RPP`.

## Micrófono

En los ajustes de la canción elige **Micrófono**. Ponte auriculares para que no capte el
acompañamiento. Calibración de ruido y de latencia en `/calibracion?entrada=microfono`.
Detalle técnico (AudioWorklet, fase B): [`docs/microfono.md`](docs/microfono.md).

## Partitura

Durante la partida, el interruptor **Carril / Partitura / Dividida**. Los compases se pueden
seleccionar para practicarlos en bucle. [`docs/partitura.md`](docs/partitura.md).

## PWA

`src/app/manifest.ts` + iconos en `public/icons/` + `public/sw.js`.

- Cacha `/samples/*` (cache-first) y las páginas `/` y `/canciones/…` (stale-while-revalidate).
- El worklet `/worklets/onset-processor.js` va **network-first** para no romper el micrófono
  con un detector viejo. Las rutas `/api/` no se interceptan (auth e intentos).
- Tras cambiar el service worker, sube la constante `VERSION` en `public/sw.js`.

En iOS: compartir → Añadir a pantalla de inicio. En Android/Chrome: el diálogo de instalación
del navegador cuando hay manifiesto e HTTPS.

## Despliegue (Vercel + Neon)

El juego no necesita credenciales. Las cuentas sí: Postgres en Neon y las variables de
`.env.example` en Vercel.

1. Crea un proyecto en [Neon](https://neon.tech) y copia la URL **pooled**
   (`…-pooler….neon.tech/neondb?sslmode=require`).
2. En [Vercel](https://vercel.com): Importa el repo (framework Next.js; `vercel.json` lo declara).
   Variables de entorno de Production y Preview:
   - `DATABASE_URL` — cadena pooled de Neon
   - `BETTER_AUTH_SECRET` — `openssl rand -base64 32`
   - `BETTER_AUTH_URL` — `https://tu-app.vercel.app` (o el dominio custom)
   - `AUTH_TRUSTED_ORIGINS` — opcional, el mismo origen si usas un dominio extra
3. Deploy. Después, con esa `DATABASE_URL`:

```bash
npm run db:migrate
# opcional, cuentas de ensayo:
npm run db:seed
```

CLI si tienes sesión: `npx vercel` (preview) y `npx vercel --prod`. Sin token no se puede
desplegar desde aquí; el código queda listo para el dashboard.

Sin `DATABASE_URL` en Vercel la app se sirve igual: se juega y las partidas quedan en el
navegador; `/entrar` muestra que las cuentas no están activadas.

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
        ├─ src/lib/notation/                cuantización, ritmo y símbolos (VexFlow en components/notation)
        ├─ src/lib/judge/                   Judge: ventanas, combo, precisión, estrellas
        └─ src/lib/attempts/                AttemptResult + reportAttempt() (localStorage + cola de subida)

src/components/account/account-provider.tsx  sesión (Better Auth) + reporter que encola cada partida
src/lib/attempts/sync.ts                     AttemptUploader: cola en localStorage, lotes y reintentos
        │  POST /api/attempts  { attempts: [{ key, result }] }  (idempotente por clave)
        ▼
src/app/api/…            Route Handlers finos → src/server/api/* (lógica testeable)
src/server/auth.ts       Better Auth (email/contraseña, campo `role` en users)
src/server/db/schema.ts  Drizzle: users, sessions, accounts, verifications, groups, memberships, attempts
src/server/progress/     consultas de agregación de los paneles (miembro y director)
drizzle/                 migraciones SQL generadas
```

### Cuentas y progreso

- **Roles**: todos se registran como `miembro`; quien crea un grupo (al registrarse con «Dirijo
  un grupo» o desde `/director`) pasa a `director`. El cliente nunca puede fijar el rol.
- **Invitaciones**: cada grupo tiene un código; el enlace `/unirse/<código>` deja crear cuenta o
  entrar y une al grupo. El director puede regenerarlo (el anterior deja de valer).
- **Intentos**: con sesión, cada partida terminada se guarda en local y se encola. La cola vive en
  `localStorage`, se envía en lotes de 50 y se reintenta (5 s, 15 s, 1 min, 5 min), al volver la
  conexión y al volver a la pestaña. La clave `startedAt|canción|instrumento` hace que los
  reenvíos no dupliquen. Las partidas jugadas sin sesión se ofrecen para subir al entrar.
- **Paneles**: `/progreso` (historial, mejor marca por canción e instrumento, precisión por día)
  y `/director` (miembros × canciones, actividad reciente, secciones con más fallos de los
  últimos 30 días por proporción de notas falladas).
- **Tests**: los de `src/server/**` usan PGlite (Postgres en memoria) con las migraciones reales,
  así que `npm test` no necesita Docker.

### Puntos de extensión

- **Nuevas entradas**: implementa `InputSource` (`src/lib/input/types.ts`) y pásala en
  `inputs` de `GameSession`. Con `lanesAware: false`, el juez acepta cualquier carril
  (`Judge.hit(null, t)`), como hace `MicInputSource`. Los golpes deben venir en el reloj
  `AudioEngine.heardTime()`. La latencia por fuente se guarda con `saveLatencyMs(kind, …)`.
- **Partitura**: `src/lib/notation/` cuantiza el `Chart` (`quantizeTrack()`), escribe cada pulso
  como figuras (`beatRhythm()`) y define los símbolos por golpe (`strokeSymbol()`); el dibujo con
  VexFlow está en `src/components/notation/` y solo se carga al abrir la partitura.
  `GameSession.now()` y `positionAt()` dan la posición actual para el cursor sincronizado.
- **Backend de intentos**: cada partida terminada produce un `AttemptResult`
  (`src/lib/attempts/types.ts`). `AccountProvider` instala con `setAttemptReporter` un reporter
  que lo guarda en local y, con sesión, lo encola para `POST /api/attempts`. `SongPlayer` también
  acepta `onAttemptComplete`. Si se añaden campos a `AttemptResult`, hay que validarlos en
  `src/server/attempts/validate.ts` y añadir la columna en el esquema.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · shadcn/ui (Base UI) ·
Tone.js · @tonejs/midi · VexFlow · Postgres · Drizzle ORM · Better Auth · Zod ·
Vitest + PGlite · Playwright.

Configuración de MCP para Cursor en local: [`docs/cursor-local.md`](docs/cursor-local.md).
