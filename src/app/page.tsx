import { DiagnosticList } from "@/components/diagnostic-list";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { counts, mcps, plugins, probedAt } from "@/data/diagnostics";
import { probeContext7 } from "@/lib/context7";

const mcpCounts = counts(mcps);
const pluginCounts = counts(plugins);

export default async function Home() {
  const context7 = await probeContext7();

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-10 sm:px-6">
      <header className="flex flex-col gap-3">
        <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
          Diagnóstico del agente · {probedAt}
        </p>
        <h1 className="font-heading text-3xl tracking-tight sm:text-4xl">
          MCP y plugins
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          Se probaron las integraciones de este agente. Context7 ya responde
          con tu API key (búsqueda de React correcta). Quedan los MCP de
          Cloudflare, que el plugin no registra.
        </p>
      </header>

      <Card className={context7.ok ? "ring-emerald-500/30" : "ring-amber-500/40"}>
        <CardHeader>
          <CardTitle>Context7 ahora mismo</CardTitle>
          <CardDescription>
            {context7.ok
              ? `Clave válida. Última búsqueda de React → ${context7.libraryId}`
              : context7.error}
          </CardDescription>
        </CardHeader>
      </Card>

      <section className="grid gap-3 sm:grid-cols-3">
        <SummaryCard
          label="MCP operativos"
          value={`${mcpCounts.ok} / ${mcpCounts.total}`}
          hint="GitHub, Gmail, Calendar, Drive, Granola, Notion, Apify, Playwright, Context7"
        />
        <SummaryCard
          label="Pendientes"
          value={String(mcpCounts.action)}
          hint="4 MCP de Cloudflare (el plugin no los declara)"
          tone="warn"
        />
        <SummaryCard
          label="Plugins parciales"
          value={String(pluginCounts.partial)}
          hint="cloudflare: skills sí, MCP no conectados"
          tone="info"
        />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Qué queda</CardTitle>
          <CardDescription>
            Context7 ya está desbloqueado. Cloudflare sigue sin MCP.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-2">
          <ol className="list-decimal space-y-3 pl-5 text-sm">
            <li>
              La clave de Context7 ya es válida por REST. Si el MCP del chat
              sigue en cuota anónima, no crees otra: usa un agente nuevo (o
              recarga MCP) con el secreto{" "}
              <code className="font-mono text-xs">CONTEXT7_API_KEY</code>.
            </li>
            <li>
              En Cursor Desktop, abre Customize → MCP y autentica los servidores
              Cloudflare (docs, bindings, builds, observability).
            </li>
          </ol>
          <div className="rounded-lg bg-muted/60 p-4 font-mono text-xs leading-relaxed text-muted-foreground">
            {`.cursor/mcp.json
  context7 → mcp.context7.com
    header CONTEXT7_API_KEY
  cloudflare-docs
  cloudflare-bindings
  cloudflare-builds
  cloudflare-observability`}
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Servidores MCP</CardTitle>
            <CardDescription>
              {mcpCounts.ok} operativos · {mcpCounts.action} requieren acción
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DiagnosticList items={mcps} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Plugins</CardTitle>
            <CardDescription>
              {pluginCounts.ok} operativos · {pluginCounts.partial} parciales
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DiagnosticList items={plugins} />
          </CardContent>
        </Card>
      </section>

      <Separator />

      <footer className="pb-6 text-sm text-muted-foreground">
        La API key de Context7 no está en el repositorio. Cloudflare sigue
        pendiente de OAuth en Cursor Desktop.
      </footer>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  hint,
  tone = "ok",
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "ok" | "warn" | "info";
}) {
  const valueColor =
    tone === "warn"
      ? "text-amber-700 dark:text-amber-400"
      : tone === "info"
        ? "text-sky-700 dark:text-sky-400"
        : "text-emerald-700 dark:text-emerald-400";

  return (
    <Card>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className={`text-3xl tabular-nums ${valueColor}`}>{value}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}
