export type Health = "ok" | "action" | "partial";

export type DiagnosticItem = {
  id: string;
  name: string;
  kind: "mcp" | "plugin";
  health: Health;
  source: string;
  probe: string;
  detail: string;
  fix?: string;
};

export const probedAt = "27 ago 2026, 08:05 UTC";

export const mcps: DiagnosticItem[] = [
  {
    id: "github",
    name: "GitHub",
    kind: "mcp",
    health: "ok",
    source: "Plugin github",
    probe: "get_me",
    detail: "Autenticado como VdetuViella (Gabriel Alonso Goy). 20 repositorios públicos.",
  },
  {
    id: "gmail",
    name: "Gmail",
    kind: "mcp",
    health: "ok",
    source: "Plugin gmail",
    probe: "list_labels",
    detail: "Bandeja accesible: 8.566 hilos en INBOX, 19 no leídos.",
  },
  {
    id: "google-calendar",
    name: "Google Calendar",
    kind: "mcp",
    health: "ok",
    source: "MCP de usuario",
    probe: "list_calendars",
    detail: "Calendario principal «Pseudobligaciones» (gabrialogoy@gmail.com, Europe/Madrid).",
  },
  {
    id: "google-drive",
    name: "Google Drive",
    kind: "mcp",
    health: "ok",
    source: "Plugin google-drive",
    probe: "list_recent_files",
    detail: "Lista de archivos recientes correcta (p. ej. Inventario Project Zomboid).",
  },
  {
    id: "granola",
    name: "Granola",
    kind: "mcp",
    health: "ok",
    source: "Plugin granola",
    probe: "get_account_info",
    detail: "Cuenta gabriel.alonso@balidea.com, workspace Balidea, acceso personal y público.",
  },
  {
    id: "notion",
    name: "Notion",
    kind: "mcp",
    health: "ok",
    source: "Plugin notion-workspace",
    probe: "notion-get-users",
    detail: "Workspace conectado. Usuario actual: Gabriel Alonso Goy.",
  },
  {
    id: "apify",
    name: "Apify",
    kind: "mcp",
    health: "ok",
    source: "Plugin apify",
    probe: "search-apify-docs + search-actors",
    detail: "Documentación y Store responden. Búsqueda de Actors (Instagram Scraper) correcta.",
  },
  {
    id: "playwright",
    name: "Playwright",
    kind: "mcp",
    health: "ok",
    source: "MCP de usuario",
    probe: "browser_navigate → example.com",
    detail: "El servidor tardó en arrancar (estado loading al inicio). Navegación a example.com correcta.",
  },
  {
    id: "context7",
    name: "Context7",
    kind: "mcp",
    health: "ok",
    source: "API v2 con CONTEXT7_API_KEY",
    probe: "GET /api/v2/libs/search?libraryName=React",
    detail:
      "La clave es válida: React resolvió a /reactjs/react.dev y la documentación de useState se descargó. El MCP de este chat sigue sin cabecera (cuota anónima); el panel usa la clave en local.",
  },
  {
    id: "cloudflare-docs",
    name: "Cloudflare Docs",
    kind: "mcp",
    health: "action",
    source: "Plugin cloudflare (.mcp.json, no declarado)",
    probe: "namespace ausente",
    detail:
      "El plugin instala skills, pero plugin.json no declara mcpServers. Los cuatro MCP de Cloudflare no aparecen en el agente.",
    fix: "Este repo añade los servidores en .cursor/mcp.json. En Cursor Desktop abre Customize → MCP y autentica Cloudflare con OAuth.",
  },
  {
    id: "cloudflare-bindings",
    name: "Cloudflare Bindings",
    kind: "mcp",
    health: "action",
    source: "Plugin cloudflare (.mcp.json, no declarado)",
    probe: "namespace ausente",
    detail: "No conectado. Requiere OAuth de Cloudflare para gestionar Workers, KV, R2 y D1.",
    fix: "Autentica cloudflare-bindings en Customize → MCP tras recargar la configuración del proyecto.",
  },
  {
    id: "cloudflare-builds",
    name: "Cloudflare Builds",
    kind: "mcp",
    health: "action",
    source: "Plugin cloudflare (.mcp.json, no declarado)",
    probe: "namespace ausente",
    detail: "No conectado. Requiere OAuth para ver builds de Workers.",
    fix: "Autentica cloudflare-builds en Customize → MCP.",
  },
  {
    id: "cloudflare-observability",
    name: "Cloudflare Observability",
    kind: "mcp",
    health: "action",
    source: "Plugin cloudflare (.mcp.json, no declarado)",
    probe: "namespace ausente",
    detail: "No conectado. Requiere OAuth para logs y analítica.",
    fix: "Autentica cloudflare-observability en Customize → MCP.",
  },
];

export const plugins: DiagnosticItem[] = [
  {
    id: "plugin-github",
    name: "github",
    kind: "plugin",
    health: "ok",
    source: "cursor-public / cursor/plugins",
    probe: "MCP GitHub get_me",
    detail: "MCP HTTP listo. El PAT del plugin no hace falta: la sesión usa OAuth.",
  },
  {
    id: "plugin-gmail",
    name: "gmail",
    kind: "plugin",
    health: "ok",
    source: "cursor-public / cursor/plugins",
    probe: "MCP Gmail list_labels",
    detail: "Solo aporta MCP (sin skills). Funciona.",
  },
  {
    id: "plugin-google-drive",
    name: "google-drive",
    kind: "plugin",
    health: "ok",
    source: "cursor-public / cursor/plugins",
    probe: "MCP Drive list_recent_files",
    detail: "Solo aporta MCP (sin skills). Funciona.",
  },
  {
    id: "plugin-notion",
    name: "notion-workspace",
    kind: "plugin",
    health: "ok",
    source: "makenotion/cursor-notion-plugin",
    probe: "MCP Notion + 14 skills",
    detail: "Skills y MCP operativos.",
  },
  {
    id: "plugin-granola",
    name: "granola",
    kind: "plugin",
    health: "ok",
    source: "granola-inc/granola-cursor-plugin",
    probe: "MCP Granola + skills",
    detail: "Skills, comandos, subagente granola-engineer y MCP operativos.",
  },
  {
    id: "plugin-apify",
    name: "apify",
    kind: "plugin",
    health: "ok",
    source: "apify/apify-cursor-plugin",
    probe: "MCP Apify + skills + subagente",
    detail: "Skills, subagente apify y MCP operativos.",
  },
  {
    id: "plugin-context7",
    name: "context7-plugin",
    kind: "plugin",
    health: "ok",
    source: "upstash/context7",
    probe: "API v2 con CONTEXT7_API_KEY",
    detail:
      "Skills, comando /docs y subagente están instalados. La API key desbloquea la cuota. Para que el MCP del agente use la clave, añádela como secreto de entorno CONTEXT7_API_KEY.",
  },
  {
    id: "plugin-cloudflare",
    name: "cloudflare",
    kind: "plugin",
    health: "partial",
    source: "cloudflare/skills",
    probe: "skills presentes, MCP ausentes",
    detail:
      "Las 9 skills (Workers, Wrangler, Agents SDK, Durable Objects, etc.) están cargadas. Los 4 MCP del .mcp.json del plugin no se registran porque plugin.json no declara mcpServers.",
    fix: "Usa .cursor/mcp.json de este repo y autentica Cloudflare en Cursor Desktop.",
  },
];

export function counts(items: DiagnosticItem[]) {
  return {
    ok: items.filter((item) => item.health === "ok").length,
    action: items.filter((item) => item.health === "action").length,
    partial: items.filter((item) => item.health === "partial").length,
    total: items.length,
  };
}
