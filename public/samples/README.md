# Samples de HeroLeiros

Aquí van las grabaciones reales de cada instrumento y golpe. Mientras falte alguna,
la app la **sintetiza** en el navegador (`src/lib/audio/synth.ts`), así que se puede
jugar con la carpeta vacía.

## Estructura

```
public/samples/
  manifest.json          ← lo genera `npm run samples:manifest`
  surdo1/abierto.wav
  surdo1/apagado.wav
  surdo2/…  surdo3/…
  caixa/abierto.wav  caixa/apagado.wav  caixa/aro.wav
  repinique/abierto.wav  repinique/apagado.wav  repinique/aro.wav  repinique/slap.wav
  tamborim/abierto.wav  tamborim/apagado.wav
  agogo/agudo.wav  agogo/grave.wav
  chocalho/abierto.wav  chocalho/apagado.wav   ← adelante / atrás
  metronomo/alto.wav  metronomo/bajo.wav       ← clic fuerte (1.er pulso) y débil
```

Formatos aceptados: `.wav`, `.ogg`, `.mp3`, `.m4a`, `.flac`, `.webm`.

## Cómo añadir grabaciones

1. Graba cada golpe por separado, mono, sin silencio al principio (el ataque debe
   estar en el primer milisegundo) y con una cola corta (≤ 1,5 s).
2. Guárdalo con el nombre de la tabla de arriba.
3. Ejecuta `npm run samples:manifest` y recarga la app.

Usa solo grabaciones propias o con licencia que permita su uso (CC0 o similar).
