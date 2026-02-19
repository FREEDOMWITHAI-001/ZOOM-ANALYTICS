"use client";
import React from "react";
import InsightsTable from "../InsightsTable";

interface InsightItem {
  timeInterval: string;
  count: number;
  percentageChange: number;
  description?: string;
}

interface InsightsSectionProps {
  peaks: InsightItem[];
  dropoffs: InsightItem[];
  comparisonPeaks: InsightItem[];
  comparisonDropoffs: InsightItem[];
  isComparisonMode: boolean;
  webinar1Name: string;
  webinar2Name: string;

   transcriptSegments?: {
    time: string;
    start_time?: number;
    text: string;
  }[];
}



const InsightsSection: React.FC<InsightsSectionProps> = ({
  peaks,
  dropoffs,
  comparisonPeaks,
  comparisonDropoffs,
  isComparisonMode,
  webinar1Name,
  webinar2Name,
  transcriptSegments,
}) => {
  return (
    <div className="w-full">
     <InsightsTable
  peaks={peaks}
  dropoffs={dropoffs}
   transcriptSegments={transcriptSegments}
/>

    </div>
  );
};

export default InsightsSection;