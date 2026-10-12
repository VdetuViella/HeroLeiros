# Escuela

Modo de juego con **ejercicios de técnica** para caixa y surdo, por niveles, al estilo de la
carrera de Guitar Hero. Está en `/escuela` (enlace en la cabecera y en la portada).

## Cómo se juega

- Cada ejercicio tiene **escalones de tempo** (por ejemplo 60 → 70 → 80 → 90 BPM). Con
  **3 estrellas** a velocidad normal (100 %), terminando la partida (o una vuelta entera en bucle),
  se abre el siguiente. Bajar la velocidad sirve para practicar, pero no desbloquea.
- Cada **nivel** se abre al superar la **mitad** de los ejercicios del anterior (superar = pasar su
  primer tempo). El botón **Siguiente** de cada instrumento lleva a lo que toca practicar.
- **Modo libre** (interruptor arriba): todo abierto, para quien quiera saltar a un ejercicio.
- Las **rutinas** (calentamientos) encadenan varios ejercicios, uno por sección: los resultados
  salen por sección. Todos sus tempos están abiertos.
- En los ejercicios el **metrónomo** va encendido por defecto, con un compás de cuenta atrás.
- **Digitación**: en caixa, cada nota lleva **D** (derecha) o **I** (izquierda) dentro del carril y
  encima en la partitura. Para zurdos, al revés.
- **Acentos**: en caixa, los acentos van en el carril «Abierto» y los golpes suaves en «Suave», así
  que con teclado también se juega la diferencia. Con el micrófono y los acentos calibrados
  ([`microfono.md`](microfono.md#acentos)), además se juzga la fuerza de cada golpe.

El progreso sale del historial de partidas del dispositivo (`heroleiros:intentos`); cada escalón
es su propio «chart» (`<ejercicio>-<bpm>`), así que con cuenta también llega al panel del director.

## Ejercicios

### Caixa

| Nivel | Ejercicio | Qué se trabaja | Fuente |
| ----- | --------- | -------------- | ------ |
| 1 · Pulso y manos | Ocho por mano | 8 corcheas con cada mano | Calentamiento clásico «8 on a hand» ([Yamaha](https://hub.yamaha.com/drums/d-how-to/snare-drum-warm-up-part-1)) |
| | Golpes sencillos | D I D I en semicorcheas | Rudimento n.º 1 de la [PAS](https://www.pas.org/resources/rudiments) |
| | Golpes dobles | D D I I | Rudimento n.º 6 de la PAS |
| | Escalera de subdivisiones | 1, 2, 3 y 4 golpes por pulso | Ejercicio de subdivisión con metrónomo |
| 2 · Acentos | Acento y golpe suave | Acento en la 1.ª de cada 4 | «Accent Tap» ([Vic Firth](https://ae.vicfirth.com/?p=2473)) |
| | Acento que se desplaza | El acento recorre las 4 semicorcheas | Estudios de acentos de *Stick Control* (G. L. Stone) |
| | Acentos en tresillo | Acento que cambia de mano | *Stick Control* |
| 3 · Rudimentos | Paradiddle | D I D D · I D I I | Rudimento n.º 16 ([PAS](https://pas.org/pas-blog/paradiddles-the-whole-story-in-a-nutshell/)) |
| | Paradiddle doble | D I D I D D · I D I D I I | Rudimento n.º 17 |
| | Paradiddle-diddle | D I D D I I | Rudimento n.º 19 |
| | Redoble de cinco golpes | D D I I D con acento | Rudimento n.º 7 |
| 4 · Caixa de batucada | Levada de samba | La levada de «Samba de ensayo», con surdos | Repertorio de HeroLeiros |
| | Caixa de samba-reggae | Acentos 3+3+4+3+3 con notas fantasma | [Rhythms of Resistance](https://berlin.rhythms-of-resistance.org/old/music/sheets/pdf/sambareggae.pdf) |
| | Groove y breque | 3 compases de levada + breque con el grupo | Repertorio de HeroLeiros |

### Surdo

| Nivel | Ejercicio | Instrumento | Qué se trabaja |
| ----- | --------- | ----------- | -------------- |
| 1 · Pulso | Un golpe por pulso | Surdo 1 | Negras abiertas con la maza |
| | Abierto y tapado | Surdo 1 | Golpe abierto y golpe tapado con la mano libre |
| | Dos por pulso | Surdo 1 | Corcheas regulares |
| 2 · Marcación | Marcación de primeira | Surdo 1 | Tapado en el 1, abierto en el 2 (con la segunda de fondo) |
| | Marcación de segunda | Surdo 2 | Abierto en el 1, tapado en el 2 |
| | Primeira con anticipación | Surdo 1 | Golpe de adorno antes del 2 |
| 3 · Corte y breques | Corte de terceira | Surdo 3 | Síncopas entre primeira y segunda |
| | Contratiempo | Surdo 3 | Golpes solo entre los pulsos |
| | Breque de surdos | Surdo 1 | Parar con el grupo y volver |

Papeles de los surdos según [Wikipedia: Surdo](https://en.wikipedia.org/wiki/Surdo) (la segunda
marca el 1, la primeira el 2, la terceira corta); el reparto abierto/tapado sigue la convención de
las canciones de ejemplo (`scripts/generate-example-songs.ts`). El contratiempo de terceira aparece
como patrón básico en [Samba New York](https://sambanewyorkonlineacademy.teachable.com/p/3rd-surdo-basics).

### Rutinas

- **Calentamiento de caixa**: ocho por mano, sencillos, dobles, acento y golpe suave, paradiddle.
- **Calentamiento de surdo**: un golpe por pulso, abierto y tapado, dos por pulso, marcación de
  primeira y breque.

La PAS recomienda practicar cada rudimento **despacio → rápido → despacio**; los escalones de tempo
son la versión de juego de esa idea.

## Añadir o cambiar ejercicios

Todo está en `src/lib/exercises/catalog.ts`. Cada ejercicio es una lista de compases escritos como
patrones (los mismos caracteres que `generate-example-songs.ts`):

```
x abierto · o apagado (en la caixa, «suave») · X acento · r aro · s slap · . silencio
16 caracteres = semicorcheas en 4/4 · 12 = tresillos de corchea · 8 = corcheas
```

y, opcionalmente, la digitación alineada (`D`, `I` o `.`), el acompañamiento (otros instrumentos que
suenan de fondo) y los tempos. `src/lib/exercises/chart.ts` lo convierte en un `Chart` sin MIDI
(`src/lib/chart/build.ts`). `npm test` comprueba que cada patrón está bien escrito, que la
digitación cuadra y que la partitura de cada ejercicio sale exacta.

## Limitaciones

- No hay flams ni drags (rudimentos con nota de adorno): dos golpes casi a la vez confundirían al
  juez. Tampoco redobles cerrados (*buzz*).
- Con teclado o micrófono no se sabe qué mano toca: la digitación se muestra pero no se juzga.
- Los acentos solo se juzgan por fuerza con micrófono calibrado; con teclado, por carril.
