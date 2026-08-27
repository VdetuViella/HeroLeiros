# MCP y plugins

Panel de diagnóstico de las integraciones de Cursor conectadas a este proyecto, más la configuración que repara las que fallan.

## Qué se encontró

| Integración | Estado | Notas |
| --- | --- | --- |
| GitHub, Gmail, Google Calendar, Google Drive, Granola, Notion, Apify, Playwright | Operativo | Autenticación y llamadas de prueba correctas |
| Context7 | Clave válida (REST) | Reverificado: Bearer en `/api/v2/libs/search` → 200 y React `/reactjs/react.dev`. No hace falta crear otra clave. El MCP de este chat puede seguir anónimo (`Monthly quota exceeded`) hasta nueva sesión/agente con el secreto `CONTEXT7_API_KEY` |
| MCP de Cloudflare (docs, bindings, builds, observability) | No conectados | El plugin `cloudflare` solo carga skills; `plugin.json` no declara `mcpServers` |

## Qué se ha dejado en el repo

- `.cursor/mcp.json` configura Context7 con `CONTEXT7_API_KEY` y los cuatro MCP de Cloudflare.
- Este panel documenta cada prueba y los pasos pendientes.

## Cómo completar la reparación

1. `CONTEXT7_API_KEY` ya está en `.env` (gitignored) y es válida por REST. Si el MCP del chat sigue en cuota anónima, no regeneres la clave: arranca un agente nuevo o recarga MCP para que herede el secreto del entorno.
2. En Cursor Desktop, abre **Customize → MCP** y autentica los servidores Cloudflare con OAuth (opcional; el usuario puede omitirlo).
3. Recarga los MCP. Los namespaces `cloudflare-*` deberían aparecer tras OAuth.

## Cómo ejecutar el panel

```bash
npm ci
npm run dev
```

El servidor queda en [http://127.0.0.1:43147](http://127.0.0.1:43147).
