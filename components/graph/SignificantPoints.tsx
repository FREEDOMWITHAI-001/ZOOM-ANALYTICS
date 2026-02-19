"use client";
import React from "react";
import { ReferenceLine } from "recharts";

interface SignificantPoint {
  time: string;
  value: number;
  type: "spike" | "drop";
  change: number;
  impact: number;
}

interface SignificantPointsProps {
  significantPoints: SignificantPoint[];
  showSpikes: boolean;
  showDrops: boolean;
}

const SignificantPoints: React.FC<SignificantPointsProps> = ({
  significantPoints,
  showSpikes,
  showDrops
}) => {
  return (
    <>
      {significantPoints
        .filter(
          (point) =>
            (point.type === "spike" && showSpikes) ||
            (point.type === "drop" && showDrops),
        )
        .map((point, index) => {
          const isSpike = point.type === "spike";
          const color = isSpike ? "#059669" : "#dc2626";
          const yOffset = -20 - (index % 3) * 20;

          return (
            <React.Fragment key={index}>
              <ReferenceLine
                x={point.time}
                stroke={color}
                strokeWidth={2}
              />
              <ReferenceLine
                x={point.time}
                label={{
                  value: `${isSpike ? "↑" : "↓"} ${point.value.toFixed(0)}`,
                  position: "top",
                  fill: color,
                  fontSize: 12,
                  fontWeight: "bold",
                  offset: yOffset,
                }}
              />
            </React.Fragment>
          );
        })}
    </>
  );
};

export default SignificantPoints;