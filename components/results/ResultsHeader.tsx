"use client";
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Settings,
  Upload,
  FilePlus2,
  BarChart,
  Download,
  Share2,
} from "lucide-react";
import { motion } from "framer-motion";

interface ResultsHeaderProps {
  timeInterval: string;
  isComparisonMode: boolean;
  webinar1Name: string;
  webinar2Name: string;
  onIntervalChange: (value: string) => void;
  onCustomIntervalChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onApplyCustomInterval: () => void;
  onShowDebuggerToggle: () => void;
  showDebugger: boolean;
  onReanalyze: () => void;
  onComparisonUpload: () => void;
  onExitComparisonMode: () => void;
  onExportResults: () => void;
  onShareResults: () => void;
  customInterval: string;
  showCustomInterval: boolean;
}

const ResultsHeader: React.FC<ResultsHeaderProps> = ({
  timeInterval,
  isComparisonMode,
  webinar1Name,
  webinar2Name,
  onIntervalChange,
  onCustomIntervalChange,
  onApplyCustomInterval,
  onShowDebuggerToggle,
  showDebugger,
  onReanalyze,
  onComparisonUpload,
  onExitComparisonMode,
  onExportResults,
  onShareResults,
  customInterval,
  showCustomInterval,
}) => {
  return (
    <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
      <div>
        <h2 className="text-2xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
          Analysis Results {isComparisonMode && "- Comparison Mode"}
        </h2>
        <p className="text-muted-foreground mt-1">
          Showing attendance analysis with {timeInterval} minute intervals
          {isComparisonMode && (
            <span className="ml-2 inline-flex items-center gap-2">
              <span className="inline-flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-full bg-primary"></span>
                {webinar1Name}
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-full bg-purple-500"></span>
                {webinar2Name}
              </span>
            </span>
          )}
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Label htmlFor="interval-select" className="text-sm whitespace-nowrap">
            Time Interval:
          </Label>
          <Select
            value={showCustomInterval ? "custom" : timeInterval}
            onValueChange={onIntervalChange}
          >
            <SelectTrigger
              id="interval-select"
              className="w-[120px] bg-background/50"
            >
              <SelectValue placeholder="5 minutes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1 minute</SelectItem>
              <SelectItem value="5">5 minutes</SelectItem>
              <SelectItem value="10">10 minutes</SelectItem>
              <SelectItem value="15">15 minutes</SelectItem>
              <SelectItem value="30">30 minutes</SelectItem>
              <SelectItem value="60">1 hour</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {showCustomInterval && (
          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={customInterval}
              onChange={onCustomIntervalChange}
              className="w-20 h-9 bg-background/50"
              min="1"
              placeholder="mins"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={onApplyCustomInterval}
              className="h-9 bg-background/50"
            >
              Apply
            </Button>
          </div>
        )}

        <div className="flex gap-2 ml-auto">
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-2 border-primary/20 hover:border-primary/40 bg-background/50 hover:bg-background/80"
              onClick={onShowDebuggerToggle}
            >
              <Settings size={16} className="text-primary" />
              {showDebugger ? "Hide Debugger" : "Show Debugger"}
            </Button>
          </motion.div>
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-2 border-primary/20 hover:border-primary/40 bg-background/50 hover:bg-background/80"
              onClick={onReanalyze}
            >
              <Upload size={16} className="text-primary" />
              Re-analyze
            </Button>
          </motion.div>
          {!isComparisonMode && (
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-2 border-primary/20 hover:border-primary/40 bg-background/50 hover:bg-background/80"
                onClick={onComparisonUpload}
              >
                <FilePlus2 size={16} className="text-primary" />
                Compare with Another Webinar
              </Button>
            </motion.div>
          )}
          {isComparisonMode && (
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-2 border-primary/20 hover:border-primary/40 bg-background/50 hover:bg-background/80"
                onClick={onExitComparisonMode}
              >
                <BarChart size={16} className="text-primary" />
                Exit Comparison Mode
              </Button>
            </motion.div>
          )}
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-2 border-primary/20 hover:border-primary/40 bg-background/50 hover:bg-background/80"
              onClick={onExportResults}
            >
              <Download size={16} className="text-primary" />
              Export
            </Button>
          </motion.div>
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-2 border-primary/20 hover:border-primary/40 bg-background/50 hover:bg-background/80"
              onClick={onShareResults}
            >
              <Share2 size={16} className="text-primary" />
              Share
            </Button>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default ResultsHeader;