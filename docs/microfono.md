# Micrófono

Con la entrada «Micrófono» cada integrante toca su instrumento real delante del micrófono del
móvil o del portátil. HeroLeiros detecta cada golpe y lo juzga **solo por el tiempo** (fase A):
cualquier golpe vale para cualquier carril.

## Cómo se usa

1. En la página de una canción, en «Cómo vas a tocar», elige **Micrófono**.
2. **Probar el micrófono** pide permiso y muestra el nivel. La marca blanca es el umbral: cada
   golpe debe pasarla y el punto naranja se enciende cuando cuenta.
3. **Medir ruido** (3 s en silencio) ajusta el umbral al ruido de la sala.
4. Ajusta la **sensibilidad** y el **tiempo mínimo entre golpes** si hace falta.
5. Ponte **auriculares con cable**: si el acompañamiento sale por los altavoces, el micrófono lo
   oye y cuenta golpes que no has dado. Los Bluetooth añaden mucho retraso.
6. Calibra la latencia en `/calibracion?entrada=microfono`:
   - **Clic por el altavoz** (recomendado): sin auriculares y en silencio, el micrófono oye los
     clics de prueba y mide el viaje altavoz → micrófono.
   - **Tocando al clic**: con auriculares, tocas el instrumento en cada clic.

### Distinguir golpes (fase B, experimental)

En la misma tarjeta, activa **Distinguir golpes**, pulsa «Probar el micrófono» y, para cada
golpe del instrumento (abierto, apagado, aro…), pulsa **Grabar** y da 6 golpes de ese tipo
(hacen falta al menos 4). Con el perfil completo, la línea «Último golpe» muestra qué reconoce
y en la partida cada golpe va a su carril: el juez vuelve a contar «otro carril». Sin perfil
completo se juzga solo el tiempo. El perfil se guarda por instrumento.

Todo se guarda en el dispositivo (`localStorage`: `heroleiros:entrada`, `heroleiros:microfono`,
`heroleiros:latencia:microfono`).

## Cómo funciona

```
getUserMedia (sin cancelación de eco, supresión de ruido ni control de ganancia)
  → MediaStreamSource → AudioWorkletNode «heroleiros-onset» (mismo AudioContext que el motor)
      OnsetDetector por bloques de 128 muestras → mensaje { onset, time } al hilo principal
  → MicInputSource: time (reloj de render) − retraso de salida − latencia de entrada
      → InputHit { lane: null, time: reloj heardTime } → GameSession → Judge.hit(null, t)
```

- `src/lib/mic/onset-detector.ts`: lógica pura. Por cada bloque calcula el nivel RMS y su
  subida frente a los ~20 ms anteriores, y el flujo espectral (FFT Hann de ~10 ms, magnitudes con
  compresión logarítmica). Hay golpe si el nivel pasa la puerta (ruido medido + margen, o pico
  reciente − 30 dB), la energía sube y el flujo supera su mediana de los últimos 250 ms × un
  factor (umbral adaptativo); un salto de energía muy grande basta por sí solo. Después hay un
  tiempo muerto (60 ms por defecto). El instante se afina a la muestra dentro del ataque.
- `src/lib/mic/worklet/onset-processor.ts`: envoltorio del AudioWorklet. Se empaqueta con
  `npm run worklet:build` en `public/worklets/onset-processor.js` (archivo generado, en git; un
  test falla si no está al día).
- `src/lib/mic/mic-input.ts`: abre el micrófono en un `AudioContext`, carga el worklet y emite
  golpes, nivel y perfil de ruido. Traduce los errores de permisos a mensajes en español.
- `src/lib/input/microphone.ts`: `MicInputSource` (`InputSource` con `lanesAware = false`) y la
  conversión al reloj «lo que se oye» (mediana móvil de `currentTime − heardTime()`).
- `src/lib/mic/settings.ts`: método de entrada y preferencias del micrófono (incluidos los
  perfiles de timbre).
- Fase B: tras cada ataque, el detector acumula ~25 ms de espectro y emite rasgos de timbre
  (centroide espectral, energía por debajo de 250 Hz y por encima de 2,5 kHz, caída de nivel).
  `src/lib/mic/stroke-classifier.ts` elige el golpe por centroide más cercano con distancia
  normalizada; `MicInputSource` espera a esos rasgos (~25 ms, no afecta al tiempo juzgado) y
  emite el golpe con su carril.

## Probar sin micrófono

Chrome puede usar un WAV como micrófono:

```bash
npm run mic:wav -- --bpm 90 --kind caixa --out /tmp/heroleiros-mic.wav
google-chrome --use-fake-ui-for-media-stream --use-fake-device-for-media-stream \
  --use-file-for-fake-audio-capture=/tmp/heroleiros-mic.wav http://127.0.0.1:43147
```

El archivo se repite en bucle desde que se abre el micrófono. Los tests (`npm test`) generan
golpes sintéticos de surdo, caixa, tamborim y clic con ruido de sala (`src/lib/mic/test-signals.ts`).

## Limitaciones conocidas

- Por defecto (fase A) no distingue el tipo de golpe; los «carriles» solo guían la vista. La
  fase B es experimental: está probada con golpes sintéticos de surdo (abierto, apagado, aro),
  no con grabaciones reales del grupo; golpes con timbres parecidos se confundirán.
- Sin auriculares, el acompañamiento y el metrónomo pueden contar como golpes de más.
- En salas muy ruidosas o con mucho eco hay que bajar la sensibilidad o subir el tiempo mínimo
  entre golpes; un golpe muy flojo justo después de uno fuerte (dentro de su cola) puede perderse.
- La latencia de entrada que declaran los navegadores no siempre es fiable: calibra en cada
  dispositivo. En iOS la latencia es mayor y más variable.
