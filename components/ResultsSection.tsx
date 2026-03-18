"use client";
import React, { useState, useEffect, useRef, useMemo } from "react";
import { Alert, AlertDescription } from "./ui/alert";
import { AlertCircle, Loader2, BarChart2 } from "lucide-react";
import ComparisonUploadModal from "./ComparisonUploadModal";
import { motion } from "framer-motion";
import { GraphType } from "./graph/GraphControls";

// Import refactored components
import StatisticsSection from "./results/StatisticsSection";
import ResultsHeader from "./results/ResultsHeader";
import GraphSection from "./results/GraphSection";
import DebuggerSection from "./results/DebuggerSection";
import InsightsSection from "./results/InsightsSection";
import AISection from "./results/AISection";
import FooterSection from "./results/FooterSection";
import LoadingSection from "./results/LoadingSection";
import ErrorSection from "./results/ErrorSection";
import EmptyState from "./results/EmptyState";
import { CaptionSegment } from "@/lib/captions/caption-parser";
import ExtraDataVisualization from "./results/ExtraDataVisualization";

// Import the data processor hook
import { useResultsDataProcessor } from "./results/ResultsDataProcessor";

// Import window aggregation utility
import {
  aggregateMinuteData,
  matchTranscriptMoment,
  type TranscriptMoment,
  type RawEngagementGraph,
} from "@/lib/csv/window-aggregation";

// UPDATE ResultsSection props to accept timeInterval and onIntervalChange
interface ResultsSectionProps {
  isVisible?: boolean;
  attendanceData: File | null;
  transcriptData: File | null;
  zoomAnalyticsData?: any;
  timeInterval?: string;
  onIntervalChange?: (interval: string) => void;
  onExportResults: () => void;
  onShareResults: () => void;
  onComparisonUpload: (attendanceFile: File | null, transcriptFile: File | null) => void;
  onReanalyze: () => void;
  selectedMeetingId?: string;
}

// ========== MAIN RESULTS SECTION COMPONENT ==========

const ResultsSection = ({
  isVisible = true,
  attendanceData = null,
  transcriptData = null,
  zoomAnalyticsData = null,
  timeInterval = "5",
  onIntervalChange = () => {},
  onExportResults = () => {},
  onShareResults = () => {},
  onComparisonUpload = () => {},
  onReanalyze = () => {},
  selectedMeetingId,
}: ResultsSectionProps) => {
  // Use local state for timeInterval instead of prop for better control
  const [localTimeInterval, setLocalTimeInterval] = useState(timeInterval);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [customInterval, setCustomInterval] = useState("");
  const [showCustomInterval, setShowCustomInterval] = useState(false);
  const [showAIAnalysis, setShowAIAnalysis] = useState(false);
  const [showDebugger, setShowDebugger] = useState(false);
  const [isComparisonMode, setIsComparisonMode] = useState(false);
  const [showComparisonUploadModal, setShowComparisonUploadModal] = useState(false);
  const [comparisonAttendanceFile, setComparisonAttendanceFile] = useState<File | null>(null);
  const [comparisonTranscriptFile, setComparisonTranscriptFile] = useState<File | null>(null);
  const [webinar1Name, setWebinar1Name] = useState("Current Webinar");
  const [webinar2Name, setWebinar2Name] = useState("Comparison Webinar");
  const [graphType, setGraphType] = useState<GraphType>("line");
  
  // AI Analysis state
  const [peakInsights, setPeakInsights] = useState<string[]>([]);
  const [dropInsights, setDropInsights] = useState<string[]>([]);
  const [hasCaptionData, setHasCaptionData] = useState(false);
  
  const [transcriptSegments, setTranscriptSegments] = useState<
  { time: string; start_time?: number; text: string }[]
>([]);
  
  // Track initial statistics to keep them static
  const [initialStatistics, setInitialStatistics] = useState({
    totalAttendees: 0,
    peakRetention: 0,
    averageRetention: 0,
    peakParticipants: 0,
    averageParticipants: 0,
    peaks: [] as any[],
    dropoffs: [] as any[],
    insights: [] as string[],
    recommendations: [] as string[],
  });

  // Track if this is the initial load
  const initialLoadRef = useRef(true);
  const [isInitialDataLoaded, setIsInitialDataLoaded] = useState(false);
  
  // Track graph loading state
  const [isGraphLoading, setIsGraphLoading] = useState(false);
  // Track previous graph data to detect when it actually changes
  const [previousGraphData, setPreviousGraphData] = useState<any[]>([]);
  
  // Use the data processor hook to process attendance data
  const {
    isLoading: isDataLoading,
    error,
    retentionData: processedRetentionData,
    comparisonRetentionData,
    totalAttendees: processedTotalAttendees,
    peakRetention: processedPeakRetention,
    averageRetention: processedAverageRetention,
    peakParticipants: processedPeakParticipants,
    averageParticipants: processedAverageParticipants,
    peaks: processedPeaks,
    dropoffs: processedDropoffs,
    insights: processedInsights,
    recommendations: processedRecommendations,
    comparisonInsights,
    comparisonRecommendations,
    captionData: dataCaptionData,
    generateSampleData,
    countryData,
    extraColumnsData,
    enabledExtraColumns,
    toggleExtraColumn
  } = useResultsDataProcessor({
    attendanceFile: attendanceData,
    transcriptFile: transcriptData,
    comparisonAttendanceFile: comparisonAttendanceFile,
    timeInterval: localTimeInterval, // Use localTimeInterval for graph
    isComparisonMode,
  });

  // Compute aggregated data from minute-level Zoom graph
  const zoomAggregated = useMemo(() => {
    if (!zoomAnalyticsData?.engagement_graph) return null;

    const graph = zoomAnalyticsData.engagement_graph as RawEngagementGraph;
    const isMinuteLevel = graph.granularity === "minute" || (graph.granularity_minutes === 1);
    const windowMinutes = parseInt(localTimeInterval) || 5;

    const transcriptMoments: TranscriptMoment[] =
      zoomAnalyticsData.transcript_moments ||
      zoomAnalyticsData.overall_ai_analysis?.transcript_moments ||
      [];

    if (isMinuteLevel) {
      const agg = aggregateMinuteData(graph, windowMinutes);

      // Enrich peaks/dropoffs with AI descriptions from transcript_moments
      const enrichedPeaks = agg.peaks.map((p) => ({
        ...p,
        description: matchTranscriptMoment(
          transcriptMoments,
          p.bucketStartMinute,
          p.bucketEndMinute,
          "peak",
          p.percentageChange
        ),
      }));
      const enrichedDropoffs = agg.dropoffs.map((d) => ({
        ...d,
        description: matchTranscriptMoment(
          transcriptMoments,
          d.bucketStartMinute,
          d.bucketEndMinute,
          "dropoff",
          d.percentageChange
        ),
      }));

      const graphData = agg.labels.map((label, i) => ({
        time: label,
        participants: agg.active[i],
        retention: 0,
      }));

      return { graphData, peaks: enrichedPeaks, dropoffs: enrichedDropoffs, isMinuteLevel: true };
    }

    // Legacy pre-bucketed data — use as-is
    const graphData = graph.labels.map((label: string, index: number) => ({
      time: label,
      participants: graph.active_participants?.[index] || 0,
      retention: 0,
    }));

    return {
      graphData,
      peaks: zoomAnalyticsData.peaks || [],
      dropoffs: zoomAnalyticsData.dropoffs || [],
      isMinuteLevel: false,
    };
  }, [zoomAnalyticsData, localTimeInterval]);

  // Memoize graph data based on time interval
  const graphRetentionData = useMemo(() => {
    console.log(`🔄 Recalculating graph data for interval: ${localTimeInterval}`);
    if (zoomAnalyticsData) {
      return zoomAggregated?.graphData || [];
    }
    return processedRetentionData;
  }, [zoomAnalyticsData, zoomAggregated, localTimeInterval, processedRetentionData]);

  // Effect to detect when graph data actually updates and stop loading
  useEffect(() => {
    // Check if graph data has actually changed from previous state
    const hasGraphDataChanged = JSON.stringify(graphRetentionData) !== JSON.stringify(previousGraphData);
    
    if (hasGraphDataChanged && isGraphLoading) {
      console.log(`✅ Graph data updated for interval: ${localTimeInterval}`);
      console.log(`📊 Graph data length: ${graphRetentionData.length}`);
      console.log(`🔄 Previous data length: ${previousGraphData.length}`);
      
      // Update previous graph data
      setPreviousGraphData(graphRetentionData);
      
      // Stop loading when graph data is ready
      setIsGraphLoading(false);
    }
  }, [graphRetentionData, isGraphLoading]);

  // Initialize previous graph data on first load
  useEffect(() => {
    if (graphRetentionData.length > 0 && previousGraphData.length === 0) {
      setPreviousGraphData(graphRetentionData);
    }
  }, [graphRetentionData]);

  // Use static statistics (only update on initial load)
  const statistics = useMemo(() => {
    if (isInitialDataLoaded) {
      return initialStatistics;
    }
    
    // For Zoom data, extract initial statistics
    if (zoomAnalyticsData && initialLoadRef.current) {
      const total = zoomAnalyticsData?.total_participants || 0;
      const peakConcurrent = zoomAnalyticsData?.peak_concurrent_users || zoomAnalyticsData?.peak_retention || 0;
      const avgRetention = zoomAnalyticsData?.average_retention || 0;
      const zoomStats = {
        totalAttendees: total,
        peakRetention: zoomAnalyticsData?.peak_retention_pct || (total > 0 ? Math.round((peakConcurrent / total) * 100) : 0),
        averageRetention: avgRetention,
        peakParticipants: peakConcurrent,
        averageParticipants: total > 0 ? Math.round((avgRetention / 100) * total) : 0,
        // peaks/dropoffs start empty — they're computed dynamically via zoomAggregated
        peaks: [],
        dropoffs: [],
        insights: [],
        recommendations: []
      };
      
      setInitialStatistics(zoomStats);
      setIsInitialDataLoaded(true);
      initialLoadRef.current = false;
      return zoomStats;
    }
    
    // For CSV data, extract initial statistics
    if (!isDataLoading && processedTotalAttendees > 0 && initialLoadRef.current) {
      const csvStats = {
        totalAttendees: processedTotalAttendees,
        peakRetention: processedPeakRetention,
        averageRetention: processedAverageRetention,
        peakParticipants: processedPeakParticipants,
        averageParticipants: processedAverageParticipants,
        peaks: processedPeaks,
        dropoffs: processedDropoffs,
        insights: processedInsights,
        recommendations: processedRecommendations
      };
      
      setInitialStatistics(csvStats);
      setIsInitialDataLoaded(true);
      initialLoadRef.current = false;
      return csvStats;
    }
    
    return initialStatistics;
  }, [
    isDataLoading, 
    isInitialDataLoaded,
    zoomAnalyticsData,
    processedTotalAttendees,
    processedPeakRetention,
    processedAverageRetention,
    processedPeakParticipants,
    processedAverageParticipants,
    processedPeaks,
    processedDropoffs,
    processedInsights,
    processedRecommendations
  ]);

  // Sync localTimeInterval with prop when prop changes
  useEffect(() => {
    if (timeInterval !== localTimeInterval) {
      console.log(`🔄 Syncing localTimeInterval from prop: ${timeInterval}`);
      setLocalTimeInterval(timeInterval);
    }
  }, [timeInterval]);

  // Reset initial load flag when new data arrives
  useEffect(() => {
    if (attendanceData || zoomAnalyticsData) {
      initialLoadRef.current = true;
      setIsInitialDataLoaded(false);
    }
  }, [attendanceData, zoomAnalyticsData]);

  // UPDATE: Handle interval change - update local state only, not parent
  const handleIntervalChange = (value: string) => {
    if (value === "custom") {
      setShowCustomInterval(true);
    } else {
      setShowCustomInterval(false);
      console.log(`🔄 Time interval changed to: ${value} minutes`);
      
      // Only start loading if interval is actually changing
      if (localTimeInterval !== value) {
        // Show loading only on graph
        setIsGraphLoading(true);
      }
      
      // Update local state only - this will trigger the graph to re-render
      setLocalTimeInterval(value);
      // Notify parent (for Zoom API calls)
      onIntervalChange(value);
    }
  };

  // Handle custom interval change
  const handleCustomIntervalChange = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    setCustomInterval(e.target.value);
  };

  // UPDATE: Apply custom interval - update local state only
  const applyCustomInterval = () => {
    if (customInterval && !isNaN(Number(customInterval))) {
      console.log(`🔄 Applying custom interval: ${customInterval} minutes`);
      
      // Only start loading if interval is actually changing
      if (localTimeInterval !== customInterval) {
        // Show loading only on graph
        setIsGraphLoading(true);
      }
      
      // Update local state only
      setLocalTimeInterval(customInterval);
      // Notify parent (for Zoom API calls)
      onIntervalChange(customInterval);
      setShowCustomInterval(false);
    }
  };

  // Handle comparison upload
  const handleComparisonUpload = (
    attendanceFile: File | null,
    transcriptFile: File | null,
  ) => {
    setComparisonAttendanceFile(attendanceFile);
    setComparisonTranscriptFile(transcriptFile);
    setIsComparisonMode(true);
    onComparisonUpload(attendanceFile, transcriptFile);
  };

  // Handle analyze function (placeholder)
  const handleAnalyze = async (progressCallback?: (progress: {stage: string, progress: number, message: string}) => void) => {
    setIsAnalyzing(true);
    try {
      // AI analysis logic would go here
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      console.error('Error during AI analysis:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Handle export results
  const handleExportResults = () => {
    // Create a CSV with the retention data
    const csvRows = [
      ["Time", "Participants"],
      ...graphRetentionData.map((point) => [
        point.time,
        point.participants.toString(),
      ]),
    ];

    if (isComparisonMode && comparisonRetentionData.length > 0) {
      csvRows[0].push("Comparison Participants");
      comparisonRetentionData.forEach((point, index) => {
        if (index < csvRows.length - 1) {
          csvRows[index + 1].push(point.participants.toString());
        }
      });
    }

    const csvContent = csvRows.map((row) => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "webinar_retention_data.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isVisible) return null;

  // If no data has been uploaded yet, show a message
  if (!attendanceData && !zoomAnalyticsData && !isDataLoading) {
    return (
      <section className="w-full max-w-7xl mx-auto p-6 glass-card rounded-xl shadow-xl dark:shadow-primary/5">
        <EmptyState attendanceData={attendanceData} />
      </section>
    );
  }

  // Show loading only on initial data load
  if (isDataLoading && initialLoadRef.current) {
    return (
      <section className="w-full max-w-7xl mx-auto p-6 glass-card rounded-xl shadow-xl dark:shadow-primary/5">
        <LoadingSection 
          isLoading={true}
          stage={"Processing Webinar Data"} 
          message={"Analyzing attendance patterns and generating insights..."}
        />
      </section>
    );
  }

  return (
    <section className="w-full max-w-7xl mx-auto p-6 glass-card rounded-xl shadow-xl dark:shadow-primary/5">
      <ErrorSection 
        error={error} 
        onReanalyze={onReanalyze} 
        onUseSampleData={generateSampleData} 
      />

      <ResultsHeader 
        timeInterval={localTimeInterval} // Pass localTimeInterval instead of prop
        isComparisonMode={isComparisonMode}
        webinar1Name={webinar1Name}
        webinar2Name={webinar2Name}
        onIntervalChange={handleIntervalChange}
        onCustomIntervalChange={handleCustomIntervalChange}
        onApplyCustomInterval={applyCustomInterval}
        onShowDebuggerToggle={() => setShowDebugger(!showDebugger)}
        showDebugger={showDebugger}
        onReanalyze={onReanalyze}
        onComparisonUpload={() => setShowComparisonUploadModal(true)}
        onExitComparisonMode={() => setIsComparisonMode(false)}
        onExportResults={handleExportResults}
        onShareResults={onShareResults}
        customInterval={customInterval}
        showCustomInterval={showCustomInterval}
      />

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="space-y-8"
      >
        {/* Debugger */}
        <DebuggerSection showDebugger={showDebugger} />

        {/* Statistics Cards - Use static statistics that don't change with interval */}
        <StatisticsSection 
          totalAttendees={statistics.totalAttendees}
          peakRetention={statistics.peakRetention}
          averageRetention={statistics.averageRetention}
          peakParticipants={statistics.peakParticipants}
          averageParticipants={statistics.averageParticipants}
        />

        {/* Retention Graph - Only this updates when interval changes */}
        <div className="relative">
          {/* Graph loading overlay - only shows when changing intervals */}
          {isGraphLoading && (
            <div className="absolute inset-0 bg-white/80 dark:bg-gray-900/80 flex items-center justify-center z-10 rounded-lg backdrop-blur-sm">
              <div className="text-center p-4">
                <div className="h-10 w-10 rounded-full border-4 border-t-transparent border-primary animate-spin mx-auto mb-3"></div>
                <p className="text-lg font-medium mb-1">Updating Graph</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Recalculating with {localTimeInterval}-minute intervals...
                </p>
              </div>
            </div>
          )}
          
          <GraphSection 
            retentionData={graphRetentionData}
            comparisonRetentionData={comparisonRetentionData}
            isComparisonMode={isComparisonMode}
            webinar1Name={webinar1Name}
            webinar2Name={webinar2Name}
            graphType={graphType}
            onGraphTypeChange={setGraphType}
            captionData={dataCaptionData || []}
            transcriptData={zoomAnalyticsData?.transcript}
            meetingId={selectedMeetingId}
            onTranscriptReady={setTranscriptSegments}
          />
        </div>
        
        {/* Insights Table - Dynamic peaks/dropoffs for Zoom data */}
        <InsightsSection
          peaks={zoomAggregated ? zoomAggregated.peaks : statistics.peaks}
          dropoffs={zoomAggregated ? zoomAggregated.dropoffs : statistics.dropoffs}
          comparisonPeaks={[]}
          comparisonDropoffs={[]}
          isComparisonMode={isComparisonMode}
          webinar1Name={webinar1Name}
          webinar2Name={webinar2Name}
          transcriptSegments={transcriptSegments}
        />

        {/* Extra Columns Visualization */}
        <ExtraDataVisualization
          countryData={countryData}
          extraColumnsData={extraColumnsData}
          enabledExtraColumns={enabledExtraColumns}
          toggleExtraColumn={toggleExtraColumn}
        />

        {/* AI Analysis Panel */}
        <div className="mt-6">
          <AISection
            showAIAnalysis={showAIAnalysis}
            isAnalyzing={isAnalyzing}
            onAnalyze={handleAnalyze}
            peakInsights={peakInsights}
            dropInsights={dropInsights}
            insights={statistics.insights}
            recommendations={statistics.recommendations}
            comparisonInsights={comparisonInsights}
            comparisonRecommendations={comparisonRecommendations}
            timeFrame={parseInt(localTimeInterval) || 5}
            hasCaptionData={hasCaptionData}
            isComparisonMode={isComparisonMode}
            webinar1Name={webinar1Name}
            webinar2Name={webinar2Name}

            // Pass dynamic peaks/dropoffs
            peaks={zoomAggregated ? zoomAggregated.peaks : statistics.peaks}
            dropoffs={zoomAggregated ? zoomAggregated.dropoffs : statistics.dropoffs}
            totalAttendees={statistics.totalAttendees}
            averageRetention={statistics.averageRetention}
            captionSegments={dataCaptionData}
            retentionData={graphRetentionData}
            zoomAnalyticsData={zoomAnalyticsData}
            transcriptMoments={
              zoomAnalyticsData?.transcript_moments ||
              zoomAnalyticsData?.overall_ai_analysis?.transcript_moments ||
              []
            }
          />
        </div>
      </motion.div>

      <FooterSection 
        retentionData={graphRetentionData}
        isComparisonMode={isComparisonMode}
        comparisonRetentionData={comparisonRetentionData}
      />

      {/* Comparison Upload Modal */}
      <ComparisonUploadModal
        isOpen={showComparisonUploadModal}
        onClose={() => setShowComparisonUploadModal(false)}
        onUploadComplete={handleComparisonUpload}
      />
    </section>
  );
};

export default ResultsSection;