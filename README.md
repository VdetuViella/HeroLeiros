# Cursor local — Context7 + Playwright

Configuración para **Cursor Desktop en tu máquina**, no para Cloud Agents.

## 1. Context7

Necesitas la variable de entorno `CONTEXT7_API_KEY` (empieza por `ctx7sk`).

**macOS / Linux** — en `~/.zshrc` o `~/.bashrc`:

```bash
export CONTEXT7_API_KEY="ctx7sk-…"
```

Cierra Cursor por completo y ábrelo de nuevo (mejor desde una terminal ya con la variable, o reinicia sesión gráfica si Cursor no hereda el shell).

**Windows** — Variables de entorno del sistema → nueva variable de usuario `CONTEXT7_API_KEY`.

Comprueba:

```bash
echo $CONTEXT7_API_KEY   # macOS/Linux
```

## 2. Playwright

Requisitos: Node.js 18+ y `npx` en el PATH.

La primera vez instala Chromium:

```bash
npx playwright install chromium
```

## 3. Dónde poner el `mcp.json`

Este repo ya incluye `.cursor/mcp.json` con Context7 y Playwright. Si abres **esta carpeta** en Cursor Desktop, debería bastar.

Para tenerlos en **todos** los proyectos, copia el mismo contenido a:

- macOS/Linux: `~/.cursor/mcp.json`
- Windows: `%USERPROFILE%\.cursor\mcp.json`

Contenido:

```json
{
  "mcpServers": {
    "context7": {
      "url": "https://mcp.context7.com/mcp",
      "headers": {
        "CONTEXT7_API_KEY": "${env:CONTEXT7_API_KEY}"
      }
    },
    "playwright": {
      "command": "npx",
      "args": ["-y", "@playwright/mcp@latest"]
    }
  }
}
```

## 4. Activar en Cursor Desktop

1. **Customize → MCP** (o Settings → Tools & MCP).
2. Comprueba que `context7` y `playwright` aparecen en verde.
3. Si Context7 sigue en cuota anónima, Cursor no está leyendo `CONTEXT7_API_KEY`: revisa el paso 1 y reinicia Cursor.
4. Logs: Output → **MCP Logs**.

## 5. Qué no hace falta

| Cosa | Notas |
| --- | --- |
| Cloud Agent / Save environment | Era de la VM en la nube; ignóralo para trabajo local |
| Plugin Playwright del marketplace | Opcional; este `mcp.json` ya lanza `@playwright/mcp` |
| Navegador “de fábrica” de Cloud Agents | Solo en la nube (`computerUse`). En local usas Playwright MCP |

## Panel opcional de este repo

```bash
npm ci
npm run dev
```

Abre http://127.0.0.1:43147 — es solo un resumen; **no configura tu Cursor local**.
