"use client";
import React from "react";
import { BarChart2 } from "lucide-react";

interface EmptyStateProps {
  attendanceData: File | null;
}

const EmptyState: React.FC<EmptyStateProps> = ({ attendanceData }) => {
  if (attendanceData) return null;
  
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <BarChart2 className="h-16 w-16 text-muted-foreground mb-4" />
      <h2 className="text-2xl font-bold mb-2">No Data to Analyze</h2>
      <p className="text-muted-foreground max-w-md mb-6">
        Please upload a Zoom attendance CSV file to see analysis results.
      </p>
    </div>
  );
};

export default EmptyState;