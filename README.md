# MCP y plugins

Panel de diagnóstico de las integraciones de Cursor conectadas a este proyecto, más la configuración que repara las que fallan.

## Qué se encontró

| Integración | Estado | Notas |
| --- | --- | --- |
| GitHub, Gmail, Google Calendar, Google Drive, Granola, Notion, Apify, Playwright | Operativo | Autenticación y llamadas de prueba correctas |
| Context7 | Requiere API key | Cuota anónima agotada (`Monthly quota exceeded`) |
| MCP de Cloudflare (docs, bindings, builds, observability) | No conectados | El plugin `cloudflare` solo carga skills; `plugin.json` no declara `mcpServers` |

## Qué se ha dejado en el repo

- `.cursor/mcp.json` configura Context7 con `CONTEXT7_API_KEY` y los cuatro MCP de Cloudflare.
- Este panel documenta cada prueba y los pasos pendientes.

## Cómo completar la reparación

1. Crea una clave en [context7.com/dashboard](https://context7.com/dashboard) (empieza por `ctx7sk`) y añádela como secreto `CONTEXT7_API_KEY`.
2. En Cursor Desktop, abre **Customize → MCP** y autentica los servidores Cloudflare con OAuth.
3. Recarga los MCP. Context7 debería resolver librerías otra vez; los namespaces `cloudflare-*` deberían aparecer.

## Cómo ejecutar el panel

```bash
npm ci
npm run dev
```

El servidor queda en [http://127.0.0.1:43147](http://127.0.0.1:43147).
