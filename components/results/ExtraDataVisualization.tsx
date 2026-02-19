"use client";
import React, { useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Info, Globe, Layers, ChevronDown, ChevronUp, MapPin } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

// Define color palette for pie charts - using higher contrast colors
const COLORS = [
  "#4f46e5", "#0ea5e9", "#10b981", "#84cc16", "#eab308", 
  "#f97316", "#ef4444", "#ec4899", "#8b5cf6", "#a855f7", 
  "#d946ef", "#6366f1", "#14b8a6", "#65a30d", "#fbbf24"
];

// Maximum number of segments to show in each pie chart
const MAX_SEGMENTS = 8;

// Custom Legend for pie charts
const CustomLegend = ({ payload }: any) => {
  return (
    <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mt-4 max-w-full px-2">
      {payload.map((entry: any, index: number) => (
        <div key={`legend-${index}`} className="flex items-center gap-2">
          <div 
            className="w-3 h-3 rounded-full" 
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-sm font-medium truncate max-w-[150px]">
            {entry.value}
          </span>
        </div>
      ))}
    </div>
  );
};

interface ExtraDataVisualizationProps {
  countryData: { label: string; value: number }[];
  extraColumnsData: {
    columns: string[];
    data: Record<string, { label: string; value: number }[]>;
  };
  enabledExtraColumns: string[];
  toggleExtraColumn: (column: string) => void;
}

const ExtraDataVisualization: React.FC<ExtraDataVisualizationProps> = ({
  countryData,
  extraColumnsData,
  enabledExtraColumns,
  toggleExtraColumn,
}) => {
  // State to track expanded view for each visualization
  const [expandedView, setExpandedView] = useState<Record<string, boolean>>({
    countries: false
  });

  // Add each extra column to expandedView state with initial false value
  extraColumnsData.columns.forEach(column => {
    if (expandedView[column] === undefined) {
      expandedView[column] = false;
    }
  });

  // Function to toggle expanded view
  const toggleExpandedView = (key: string) => {
    setExpandedView(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Function to prepare and group data for visualization
  const prepareChartData = (data: { label: string; value: number }[], expanded: boolean) => {
    // If no need to group, return original or limited data
    if (data.length <= MAX_SEGMENTS || expanded) {
      return data;
    }

    // Sort data by value (descending)
    const sortedData = [...data].sort((a, b) => b.value - a.value);
    
    // Take the top MAX_SEGMENTS-1 items
    const topItems = sortedData.slice(0, MAX_SEGMENTS - 1);
    
    // Group the rest into "Others"
    const otherItems = sortedData.slice(MAX_SEGMENTS - 1);
    const otherValue = otherItems.reduce((sum, item) => sum + item.value, 0);
    
    return [
      ...topItems,
      { label: "Others", value: otherValue }
    ];
  };

  // Helper function to format pie chart labels
  const formatPieLabel = (entry: any) => {
    const percent = Math.round(entry.percent * 100);
    if (percent < 3) return null; // Don't show labels for small segments
    return `${percent}%`;
  };

  // Calculate total for each dataset
  const countryTotal = countryData.reduce((sum, item) => sum + item.value, 0);

  // Get visualization mode (either pie charts or bar charts based on data shape)
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="w-full space-y-6"
    >
      {/* Extra columns toggles */}
      {extraColumnsData.columns.length > 0 && (
        <Card className="glass-card shadow-lg dark:shadow-primary/5 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-purple-500/5 pointer-events-none" />
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-full bg-primary/10 dark:bg-primary/20">
                <Layers size={18} className="text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg font-semibold">
                  Additional Data Columns
                </CardTitle>
                <CardDescription className="text-sm text-muted-foreground">
                  Toggle the switches below to show or hide data visualizations
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              {extraColumnsData.columns.map((column) => (
                <div key={column} className="flex items-center space-x-2 bg-muted/30 p-2 px-3 rounded-lg">
                  <Switch
                    id={`toggle-${column}`}
                    checked={enabledExtraColumns.includes(column)}
                    onCheckedChange={() => toggleExtraColumn(column)}
                  />
                  <Label htmlFor={`toggle-${column}`} className="font-medium">{column}</Label>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Country distribution chart */}
      {countryData.length > 0 && (
        <Card className="glass-card shadow-lg dark:shadow-primary/5 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-purple-500/5 pointer-events-none" />
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-full bg-primary/10 dark:bg-primary/20">
                  <Globe size={18} className="text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg font-semibold">
                    Attendee Country Distribution
                  </CardTitle>
                  <CardDescription>
                    {countryData.length} {countryData.length === 1 ? 'country' : 'countries'} detected
                  </CardDescription>
                </div>
              </div>

              {countryData.length > MAX_SEGMENTS && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => toggleExpandedView('countries')}
                  className="flex items-center gap-1"
                >
                  {expandedView.countries ? (
                    <>View Less <ChevronUp size={14} /></>
                  ) : (
                    <>View All <ChevronDown size={14} /></>
                  )}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="pie" className="w-full">
              <TabsList className="mb-4 grid w-[200px] grid-cols-2">
                <TabsTrigger value="pie">Pie Chart</TabsTrigger>
                <TabsTrigger value="list">List View</TabsTrigger>
              </TabsList>
              
              <TabsContent value="pie" className="space-y-4">
                <div className="h-[450px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart margin={{ top: 30, right: 30, bottom: 30, left: 30 }}>
                      <Pie
                        data={prepareChartData(countryData, expandedView.countries)}
                        cx="50%"
                        cy="50%"
                        labelLine={true}
                        outerRadius={120}
                        innerRadius={60}
                        fill="#8884d8"
                        dataKey="value"
                        nameKey="label"
                        label={formatPieLabel}
                        paddingAngle={1}
                      >
                        {prepareChartData(countryData, expandedView.countries).map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={COLORS[index % COLORS.length]} 
                          />
                        ))}
                      </Pie>
                      <Tooltip 
                        formatter={(value: number, name: string) => [
                          `${value} attendees (${Math.round((value/countryTotal) * 100)}%)`, 
                          name
                        ]}
                        contentStyle={{
                          backgroundColor: "rgba(13, 17, 28, 0.95)",
                          borderColor: "#6366f1",
                          borderWidth: "2px",
                          borderRadius: "0.375rem",
                          padding: "10px 14px",
                          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
                          color: "#ffffff",
                          fontWeight: "500"
                        }}
                        itemStyle={{
                          color: "#ffffff"
                        }}
                        labelStyle={{
                          color: "#ffffff",
                          fontWeight: "600",
                          marginBottom: "4px"
                        }}
                      />
                      <Legend 
                        content={<CustomLegend />}
                        layout="horizontal"
                        verticalAlign="bottom" 
                        align="center"
                        wrapperStyle={{ paddingTop: "30px" }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </TabsContent>
              
              <TabsContent value="list">
                <div className="bg-card p-4 rounded-lg border border-border/50 max-h-[350px] overflow-y-auto">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[...countryData]
                      .sort((a, b) => b.value - a.value)
                      .map((item, index) => (
                        <div 
                          key={index} 
                          className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <span 
                              className="w-3 h-3 rounded-full" 
                              style={{ backgroundColor: COLORS[index % COLORS.length] }}
                            />
                            <span className="font-medium">{item.label || "Unknown"}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm">{item.value} attendees</span>
                            <Badge variant="outline">
                              {Math.round((item.value / countryTotal) * 100)}%
                            </Badge>
                          </div>
                        </div>
                    ))}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {/* Extra columns charts */}
      {extraColumnsData.columns
        .filter(column => enabledExtraColumns.includes(column))
        .map(column => {
          // Calculate total for this dataset
          const columnTotal = extraColumnsData.data[column].reduce((sum, item) => sum + item.value, 0);
          
          return (
            <Card key={column} className="glass-card shadow-lg dark:shadow-primary/5 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-purple-500/5 pointer-events-none" />
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-full bg-primary/10 dark:bg-primary/20">
                      <Info size={18} className="text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg font-semibold">
                        {column}
                      </CardTitle>
                      <CardDescription>
                        {extraColumnsData.data[column].length} different values detected
                      </CardDescription>
                    </div>
                  </div>

                  {extraColumnsData.data[column].length > MAX_SEGMENTS && (
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => toggleExpandedView(column)}
                      className="flex items-center gap-1"
                    >
                      {expandedView[column] ? (
                        <>View Less <ChevronUp size={14} /></>
                      ) : (
                        <>View All <ChevronDown size={14} /></>
                      )}
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="pie" className="w-full">
                  <TabsList className="mb-4 grid w-[200px] grid-cols-2">
                    <TabsTrigger value="pie">Pie Chart</TabsTrigger>
                    <TabsTrigger value="list">List View</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="pie" className="space-y-4">
                    <div className="h-[450px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart margin={{ top: 30, right: 30, bottom: 30, left: 30 }}>
                          <Pie
                            data={prepareChartData(extraColumnsData.data[column], expandedView[column])}
                            cx="50%"
                            cy="50%"
                            labelLine={true}
                            outerRadius={120}
                            innerRadius={60}
                            fill="#8884d8"
                            dataKey="value"
                            nameKey="label"
                            label={formatPieLabel}
                            paddingAngle={1}
                          >
                            {prepareChartData(extraColumnsData.data[column], expandedView[column])
                              .map((entry, index) => (
                                <Cell 
                                  key={`cell-${index}`} 
                                  fill={COLORS[index % COLORS.length]} 
                                />
                            ))}
                          </Pie>
                          <Tooltip 
                            formatter={(value: number, name: string) => [
                              `${value} attendees (${Math.round((value/columnTotal) * 100)}%)`, 
                              name
                            ]}
                            contentStyle={{
                              backgroundColor: "rgba(13, 17, 28, 0.95)",
                              borderColor: "#6366f1",
                              borderWidth: "2px",
                              borderRadius: "0.375rem",
                              padding: "10px 14px",
                              boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
                              color: "#ffffff",
                              fontWeight: "500"
                            }}
                            itemStyle={{
                              color: "#ffffff"
                            }}
                            labelStyle={{
                              color: "#ffffff",
                              fontWeight: "600",
                              marginBottom: "4px"
                            }}
                          />
                          <Legend 
                            content={<CustomLegend />}
                            layout="horizontal"
                            verticalAlign="bottom" 
                            align="center"
                            wrapperStyle={{ paddingTop: "30px" }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="list">
                    <div className="bg-card p-4 rounded-lg border border-border/50 max-h-[350px] overflow-y-auto">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {[...extraColumnsData.data[column]]
                          .sort((a, b) => b.value - a.value)
                          .map((item, index) => (
                            <div 
                              key={index} 
                              className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50 transition-colors"
                            >
                              <div className="flex items-center gap-2">
                                <span 
                                  className="w-3 h-3 rounded-full" 
                                  style={{ backgroundColor: COLORS[index % COLORS.length] }}
                                />
                                <span className="font-medium truncate max-w-[150px]">{item.label || "Unknown"}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm">{item.value} attendees</span>
                                <Badge variant="outline">
                                  {Math.round((item.value / columnTotal) * 100)}%
                                </Badge>
                              </div>
                            </div>
                        ))}
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          );
        })}
    </motion.div>
  );
};

export default ExtraDataVisualization; 