# Partitura

Durante la partida, el botón de vista (arriba a la derecha) alterna entre:

- **Carril**: solo las notas que bajan (como hasta ahora).
- **Partitura**: solo la partitura de tu instrumento.
- **Dividida**: carril y partitura a la vez (lado a lado en pantallas anchas, uno encima del otro
  en el móvil).

La vista elegida se recuerda en el navegador.

## Cómo se lee

Cada instrumento se escribe en un **pentagrama de percusión de una sola línea**, con la clave de
percusión al principio de cada fila y el compás (`4/4`) al principio de la canción. Encima de cada
compás aparece su número y, si empieza una sección, su nombre.

La duración escrita solo indica **cuándo llega el siguiente golpe**: en percusión no se mantiene
el sonido. Por eso una corchea con puntillo seguida de una semicorchea («8. 16») son dos golpes
separados por tres semicorcheas.

### Símbolos por golpe

| Golpe | Símbolo | Instrumentos |
| ----- | ------- | ------------ |
| Abierto | Cabeza normal sobre la línea | Todos los que tienen parche; en el chocalho, «adelante» |
| Apagado | Cabeza normal con **«+»** debajo | Surdos, repinique, tamborim; en el chocalho, «atrás» |
| Suave (caixa) | Cabeza **entre paréntesis** (nota fantasma) | Caixa |
| Aro | Cabeza en **X** | Caixa, repinique |
| Slap | Cabeza **triangular** | Repinique |
| Agudo | Cabeza **encima** de la línea | Agogô (campana aguda) |
| Grave | Cabeza **debajo** de la línea | Agogô (campana grave) |
| Acento | **«>»** debajo de la nota | Cualquier golpe acentuado |

Las plicas van siempre hacia arriba y los símbolos de golpe (acento, «+») van debajo, junto a la
cabeza. Durante la partida, el botón **Leyenda** de la partitura muestra los símbolos del
instrumento que estás tocando.

## Cuantización

El MIDI puede venir tocado a mano, con los golpes un poco adelantados o atrasados. Antes de
dibujarlo, cada pulso se ajusta a una rejilla. El pulso depende del compás:

- En **compás simple** (2/4, 3/4, 4/4…) el pulso es la **negra**, y las rejillas son:
  - **Semicorcheas** (4 casillas por negra).
  - **Tresillo de corcheas** (3 casillas), que se escribe con un «3» encima.
  - **Tresillo de semicorcheas o seisillo** (6 casillas), con un «6» encima.
  - **Fusas** (8 casillas).
- En **6/8 y 12/8** el pulso es la **negra con puntillo**, y las rejillas son corcheas (3 casillas)
  o semicorcheas (6 casillas), sin «3» porque ya es su subdivisión natural. Un dosillo se escribe
  como dos corcheas con puntillo.

Para cada pulso se elige la rejilla que deja los golpes más cerca de su sitio. Las rejillas menos
habituales tienen una penalización: una corchea tocada un poco tarde no se convierte en tresillo, y
unas semicorcheas con el **swing** típico de la samba (la segunda y la cuarta un poco tarde) siguen
escribiéndose como semicorcheas, no como seisillo ni fusas. Un golpe que llega justo antes de un
pulso cuenta como golpe en ese pulso.

Si dos golpes caen en la misma casilla se escribe solo uno (si uno de ellos era acento, se
mantiene el acento) y la partitura avisa debajo de cuántos se han juntado. Esto no cambia lo que
suena ni cómo se juzga: el carril y el juez siguen usando los tiempos exactos del MIDI.

Para ver una canción con tresillos y semicorcheas mezclados, abre **Ijexá de ensayo**.

## Cursor y bucle

- El **cursor naranja** avanza con lo que suena, golpe a golpe, y la partitura se desplaza sola
  a la fila siguiente. Si desplazas la partitura a mano, deja de seguir al cursor unos segundos.
- Los compases del tramo que estás practicando quedan sombreados.
- Para elegir un **bucle A-B** desde la partitura:
  - toca un compás (A) y luego otro (B), o
  - arrastra de un compás a otro con el ratón (o en horizontal con el dedo), o
  - con un tramo marcado, **Mayús + clic** lo amplía.
- Pulsa **Practicar en bucle**: la partida vuelve a empezar repitiendo esos compases. El tramo se
  guarda en los ajustes de la canción como «Compases a medida» con «Repetir en bucle» activado.

## Limitaciones

- Los **redobles** no tienen símbolo propio: se escriben como los golpes sueltos que trae el MIDI
  (fusas si son muy rápidos) o se juntan si caen más cerca que una fusa.
- Los compases sin notas en 4/4 se escriben con un silencio de redonda; en otros compases, con un
  silencio por pulso.
- 3/8 y 9/8 no tienen un número entero de negras: el parser los redondea y la partitura los trata
  como compás simple.
