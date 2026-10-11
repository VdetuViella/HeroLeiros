# Qué queda por hacer

Priorizado para que el grupo pueda ensayar en casa. Lo ya entregado está en [`estado.md`](estado.md).

## Para poder usarlo con el grupo

Estas piezas son las que cierran el producto del plan. Sin ellas se puede **probar** en local; no se puede **repartir** de verdad.

1. **Poner la rama del producto en `main`.**  
   La app completa está en `cursor/heroleiros-integracion-a812`. `main` no debe seguir siendo el esqueleto antiguo. Fusionar (o fast-forward) esa rama a `main` y trabajar a partir de ahí.

2. **Despliegue permanente (Vercel + Neon).**  
   El README ya describe los pasos. Falta: cuenta Vercel, proyecto Neon, `DATABASE_URL` pooled, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `npm run db:migrate` (y opcionalmente `db:seed`). Sin esto no hay URL estable para compartir ni panel del director en la nube. Un preview anónimo de Vercel no vale: caduca.

3. **Repertorio real.**  
   Solo hay tres canciones de ensayo. El director tiene que exportar los MIDI del DAW siguiendo [`convencion-midi.md`](convencion-midi.md), dejarlos en `content/songs/<slug>/` y pasar `npm run songs:check`.

4. **Samples del propio grupo.**  
   Hoy el acompañamiento es sintetizado. Grabar WAV por instrumento y golpe en `public/samples/<instrumento>/<golpe>.wav` y `npm run samples:manifest`. Sin esto suena a “juego”, no a la bateria.

5. **Probar micrófono y latencia en dispositivos reales.**  
   La detección de golpes está comprobada con un micrófono falso en Chrome. Falta: móviles (sobre todo iOS), surdo fuerte, salas con eco, auriculares con cable, y la calibración de `/calibracion?entrada=microfono` en hardware de verdad. Hasta entonces, teclado y pads son lo fiable.

## Mejoras importantes (cuando ya se ensaye)

6. **Fase B del micrófono con golpes reales.**  
   Distinguir abierto / apagado / aro está detrás de un interruptor experimental y solo se ha entrenado con señales sintéticas de surdo. Hace falta grabar perfiles con el grupo y, si no aguanta, dejar la fase A (solo tiempo) como modo recomendado.

7. **Cuentas en producción.**  
   Invitar a los integrantes con el enlace del director, comprobar que las partidas suben (incluida la cola sin conexión) y que `/director` refleja el avance. Ajustar textos o el flujo de “Dirijo un grupo” si en el primer ensayo se traba.

8. **Partitura más fiel en ritmos raros.**  
   Hoy: semicorcheas y tresillos de corchea. Faltan tresillos de semicorchea, fusas, redobles, y agrupar 6/8 y 12/8 por negras con puntillo. Solo duele si el repertorio usa eso.

## Limitaciones conocidas (no bloquean el ensayo)

- En pausa, la capa de pausa tapa la partitura: no se pueden marcar compases hasta reanudar o usar los ajustes de bucle.
- El bucle A-B desde la partitura es en la pantalla de juego, no en los ajustes previos. En móvil, arrastrar en vertical desplaza el pentagrama; lo fiable es tocar A y luego B.
- El service worker no precachea el MIDI en crudo (las canciones van en el HTML de `/canciones/…`).
- Playwright no abre un micrófono real ni hace login con Postgres; `npm test` usa PGlite y no necesita Docker.
- No hay tests automáticos del dibujo VexFlow (sí de la cuantización y el ritmo).
- En iOS la latencia de audio es mayor; hay que calibrar y usar auriculares con cable.
- Sin `DATABASE_URL`, las cuentas aparecen desactivadas a propósito.

## Fuera de alcance por ahora

Cosas del plan original que **no** se han pedido otra vez y no hace falta abrir ahora:

- Cambiar Canvas por PixiJS (solo si el carril va justo en móviles viejos).
- Auth social (Google, etc.): hoy es email y contraseña.
- Editor MIDI dentro de la app: las canciones se preparan en el DAW.
- Clasificación de golpes en servidor o modelos de ML.

## Orden sugerido

```
main = rama integrada
    → Vercel + Neon (URL para el grupo)
        → MIDI del repertorio + samples grabados
            → ensayo en casa (teclado / pads)
                → calibrar micrófono en 2–3 móviles
                    → abrir fase B solo si el grupo la necesita
```
