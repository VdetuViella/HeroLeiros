/**
 * FFT radix-2 iterativa, sin reservar memoria por llamada: está pensada para
 * ejecutarse cientos de veces por segundo dentro del AudioWorklet.
 */
export class FFT {
  readonly size: number;
  private readonly cos: Float64Array;
  private readonly sin: Float64Array;
  private readonly reversed: Uint32Array;
  private readonly re: Float64Array;
  private readonly im: Float64Array;

  constructor(size: number) {
    if (size < 2 || (size & (size - 1)) !== 0) throw new Error(`FFT: el tamaño debe ser potencia de 2 (recibido ${size}).`);
    this.size = size;
    this.cos = new Float64Array(size / 2);
    this.sin = new Float64Array(size / 2);
    for (let i = 0; i < size / 2; i++) {
      this.cos[i] = Math.cos((-2 * Math.PI * i) / size);
      this.sin[i] = Math.sin((-2 * Math.PI * i) / size);
    }
    const bits = Math.log2(size);
    this.reversed = new Uint32Array(size);
    for (let i = 0; i < size; i++) {
      let r = 0;
      for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b);
      this.reversed[i] = r;
    }
    this.re = new Float64Array(size);
    this.im = new Float64Array(size);
  }

  /**
   * Escribe en `out` las magnitudes de los bins 0..size/2 de la señal real
   * `input` (longitud `size`).
   */
  magnitudes(input: ArrayLike<number>, out: Float64Array): void {
    const { size, re, im, reversed } = this;
    for (let i = 0; i < size; i++) {
      re[reversed[i]] = input[i];
      im[reversed[i]] = 0;
    }
    for (let len = 2; len <= size; len <<= 1) {
      const half = len >> 1;
      const step = size / len;
      for (let start = 0; start < size; start += len) {
        for (let k = 0; k < half; k++) {
          const wr = this.cos[k * step];
          const wi = this.sin[k * step];
          const a = start + k;
          const b = a + half;
          const tr = re[b] * wr - im[b] * wi;
          const ti = re[b] * wi + im[b] * wr;
          re[b] = re[a] - tr;
          im[b] = im[a] - ti;
          re[a] += tr;
          im[a] += ti;
        }
      }
    }
    for (let k = 0; k <= size / 2; k++) out[k] = Math.hypot(re[k], im[k]);
  }
}

export function hannWindow(size: number): Float64Array {
  const window = new Float64Array(size);
  for (let i = 0; i < size; i++) window[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / size);
  return window;
}
