"use client";
import React from "react";

interface FooterSectionProps {
  retentionData: { time: string; participants: number }[];
  isComparisonMode: boolean;
  comparisonRetentionData: { time: string; participants: number }[];
}

const FooterSection: React.FC<FooterSectionProps> = ({
  retentionData,
  isComparisonMode,
  comparisonRetentionData,
}) => {
  return (
    <div className="mt-8 pt-4 border-t border-border/40 text-sm text-muted-foreground">
      <p>
        Analysis based on data from {retentionData.length} time intervals
        {retentionData.length > 0 &&
          ` spanning ${retentionData[retentionData.length - 1].time} minutes`}
        {isComparisonMode && comparisonRetentionData.length > 0 && (
          <span className="ml-2">
            | Comparison data from {comparisonRetentionData.length} time
            intervals
          </span>
        )}
      </p>
    </div>
  );
};

export default FooterSection;