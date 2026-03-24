"use client";
import React, { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowDownIcon, ArrowUpIcon, TrendingUp, TrendingDown } from "lucide-react";
import { motion } from "framer-motion";

interface InsightItem {
  timeInterval: string;
  count: number;
  percentageChange: number;
  description?: string;
}

interface InsightsTableProps {
  peaks?: InsightItem[];
  dropoffs?: InsightItem[];
 transcriptSegments?: {
  time: string;
  start_time?: number;
  text: string;
}[];

}


const InsightsTable = ({
  peaks = [],
  dropoffs = [],
  transcriptSegments,
}: InsightsTableProps) => {

    const [aiDescriptions, setAiDescriptions] = useState<{ [key: string]: string }>({});

    // Pre-populate from DB descriptions that already exist on the items
    useEffect(() => {
      const preComputed: Record<string, string> = {};
      peaks.forEach(p => {
        if (p.description) {
          const key = `peak-${normalizeTime(p.timeInterval)}`;
          preComputed[key] = p.description;
        }
      });
      dropoffs.forEach(d => {
        if (d.description) {
          const key = `dropoff-${normalizeTime(d.timeInterval)}`;
          preComputed[key] = d.description;
        }
      });
      if (Object.keys(preComputed).length > 0) {
        setAiDescriptions(prev => ({ ...preComputed, ...prev }));
      }
    }, [peaks, dropoffs]);

    // expose AI reasons so Generate button can send to backend
useEffect(() => {
  if (Object.keys(aiDescriptions).length > 0) {
    (window as any).__PEAK_DROP_REASONS__ = aiDescriptions;
  }
}, [aiDescriptions]);

  const [isLoading, setIsLoading] = useState(false);

  // Extract start HH:MM from range format "HH:MM-HH:MM" or plain "HH:MM"
 const extractStartTime = (time: string): string => {
  if (!time) return "";
  const rangeMatch = time.match(/^(\d{1,2}:\d{2})\s*[-–]/);
  if (rangeMatch) return rangeMatch[1];
  return time;
};

  // Normalize time format
 const normalizeTime = (time: string): string => {
  if (!time) return "";
  const start = extractStartTime(time);

  const parts = start.split(":").map(p => p.trim());

  if (parts.length === 2) {
    const mm = parts[0].padStart(2, "0");
    const ss = parts[1].padStart(2, "0");
    return `${mm}:${ss}`;
  }

  return time;
};

const getTranscriptContext = (time: string) => {
  if (!transcriptSegments || transcriptSegments.length === 0) {
    return "";
  }

  const start = extractStartTime(time);
  const [mm, ss] = start.split(":").map(Number);
  const targetSeconds = mm * 60 + ss;

  const fromSeconds = Math.max(0, targetSeconds - 600);
  const toSeconds = targetSeconds + 120;

  const matched = transcriptSegments.filter(seg => {
    if (typeof seg.start_time === "number") {
      return seg.start_time >= fromSeconds && seg.start_time <= toSeconds;
    }

    if (seg.time) {
      const t = seg.time.split(":").map(Number);
      const segSeconds =
        t.length === 3
          ? t[0] * 3600 + t[1] * 60 + t[2]
          : t[0] * 60 + t[1];

      return segSeconds >= fromSeconds && segSeconds <= toSeconds;
    }

    return false;
  });

  console.log(
    `Matched ${matched.length} transcript segments for ${time}`
  );

  return matched.map(seg => seg.text).join(" ").slice(0, 1200);
};

console.log("transcriptSegments length:", transcriptSegments?.length);
console.log("peaks being sent:", peaks);


  // Generate AI insights
  const generateAIInsights = async () => {

  if (peaks.length === 0 && dropoffs.length === 0) return;


  setIsLoading(true);

  try {
    const response = await fetch(`/api/insights/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        peaks: peaks.slice(0, 5).map(p => ({
          timeInterval: normalizeTime(p.timeInterval),
          count: p.count,
          percentageChange: p.percentageChange,
          transcriptContext: getTranscriptContext(p.timeInterval)
        })),
        dropoffs: dropoffs.slice(0, 5).map(d => ({
          timeInterval: normalizeTime(d.timeInterval),
          count: d.count,
          percentageChange: d.percentageChange,
          transcriptContext: getTranscriptContext(d.timeInterval)
        }))
      }),
    });

    const data = await response.json();
    setAiDescriptions(prev => ({ ...prev, ...data }));

  } catch (err) {
    console.error(err);
  } finally {
    setIsLoading(false);
  }
};


  // Get AI description for an item
  const getAIDescription = (type: 'peak' | 'dropoff', timeInterval: string): string => {
    const normalizedTime = normalizeTime(timeInterval);
    const key = `${type}-${normalizedTime}`;

    return aiDescriptions[key] || "";
  };

const generationKey = JSON.stringify({
  peaks,
  dropoffs,
  transcriptSegments,
});

useEffect(() => {
  // Do not run until transcript is actually ready
  if (!transcriptSegments || transcriptSegments.length === 0) {
    console.log("Transcript not ready — waiting");
    return;
  }

  if (peaks.length === 0 && dropoffs.length === 0) return;

  // Skip OpenAI call if all items already have pre-computed descriptions from DB
  const allHaveDescriptions = [...peaks, ...dropoffs].every(item => !!item.description);
  if (allHaveDescriptions) {
    console.log("All items have pre-computed descriptions — skipping OpenAI call");
    return;
  }

  console.log("Transcript ready — generating AI insights");
  generateAIInsights();
}, [peaks, dropoffs, transcriptSegments?.length]);



  const hasPeaks = peaks.length > 0;
  const hasDropoffs = dropoffs.length > 0;

  if (!hasPeaks && !hasDropoffs) {
    return (
      <Card className="w-full glass-card shadow-lg overflow-hidden">
        <CardHeader>
          <div className="flex items-center gap-2">
            <TrendingUp className="text-primary" size={18} />
            <CardTitle>Engagement Insights</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground py-6">
            No engagement patterns detected.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full glass-card shadow-lg overflow-hidden">
      <CardHeader>
        <div className="flex items-center gap-2">
          <TrendingUp className="text-primary" size={18} />
          <CardTitle>Engagement Insights</CardTitle>
          <div className="ml-2 text-xs bg-primary/20 px-2 py-1 rounded-full flex items-center gap-1">
            <div className="h-2 w-2 rounded-full bg-primary animate-pulse"></div>
            AI-Powered
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="h-6 w-6 rounded-full border-2 border-t-transparent border-primary animate-spin mb-3"></div>
            <p className="text-muted-foreground">Generating AI insights...</p>
          </div>
        ) : (
          <Tabs defaultValue={hasPeaks ? "peaks" : "dropoffs"}>
            <TabsList className="grid grid-cols-2 mb-6 bg-background/50 p-1 rounded-lg">
              <TabsTrigger value="peaks">
                <TrendingUp className="h-4 w-4" /> Peaks
                <span className="ml-1 text-xs bg-primary/20 px-1.5 py-0.5 rounded-full">
                  {peaks.length}
                </span>
              </TabsTrigger>

              <TabsTrigger value="dropoffs">
                <TrendingDown className="h-4 w-4" /> Drop-offs
                <span className="ml-1 text-xs bg-primary/20 px-1.5 py-0.5 rounded-full">
                  {dropoffs.length}
                </span>
              </TabsTrigger>
            </TabsList>

            {/* PEAKS TAB */}
            <TabsContent value="peaks">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Participants</TableHead>
                    <TableHead>Change</TableHead>
                    <TableHead>AI Insight</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {peaks.map((item, i) => {
                    const aiDescription = getAIDescription('peak', item.timeInterval);

                    return (
                      <motion.tr key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                        <TableCell className="font-medium">{normalizeTime(item.timeInterval)}</TableCell>
                        <TableCell>{item.count}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-green-600">
                            <ArrowUpIcon className="h-4 w-4" />
                            {item.percentageChange}%
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {item.description || aiDescription || "Analyzing..."}
                        </TableCell>
                      </motion.tr>
                    );
                  })}
                </TableBody>
              </Table>
            </TabsContent>

            {/* DROPOFFS TAB */}
            <TabsContent value="dropoffs">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Participants</TableHead>
                    <TableHead>Change</TableHead>
                    <TableHead>AI Insight</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {dropoffs.map((item, i) => {
                    const aiDescription = getAIDescription('dropoff', item.timeInterval);

                    return (
                      <motion.tr key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                        <TableCell className="font-medium">{normalizeTime(item.timeInterval)}</TableCell>
                        <TableCell>{item.count}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-red-600">
                            <ArrowDownIcon className="h-4 w-4" />
                            {Math.abs(item.percentageChange)}%
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {item.description || aiDescription || "Analyzing..."}

                        </TableCell>
                      </motion.tr>
                    );
                  })}
                </TableBody>
              </Table>
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
};

export default InsightsTable;
