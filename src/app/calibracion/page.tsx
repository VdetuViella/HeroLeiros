import type { Metadata } from "next";

import { LatencyCalibration } from "@/components/calibration/latency-calibration";

export const metadata: Metadata = {
  title: "Calibrar latencia",
};

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

const KINDS = ["teclado", "tactil", "microfono"] as const;

export default async function CalibrationPage({ searchParams }: { searchParams: SearchParams }) {
  const { entrada } = await searchParams;
  const initialKind = KINDS.find((kind) => kind === entrada) ?? "teclado";
  return <LatencyCalibration key={initialKind} initialKind={initialKind} />;
}
