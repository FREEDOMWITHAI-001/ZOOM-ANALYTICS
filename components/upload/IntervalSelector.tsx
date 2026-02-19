"use client";
import React from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Clock } from "lucide-react";
import { motion } from "framer-motion";

interface IntervalSelectorProps {
  timeInterval: string;
  onTimeIntervalChange: (value: string) => void;
  customInterval: string;
  onCustomIntervalChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  showCustomInterval: boolean;
  onApplyCustomInterval: () => void;
}

const IntervalSelector: React.FC<IntervalSelectorProps> = ({
  timeInterval,
  onTimeIntervalChange,
  customInterval,
  onCustomIntervalChange,
  showCustomInterval,
  onApplyCustomInterval
}) => {
  return (
    <motion.div
      className="space-y-3"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
    >
      <Label
        htmlFor="time-interval"
        className="text-base font-medium flex items-center gap-2"
      >
        <Clock className="h-4 w-4 text-primary" />
        Time Interval
      </Label>
      <div className="flex items-center gap-2">
        <Select value={timeInterval} onValueChange={onTimeIntervalChange}>
          <SelectTrigger className="w-full bg-background/50 border-border/50 focus:ring-primary/30">
            <SelectValue placeholder="Select time interval" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">1 minute</SelectItem>
            <SelectItem value="5">5 minutes</SelectItem>
            <SelectItem value="10">10 minutes</SelectItem>
            <SelectItem value="30">30 minutes</SelectItem>
            <SelectItem value="60">1 hour</SelectItem>
            <SelectItem value="custom">Custom</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      {showCustomInterval && (
        <div className="flex items-center gap-2 mt-2">
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
    </motion.div>
  );
};

export default IntervalSelector;