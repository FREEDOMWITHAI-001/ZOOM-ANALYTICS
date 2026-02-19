"use client";
import React from "react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  BarChart,
  LineChart,
  AreaChart,
  Settings,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { motion } from "framer-motion";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export type GraphType = "bar" | "line" | "area";

interface GraphControlsProps {
  graphType: GraphType;
  onGraphTypeChange: (type: GraphType) => void;
  showSettings: boolean;
  setShowSettings: (show: boolean) => void;
  showSpikes: boolean;
  setShowSpikes: (show: boolean) => void;
  showDrops: boolean;
  setShowDrops: (show: boolean) => void;
  sensitivity: number;
  setSensitivity: (value: number) => void;
  significantPointsCount: {
    spikes: number;
    drops: number;
  };
}

const GraphControls: React.FC<GraphControlsProps> = ({
  graphType,
  onGraphTypeChange,
  showSettings,
  setShowSettings,
  showSpikes,
  setShowSpikes,
  showDrops,
  setShowDrops,
  sensitivity,
  setSensitivity,
  significantPointsCount,
}) => {
  // Graph type icons and handlers
  const graphTypeIcons = [
    { type: "bar" as GraphType, icon: BarChart, label: "Bar Chart" },
    { type: "line" as GraphType, icon: LineChart, label: "Line Chart" },
    { type: "area" as GraphType, icon: AreaChart, label: "Area Chart" },
  ];

  return (
    <>
      {/* Graph type selector */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 bg-background/50 p-1 rounded-md border border-border/50">
          {graphTypeIcons.map(({ type, icon: Icon, label }) => (
            <TooltipProvider key={type}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => onGraphTypeChange(type)}
                    className={cn(
                      "p-1.5 rounded-md transition-colors",
                      graphType === type
                        ? "bg-primary/20 text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-background/80",
                    )}
                  >
                    <Icon size={16} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>{label}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ))}
        </div>

        {/* Settings button */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setShowSettings(!showSettings)}
                className={cn(
                  "p-1.5 rounded-md transition-colors",
                  showSettings
                    ? "bg-primary/20 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/80",
                )}
              >
                <Settings size={16} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>Graph Settings</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="mt-4 p-4 bg-background/50 rounded-lg border border-border/50"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h4 className="text-sm font-medium">Highlight Options</h4>
              <div className="flex items-center gap-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="show-spikes"
                    checked={showSpikes}
                    onCheckedChange={setShowSpikes}
                  />
                  <Label
                    htmlFor="show-spikes"
                    className="flex items-center gap-1"
                  >
                    <TrendingUp className="h-4 w-4 text-green-500" />
                    <span>Spikes</span>
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="show-drops"
                    checked={showDrops}
                    onCheckedChange={setShowDrops}
                  />
                  <Label
                    htmlFor="show-drops"
                    className="flex items-center gap-1"
                  >
                    <TrendingDown className="h-4 w-4 text-red-500" />
                    <span>Drops</span>
                  </Label>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">Sensitivity</h4>
                <span className="text-xs text-muted-foreground">
                  {sensitivity}%
                </span>
              </div>
              <Slider
                value={[sensitivity]}
                min={3}
                max={15}
                step={1}
                onValueChange={(value) => setSensitivity(value[0])}
              />
              <p className="text-xs text-muted-foreground">
                {significantPointsCount.spikes + significantPointsCount.drops > 0 ? (
                  <>
                    Detected{" "}
                    {significantPointsCount.spikes}{" "}
                    spikes and{" "}
                    {significantPointsCount.drops}{" "}
                    drops
                  </>
                ) : (
                  <>No significant changes detected at current threshold</>
                )}
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </>
  );
};

export default GraphControls;