import type { Metadata } from "next";

import { LatencyCalibration } from "@/components/calibration/latency-calibration";

export const metadata: Metadata = {
  title: "Calibrar latencia",
};

export default function CalibrationPage() {
  return <LatencyCalibration />;
}
