"use client";
import React from "react";

interface GraphLegendProps {
  isComparisonMode: boolean;
  webinar1Name: string;
  webinar2Name: string;
}

const GraphLegend: React.FC<GraphLegendProps> = ({
  isComparisonMode,
  webinar1Name,
  webinar2Name
}) => {
  if (!isComparisonMode) return null;
  
  return (
    <div className="flex items-center gap-3 text-sm">
      <div className="flex items-center gap-1">
        <div className="w-3 h-3 rounded-full bg-primary"></div>
        <span>{webinar1Name}</span>
      </div>
      <div className="flex items-center gap-1">
        <div className="w-3 h-3 rounded-full bg-purple-500"></div>
        <span>{webinar2Name}</span>
      </div>
    </div>
  );
};

export default GraphLegend;