"use client";
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "../lib/utils";
import {
  Info,
  Users,
} from "lucide-react";
import { motion } from "framer-motion";
import { DataPoint } from "@/lib/csv/types";
import { CaptionSegment } from "@/lib/captions/caption-parser";

// Import refactored components
import BaseGraph from "./graph/BaseGraph";
import GraphControls, { GraphType } from "./graph/GraphControls";
import GraphLegend from "./graph/GraphLegend";
import useGraphConfiguration from "./graph/useGraphConfiguration";

// UPDATE: Add onPointClick to props interface
interface RetentionGraphProps {
  data?: DataPoint[];
  comparisonData?: DataPoint[];
  title?: string;
  description?: string;
  maxParticipants?: number;
  loading?: boolean;
  isComparisonMode?: boolean;
  webinar1Name?: string;
  webinar2Name?: string;
  graphType?: GraphType;
  onGraphTypeChange?: (type: GraphType) => void;
  captionData?: CaptionSegment[];
  onPointClick?: (point: { time: string; participants: number; webinarName?: string }) => void; // ADD THIS LINE
}

const RetentionGraph = ({
  data = [
    { time: "00:00", participants: 50 },
    { time: "05:00", participants: 48 },
    { time: "10:00", participants: 45 },
    { time: "15:00", participants: 42 },
    { time: "20:00", participants: 40 },
    { time: "25:00", participants: 38 },
    { time: "30:00", participants: 35 },
    { time: "35:00", participants: 30 },
    { time: "40:00", participants: 28 },
    { time: "45:00", participants: 25 },
    { time: "50:00", participants: 22 },
    { time: "55:00", participants: 20 },
    { time: "60:00", participants: 18 },
  ],
  comparisonData = [],
  title = "Participant Retention Over Time",
  description = "This graph shows how many participants remained in the webinar over time.",
  maxParticipants = 60,
  loading = false,
  isComparisonMode = false,
  webinar1Name = "Webinar 1",
  webinar2Name = "Webinar 2",
  graphType: externalGraphType = "line",
  onGraphTypeChange: externalGraphTypeChange = () => {},
  captionData = [],
  onPointClick, // ADD THIS LINE
}: RetentionGraphProps) => {
  // Use the custom hook for graph configuration
  const {
    showSpikes,
    setShowSpikes,
    showDrops,
    setShowDrops,
    sensitivity,
    setSensitivity,
    showSettings,
    setShowSettings,
    graphType,
    setGraphType,
    chartData,
    significantPoints,
    avgRetention,
    significantPointsCount
  } = useGraphConfiguration({
    data,
    comparisonData,
    isComparisonMode,
    maxParticipants,
    webinar1Name,
    webinar2Name,
    captionData,
  });

  // Sync internal and external state
  React.useEffect(() => {
    setGraphType(externalGraphType);
  }, [externalGraphType]);

  const handleGraphTypeChange = (type: GraphType) => {
    setGraphType(type);
    externalGraphTypeChange(type);
  };

  const renderLoadingState = () => (
    <div className="flex h-64 items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary"></div>
    </div>
  );

  const renderGraphContent = () => {
    if (loading) {
      return renderLoadingState();
    }

    return (
      <BaseGraph
        chartData={chartData}
        avgRetention={avgRetention}
        significantPoints={significantPoints}
        graphType={graphType}
        showSpikes={showSpikes}
        showDrops={showDrops}
        webinar1Name={webinar1Name}
        webinar2Name={webinar2Name}
        isComparisonMode={isComparisonMode}
        onPointClick={onPointClick} // ADD THIS LINE - Pass the click handler to BaseGraph
      />
    );
  };

  return (
    <Card className="w-full glass-card shadow-lg dark:shadow-primary/5 overflow-hidden bg-card">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-purple-500/5 pointer-events-none" />
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-full bg-primary/10 dark:bg-primary/20">
              <Users size={18} className="text-primary" />
            </div>
            <CardTitle className="text-xl font-bold">{title}</CardTitle>
          </div>
          <div className="flex items-center gap-4">
            <GraphControls
              graphType={graphType}
              onGraphTypeChange={handleGraphTypeChange}
              showSettings={showSettings}
              setShowSettings={setShowSettings}
              showSpikes={showSpikes}
              setShowSpikes={setShowSpikes}
              showDrops={showDrops}
              setShowDrops={setShowDrops}
              sensitivity={sensitivity}
              setSensitivity={setSensitivity}
              significantPointsCount={significantPointsCount}
            />

            <GraphLegend
              isComparisonMode={isComparisonMode && comparisonData.length > 0}
              webinar1Name={webinar1Name}
              webinar2Name={webinar2Name}
            />
            
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="text-muted-foreground hover:text-foreground transition-colors">
                    <Info size={18} />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="bg-card/90 backdrop-blur-sm border-border/50">
                  <p className="max-w-xs">{description}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </CardHeader>
      <CardContent>{renderGraphContent()}</CardContent>
    </Card>
  );
};

export default RetentionGraph;