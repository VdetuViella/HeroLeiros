/**
 * El worklet fecha cada golpe en frames del `AudioContext` (reloj de render).
 * El juez trabaja con el reloj «lo que se oye» (`AudioEngine.heardTime`), que
 * va por detrás del de render lo que tarda la salida. Para pasar de uno a otro
 * se resta ese retraso de salida (medido en el hilo principal y filtrado) y la
 * latencia de entrada que declara el navegador; el resto lo cubre la
 * calibración del micrófono.
 */
export function micTimeToHeardTime(contextTime: number, outputDelay: number, inputLatency: number): number {
  return contextTime - outputDelay - inputLatency;
}

/**
 * Mediana móvil de `currentTime − heardTime()`. Cada muestra tiene varios ms
 * de ruido (el `currentTime` avanza a saltos de bloque), la mediana lo aplana.
 */
export class OutputDelayTracker {
  private readonly values: number[] = [];

  constructor(private readonly size = 31) {}

  add(delay: number): void {
    if (!Number.isFinite(delay) || delay < 0 || delay > 1) return;
    this.values.push(delay);
    if (this.values.length > this.size) this.values.shift();
  }

  get value(): number {
    if (this.values.length === 0) return 0;
    const sorted = [...this.values].sort((a, b) => a - b);
    const mid = sorted.length >> 1;
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }
}
