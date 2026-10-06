<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# HeroLeiros

Juego de ritmo para ensayar batucada. Toda la UI y la documentación van en español.

- Gestor de paquetes: npm (`package-lock.json`). No uses pnpm/yarn.
- Comprobaciones antes de terminar: `npm run typecheck`, `npm run lint`, `npm test`, `npm run songs:check`.
- La lógica pura (parser, juez, línea de tiempo, síntesis) vive en `src/lib/` con imports relativos
  para que la usen también los scripts de `scripts/` con `tsx`. Sus tests van junto al código (`*.test.ts`).
- Convención MIDI: `docs/convencion-midi.md`. Las canciones de ejemplo se regeneran con `npm run songs:generate`.

## Cursor Cloud specific instructions

- Dev server: `npm run dev` (puerto fijo 43147, `127.0.0.1`). El script de arranque del entorno ya lo
  lanza; mira `/tmp/cursor/start-user/start-user.log` antes de abrir otro.
- El audio necesita un gesto del usuario: en pruebas de navegador, pulsa «Tocar …» antes de esperar sonido.
  Sin altavoces la partida funciona igual (el reloj es el del `AudioContext`).
- Flujo para probar a mano: portada → canción → elegir instrumento → «Tocar» → teclas D F J K → resultados.
- Micrófono sin hardware: `npm run mic:wav -- --out /tmp/mic.wav` y Chrome con
  `--use-fake-ui-for-media-stream --use-fake-device-for-media-stream --use-file-for-fake-audio-capture=/tmp/mic.wav`
  (ver `docs/microfono.md`). Si tocas `src/lib/mic/onset-detector.ts` o el worklet, ejecuta
  `npm run worklet:build`: un test compara `public/worklets/onset-processor.js` con el código fuente.
