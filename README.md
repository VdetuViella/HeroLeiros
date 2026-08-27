# MCP y plugins

Panel de diagnóstico de las integraciones de Cursor conectadas a este proyecto, más la configuración que repara las que fallan.

## Qué se encontró

| Integración | Estado | Notas |
| --- | --- | --- |
| GitHub, Gmail, Google Calendar, Google Drive, Granola, Notion, Apify, Playwright | Operativo | Autenticación y llamadas de prueba correctas |
| Context7 | Operativo con API key | Sin clave, el MCP anónimo responde `Monthly quota exceeded`. Con `CONTEXT7_API_KEY` la API v2 resuelve React a `/reactjs/react.dev` |
| MCP de Cloudflare (docs, bindings, builds, observability) | No conectados | El plugin `cloudflare` solo carga skills; `plugin.json` no declara `mcpServers` |

## Qué se ha dejado en el repo

- `.cursor/mcp.json` configura Context7 con `CONTEXT7_API_KEY` y los cuatro MCP de Cloudflare.
- Este panel documenta cada prueba y los pasos pendientes.

## Cómo completar la reparación

1. Define `CONTEXT7_API_KEY` en `.env` (local) y como secreto del entorno del agente. No la subas al repo.
2. En Cursor Desktop, abre **Customize → MCP** y autentica los servidores Cloudflare con OAuth.
3. Recarga los MCP. Los namespaces `cloudflare-*` deberían aparecer. Context7 usará la clave en la próxima sesión del agente.

## Cómo ejecutar el panel

```bash
npm ci
npm run dev
```

El servidor queda en [http://127.0.0.1:43147](http://127.0.0.1:43147).
