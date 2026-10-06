# Convención MIDI de HeroLeiros

Esta guía es para el director (o quien prepare las canciones). Si el MIDI sigue estas
reglas, la app lo convierte sola en un carril de juego por instrumento y en el
acompañamiento que suena de fondo.

## 1. Estructura de una canción

Cada canción es una carpeta dentro de `content/songs/`:

```
content/songs/
  mi-samba/            ← nombre de carpeta = dirección web (/canciones/mi-samba)
    song.mid           ← el MIDI exportado del DAW
    meta.json          ← título, BPM, secciones…
```

- El nombre de la carpeta solo puede tener minúsculas, números y guiones (`samba-reggae-2`).
- Las carpetas que empiezan por `_` se ignoran (útil para borradores).

## 2. Pistas: una por instrumento

El nombre de cada pista del MIDI dice qué instrumento es. Usa estos nombres exactos:

| Pista del DAW | Instrumento   | Golpes (carriles, de izquierda a derecha) |
| ------------- | ------------- | ----------------------------------------- |
| `Surdo 1`     | Surdo de primeira | abierto, apagado                      |
| `Surdo 2`     | Surdo de segunda  | abierto, apagado                      |
| `Surdo 3`     | Surdo de terceira / corte | abierto, apagado              |
| `Caixa`       | Caixa         | abierto, suave (apagado), aro             |
| `Repinique`   | Repinique     | abierto, apagado, aro, slap               |
| `Tamborim`    | Tamborim      | abierto, apagado                          |
| `Agogo`       | Agogô         | agudo, grave                              |
| `Chocalho`    | Chocalho      | adelante (abierto), atrás (apagado)       |

La búsqueda es tolerante: no importan mayúsculas, acentos, espacios ni guiones
(`SURDO-1`, `agogô`, `Tamborím` valen). También se aceptan estos alias:

- Surdo 1: `Surdo de primeira`, `Primeira`, `Surdo`, `Surdo I`
- Surdo 2: `Surdo de segunda`, `Segunda`, `Surdo II`
- Surdo 3: `Surdo de terceira`, `Terceira`, `Surdo de corte`, `Corte`, `Surdo III`
- Caixa: `Caja`, `Caixa de guerra`, `Tarol`, `Snare`
- Repinique: `Repique`, `Repi`, `Repenique`
- Tamborim: `Tamborin`, `Tamboril`
- Agogô: `Agogo bell`, `Campana`
- Chocalho: `Ganzá`, `Shaker`, `Platinela`, `Rocar`

Si una pista tiene otro nombre, puedes añadir un alias en `meta.json`
(ver `trackAliases` más abajo). Las pistas sin notas se ignoran; las que no se
reconocen se avisan en `npm run songs:check` y no suenan.

Si dos pistas son el mismo instrumento (p. ej. `Caixa` y `Caja`), se combinan.

## 3. Notas: una por tipo de golpe

La altura de la nota indica el golpe. La tabla es la misma para todos los instrumentos:

| Nota MIDI | Nombre (C3 = 60) | Golpe                  |
| --------- | ---------------- | ---------------------- |
| 36        | C1               | abierto                |
| 37        | C#1              | apagado                |
| 38        | D1               | aro                    |
| 39        | D#1              | slap                   |
| 40        | E1               | abierto **acentuado**  |
| 60        | C3               | agudo (campana aguda del agogô) |
| 61        | C#3              | grave (campana grave del agogô) |

Reglas:

- Un instrumento solo usa los golpes de su fila en la tabla de pistas. Por ejemplo, una
  nota 38 (aro) en el `Surdo 1` no existe y se informa como «nota sin mapear».
- El carril de juego solo muestra los golpes que la canción usa de verdad: si la caixa
  nunca toca aro, el jugador verá dos carriles en vez de tres.
- **Acentos**: una nota es acentuada si es la nota 40 o si su velocidad es ≥ 110
  (configurable con `accentVelocity`). Los acentos se ven más grandes en el carril.
- La **duración** de la nota no importa; solo cuenta el inicio.
- La **velocidad** (1–127) también controla el volumen en el acompañamiento.
- Se puede usar cualquier canal MIDI (lo habitual en percusión es el 10).

## 4. Tempo, compás y secciones

- **Tempo**: HeroLeiros usa un tempo constante. Pon el BPM en `meta.json` (`bpm`) o en el
  MIDI. Si el MIDI tiene cambios de tempo, se avisa y se usa el primero (o el de `meta.json`).
  El jugador puede bajar la velocidad del 100 % al 50 % sin perder calidad, porque el
  acompañamiento se genera desde el propio MIDI.
- **Compás**: se lee del MIDI o de `timeSignature` en `meta.json` (`[4, 4]`, `[2, 4]`…).
  El metrónomo marca negras y acentúa el primer pulso de cada compás.
- **Secciones**: sirven para los bucles y para el resultado por sección. Se definen en
  `meta.json`; si no hay, se usan los **marcadores** del MIDI (cada marcador abre una
  sección hasta el siguiente); y si tampoco hay, la canción entera es una sección.

## 5. `meta.json`

```json
{
  "title": "Samba de ensayo",
  "artist": "HeroLeiros",
  "description": "Llamada de repinique, groove, breque y final.",
  "bpm": 100,
  "timeSignature": [4, 4],
  "sections": [
    { "name": "Llamada", "startBar": 1, "endBar": 4 },
    { "name": "Groove", "startBar": 5, "endBar": 12 }
  ],
  "trackAliases": { "Caja vieja": "caixa" },
  "mapping": {
    "caixa": { "42": "aro", "44": { "stroke": "abierto", "accent": true } }
  },
  "accentVelocity": 110
}
```

| Campo            | Obligatorio | Qué hace |
| ---------------- | ----------- | -------- |
| `title`          | sí          | Título que ve el grupo. |
| `artist`         | no          | Autor o arreglista. |
| `description`    | no          | Texto corto en la lista de canciones. |
| `bpm`            | no          | BPM de referencia (30–300). Si falta, se usa el del MIDI. |
| `timeSignature`  | no          | Compás `[numerador, denominador]`. Si falta, el del MIDI o 4/4. |
| `sections`       | no          | Lista de `{ name, startBar, endBar }`; compases desde 1, ambos incluidos. |
| `trackAliases`   | no          | Nombre de pista del MIDI → instrumento (`surdo1`, `caixa`, `agogo`…). |
| `mapping`        | no          | Por instrumento, nota MIDI → golpe (`abierto`, `apagado`, `aro`, `slap`, `agudo`, `grave`), o `{ "stroke": …, "accent": true }`. Se suma a la tabla común. |
| `accentVelocity` | no          | Velocidad mínima (1–127) para que una nota cuente como acento. Por defecto 110. |

Identificadores de instrumento para `trackAliases` y `mapping`: `surdo1`, `surdo2`,
`surdo3`, `caixa`, `repinique`, `tamborim`, `agogo`, `chocalho`.

## 6. Comprobar antes de publicar

```bash
npm run songs:check              # todas las canciones
npm run songs:check -- mi-samba  # solo una
```

Muestra, para cada canción, el tempo, el compás, los compases y la duración; cada pista
con el instrumento detectado y cuántas notas tiene de cada golpe; las notas sin mapear; y
las secciones. Termina con error (código 1) si falta el título, el MIDI no se puede leer o
no hay ninguna pista jugable, para poder usarlo en CI.

Ejemplo de salida:

```
✔ samba-de-ensayo — «Samba de ensayo»
  100 BPM · compás 4/4 · 24 compases · 0:58
  Pistas:
    · Surdo 1 → Surdo 1: 87 notas (apagado 38, abierto 49)
    · Caixa → Caixa: 240 notas (abierto 155, apagado 68, aro 17; 81 acentos)
    …
  Secciones:
    · Llamada: compases 1–4
    · Groove: compases 5–12
```

## 7. Plantillas

- `docs/plantillas/plantilla-heroleiros.mid`: MIDI vacío con las ocho pistas ya nombradas,
  100 BPM y 4/4. Ábrelo en cualquier DAW (Reaper, Ableton, Logic, MuseScore…) y empieza a escribir.
- `docs/plantillas/plantilla-heroleiros.RPP`: proyecto de Reaper con las mismas pistas.
  En Reaper, usa *File → Export project MIDI* con «Embed tempo map» y exporta como `song.mid`.
- `scripts/generate-example-songs.ts` (`npm run songs:generate`) genera las canciones de
  ejemplo a partir de patrones de texto, por si prefieres escribir ritmos sin DAW.

## 8. Consejos para el DAW

- Exporta en formato MIDI 1 (varias pistas). Los nombres de pista deben viajar en el archivo.
- Cuantiza a semicorcheas (o tresillos) salvo que quieras practicar el *swing* exacto:
  el juez es estricto (±35 ms para «Perfecto»).
- Empieza la canción en el compás 1, tiempo 1. Si hay anacrusa, deja un compás de silencio delante.
