import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { StatusBadge } from "@/components/status-badge";
import type { DiagnosticItem } from "@/data/diagnostics";

export function DiagnosticList({ items }: { items: DiagnosticItem[] }) {
  const defaultOpen = items.filter((item) => item.health !== "ok").map((item) => item.id);

  return (
    <Accordion multiple defaultValue={defaultOpen} className="w-full">
      {items.map((item) => (
        <AccordionItem key={item.id} value={item.id}>
          <AccordionTrigger className="items-center gap-3 py-3 hover:no-underline">
            <span className="flex min-w-0 flex-1 items-center gap-3">
              <span
                aria-hidden
                className={
                  item.health === "ok"
                    ? "size-2 shrink-0 rounded-full bg-emerald-500"
                    : item.health === "action"
                      ? "size-2 shrink-0 rounded-full bg-amber-500"
                      : "size-2 shrink-0 rounded-full bg-sky-500"
                }
              />
              <span className="truncate font-medium">{item.name}</span>
            </span>
            <StatusBadge health={item.health} />
          </AccordionTrigger>
          <AccordionContent>
            <dl className="grid gap-2 text-sm text-muted-foreground">
              <div>
                <dt className="font-medium text-foreground">Origen</dt>
                <dd>{item.source}</dd>
              </div>
              <div>
                <dt className="font-medium text-foreground">Prueba</dt>
                <dd className="font-mono text-xs">{item.probe}</dd>
              </div>
              <div>
                <dt className="font-medium text-foreground">Resultado</dt>
                <dd>{item.detail}</dd>
              </div>
              {item.fix ? (
                <div>
                  <dt className="font-medium text-foreground">Cómo repararlo</dt>
                  <dd>{item.fix}</dd>
                </div>
              ) : null}
            </dl>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
