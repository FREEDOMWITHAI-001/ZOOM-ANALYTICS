"use client";
import React from "react";
import { RetentionMetricsDebugger } from "../RetentionMetricsDebugger";

interface DebuggerSectionProps {
  showDebugger: boolean;
}

const DebuggerSection: React.FC<DebuggerSectionProps> = ({ showDebugger }) => {
  if (!showDebugger) return null;
  
  return (
    <div className="mb-6 border border-primary/20 rounded-lg overflow-hidden">
      <RetentionMetricsDebugger />
    </div>
  );
};

export default DebuggerSection;