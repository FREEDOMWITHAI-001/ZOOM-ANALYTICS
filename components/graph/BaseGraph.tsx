"use client";
import React from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { GraphType } from "./GraphControls";
import SignificantPoints from "./SignificantPoints";
import { DataPoint } from "@/lib/csv/types";

interface BaseGraphProps {
  chartData: any[];
  avgRetention: number;
  significantPoints: any[];
  graphType: GraphType;
  showSpikes: boolean;
  showDrops: boolean;
  webinar1Name: string;
  webinar2Name: string;
  isComparisonMode: boolean;
  onPointClick?: (point: { time: string; participants: number; webinarName?: string }) => void;
}

const BaseGraph: React.FC<BaseGraphProps> = ({
  chartData,
  avgRetention,
  significantPoints,
  graphType,
  showSpikes,
  showDrops,
  webinar1Name,
  webinar2Name,
  isComparisonMode,
  onPointClick,
}) => {
  // FIXED: Enhanced chart click handler
  const handleChartClick = (data: any) => {
    if (!data || !data.activePayload || !onPointClick) {
      return;
    }

    console.log("📊 Chart clicked:", data);
    
    const payload = data.activePayload[0].payload;
    const dataKey = data.activePayload[0].dataKey || webinar1Name;
    
    if (payload && payload.time) {
      const point = {
        time: payload.time,
        participants: payload[dataKey] || payload.participants || payload.retention || 0,
        webinarName: dataKey
      };
      console.log("📊 Point clicked:", point);
      onPointClick(point);
    }
  };

  // FIXED: Handle bar click specifically
  const handleBarClick = (data: any, webinarName: string) => {
    if (!data || !onPointClick) return;
    
    console.log("📊 Bar clicked:", data, webinarName);
    
    const point = {
      time: data.time,
      participants: data[webinarName] || data.participants || data.retention || 0,
      webinarName: webinarName
    };
    console.log("📊 Point from bar:", point);
    onPointClick(point);
  };

  const sharedProps = {
    data: chartData,
    margin: { top: 20, right: 30, left: 20, bottom: 20 },
  };

  const cartesianGrid = (
    <CartesianGrid
      strokeDasharray="3 3"
      stroke="#374151"
      opacity={0.2}
    />
  );

  const xAxis = (
    <XAxis 
      dataKey="time" 
      stroke="#6B7280" 
      angle={-45}
      textAnchor="end"
      height={80}
      minTickGap={40}
    />
  );

  const yAxis = <YAxis stroke="#6B7280" />;

  const tooltip = (
    <Tooltip
      contentStyle={{
        backgroundColor: "rgba(17, 24, 39, 0.8)",
        borderColor: "#4B5563",
        borderRadius: "0.375rem",
      }}
      labelStyle={{ color: "#E5E7EB" }}
      itemStyle={{ color: "#E5E7EB" }}
      formatter={(value: any, name: string) => {
        if (name.includes("Leavers")) {
          return [value, "Left in this interval"];
        }
        return [value, name];
      }}
    />
  );

  const avgLine = (
    <ReferenceLine
      y={avgRetention}
      stroke="#666"
      strokeDasharray="3 3"
      label={{
        value: `Avg: ${avgRetention.toFixed(0)}`,
        position: "right",
        fill: "#666",
        fontSize: 12,
      }}
    />
  );

  const renderSignificantPoints = (
    <SignificantPoints
      significantPoints={significantPoints}
      showSpikes={showSpikes}
      showDrops={showDrops}
    />
  );

  const legend = <Legend />;

  const clickableDot = {
    r: 4,
    fill: "#8B5CF6",
    stroke: "#fff",
    strokeWidth: 2,
    onClick: (e: any) => {
      console.log("Dot clicked:", e);
    }
  };

  const clickableActiveDot = {
    r: 6,
    fill: "#1d4ed8",
    stroke: "#fff",
    strokeWidth: 2,
    onClick: (e: any) => {
      console.log("Active dot clicked:", e);
    }
  };

  const comparisonClickableDot = {
    r: 4,
    fill: "#EC4899",
    stroke: "#fff",
    strokeWidth: 2,
  };

  const comparisonClickableActiveDot = {
    r: 6,
    fill: "#be185d",
    stroke: "#fff",
    strokeWidth: 2,
  };

  switch (graphType) {
    case "line":
      return (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart 
            {...sharedProps}
            onClick={handleChartClick}
          >
            {cartesianGrid}
            {xAxis}
            {yAxis}
            {tooltip}
            {legend}
            {avgLine}
            <Line
              type="monotone"
              dataKey={webinar1Name}
              stroke="#8B5CF6"
              strokeWidth={2}
              dot={clickableDot}
              activeDot={clickableActiveDot}
              animationDuration={1000}
              onClick={(data) => console.log("Line clicked:", data)}
            />
            {isComparisonMode && (
              <Line
                type="monotone"
                dataKey={webinar2Name}
                stroke="#EC4899"
                strokeWidth={2}
                dot={comparisonClickableDot}
                activeDot={comparisonClickableActiveDot}
                animationDuration={1000}
              />
            )}
            {renderSignificantPoints}
          </LineChart>
        </ResponsiveContainer>
      );

    case "area":
      return (
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart 
            {...sharedProps}
            onClick={handleChartClick}
          >
            {cartesianGrid}
            {xAxis}
            {yAxis}
            {tooltip}
            {legend}
            {avgLine}
            <Area
              type="monotone"
              dataKey={webinar1Name}
              stroke="#8B5CF6"
              fill="#8B5CF6"
              fillOpacity={0.3}
              strokeWidth={2}
              dot={clickableDot}
              activeDot={clickableActiveDot}
              animationDuration={1000}
            />
            {isComparisonMode && (
              <Area
                type="monotone"
                dataKey={webinar2Name}
                stroke="#EC4899"
                fill="#EC4899"
                fillOpacity={0.3}
                strokeWidth={2}
                dot={comparisonClickableDot}
                activeDot={comparisonClickableActiveDot}
                animationDuration={1000}
              />
            )}
            {renderSignificantPoints}
          </AreaChart>
        </ResponsiveContainer>
      );

    case "bar":
    default:
      return (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart 
            {...sharedProps}
            onClick={handleChartClick}
          >
            {cartesianGrid}
            {xAxis}
            {yAxis}
            {tooltip}
            {legend}
            {avgLine}
            <Bar
              dataKey={webinar1Name}
              fill="#8B5CF6"
              radius={[4, 4, 0, 0]}
              barSize={20}
              animationDuration={1000}
              onClick={(data) => handleBarClick(data, webinar1Name)}
            />
            {isComparisonMode && (
              <Bar
                dataKey={webinar2Name}
                fill="#EC4899"
                radius={[4, 4, 0, 0]}
                barSize={20}
                animationDuration={1000}
                onClick={(data) => handleBarClick(data, webinar2Name)}
              />
            )}
            {renderSignificantPoints}
          </BarChart>
        </ResponsiveContainer>
      );
  }
};

export default BaseGraph;