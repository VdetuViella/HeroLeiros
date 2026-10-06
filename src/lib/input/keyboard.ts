import type { HeardClock, HitListener, InputSource } from "./types";

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

export class KeyboardInputSource implements InputSource {
  readonly kind = "teclado" as const;
  readonly lanesAware = true;
  private listener: HitListener | null = null;
  private readonly onKeyDown = (event: KeyboardEvent) => {
    if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
    if (isTypingTarget(event.target)) return;
    const lane = this.keymap.indexOf(event.code);
    if (lane === -1 || !this.listener) return;
    event.preventDefault();
    this.listener({ lane, time: this.clock(event.timeStamp), source: this.kind });
  };

  constructor(
    private readonly keymap: string[],
    private readonly clock: HeardClock,
    private readonly target: Window = window,
  ) {}

  start(listener: HitListener): void {
    this.listener = listener;
    this.target.addEventListener("keydown", this.onKeyDown);
  }

  stop(): void {
    this.target.removeEventListener("keydown", this.onKeyDown);
    this.listener = null;
  }
}
