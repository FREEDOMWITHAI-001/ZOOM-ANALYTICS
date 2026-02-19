"use client";
import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatisticCardProps {
  title: string;
  value: string | number;
  bgColor?: string;
  textColor?: string;
  icon?: React.ReactNode;
}

const StatisticCard = ({
  title,
  value,
  bgColor = "bg-blue-50 dark:bg-blue-950/30",
  textColor = "text-blue-600 dark:text-blue-400",
  icon,
}: StatisticCardProps) => {
  return (
    <Card
      className={cn(
        "border-0 shadow-sm overflow-hidden transition-all duration-300",
        bgColor,
      )}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-1">
              {title}
            </p>
            <p className={cn("text-3xl font-bold tracking-tight", textColor)}>
              {value}
            </p>
          </div>
          {icon && <div className={cn("opacity-80", textColor)}>{icon}</div>}
        </div>
      </CardContent>
    </Card>
  );
};

export default StatisticCard;
