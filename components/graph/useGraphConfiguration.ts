import { useState, useMemo, useEffect, useCallback } from 'react';
import { DataPoint } from '@/lib/csv/types';
import { GraphType } from './GraphControls';
import { CaptionSegment, findCaptionsInTimeRange, extractTextFromCaptions, getTimeWindowAroundEvent } from '@/lib/captions/caption-parser';
import { analyzeEngagementMoment } from '@/services/openai-service';

interface SignificantPoint {
  time: string;
  value: number;
  type: "spike" | "drop";
  change: number;
  impact: number;
}

// Helper: extract minutes from various time formats safely
function safeGetMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  // Handle range "HH:MM-HH:MM" — use start
  const rangeMatch = timeStr.match(/^(\d{1,2}):(\d{2})\s*[-–]/);
  if (rangeMatch) return Number(rangeMatch[1]) * 60 + Number(rangeMatch[2]);
  // Handle "MM-DD HH:MM"
  if (timeStr.includes('-') && timeStr.includes(' ')) {
    const timePart = timeStr.split(' ')[1];
    if (timePart && timePart.includes(':')) {
      const [h, m] = timePart.split(':').map(Number);
      return (h || 0) * 60 + (m || 0);
    }
  }
  // Handle "HH:MM"
  if (timeStr.includes(':')) {
    const [h, m] = timeStr.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  }
  return 0;
}

interface UseGraphConfigurationProps {
  data: DataPoint[];
  comparisonData: DataPoint[];
  isComparisonMode: boolean;
  maxParticipants?: number;
  webinar1Name: string;
  webinar2Name: string;
  captionData?: CaptionSegment[];
}

export const useGraphConfiguration = ({
  data,
  comparisonData,
  isComparisonMode,
  maxParticipants = 60,
  webinar1Name,
  webinar2Name,
  captionData,
}: UseGraphConfigurationProps) => {
  const [hoveredPoint, setHoveredPoint] = useState<{
    data: DataPoint;
    isComparison?: boolean;
  } | null>(null);
  
  const [showSpikes, setShowSpikes] = useState(true);
  const [showDrops, setShowDrops] = useState(true);
  const [sensitivity, setSensitivity] = useState(5);
  const [showSettings, setShowSettings] = useState(false);
  const [graphType, setGraphType] = useState<GraphType>("line");
  
  // States for caption analysis
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [peakInsights, setPeakInsights] = useState<string[]>([]);
  const [dropInsights, setDropInsights] = useState<string[]>([]);

  // Calculate metrics and significant points using memoization for performance
  const {
    highestParticipantCount,
    chartData,
    significantPoints,
    avgRetention,
  } = useMemo(() => {
    // Calculate the highest number of participants to scale the graph
    const highest = Math.max(
      ...data.map((point) => point.participants),
      ...(isComparisonMode && comparisonData.length > 0
        ? comparisonData.map((point) => point.participants)
        : [0]),
      maxParticipants,
    );

    // Calculate average retention
    const avg =
      data.reduce((sum, point) => sum + point.participants, 0) / data.length;

    // Enhanced time label formatting with proper parsing
    const formatTimeLabel = (timeStr: string) => {
      if (!timeStr) return '00:00';

      // Handle range format "HH:MM-HH:MM" — use the start of the range
      const rangeMatch = timeStr.match(/^(\d{1,2}:\d{2})\s*[-–]\s*\d{1,2}:\d{2}$/);
      if (rangeMatch) {
        const [hours, minutes] = rangeMatch[1].split(':').map(num => num.padStart(2, '0'));
        return `${hours}:${minutes}`;
      }

      // Check if time contains a date (MM-DD HH:MM format)
      if (timeStr.includes('-') && timeStr.includes(' ')) {
        const parts = timeStr.split(' ');
        if (parts.length === 2 && parts[1].includes(':')) {
          const [hours, minutes] = parts[1].split(':').map(num => num.padStart(2, '0'));
          return `${hours}:${minutes}`;
        }
      }

      // For HH:MM format
      if (timeStr.includes(':')) {
        const [hours, minutes] = timeStr.split(':').map(num => num.padStart(2, '0'));
        return `${hours}:${minutes}`;
      }

      // For numerical minutes, convert to HH:MM format
      const minutes = parseInt(timeStr);
      if (!isNaN(minutes)) {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
      }

      return timeStr;
    };

    // Prepare data for recharts with leavers count
    const prepared = data.map((point, index) => {
      const comparisonPoint =
        isComparisonMode && comparisonData.length > 0
          ? comparisonData.find((p) => p.time === point.time)
          : null;

      // Calculate leavers (people who left since the previous interval)
      let leaversCount = 0;
      if (index > 0) {
        const previousCount = data[index - 1].participants;
        const currentCount = point.participants;
        leaversCount = Math.max(0, previousCount - currentCount);
      }

      return {
        time: formatTimeLabel(point.time),
        [webinar1Name]: point.participants,
        [`${webinar1Name} Leavers`]: leaversCount,
        ...(comparisonPoint
          ? {
              [webinar2Name]: comparisonPoint.participants,
              [`${webinar2Name} Leavers`]:
                index > 0 && comparisonData[index - 1]
                  ? Math.max(
                      0,
                      comparisonData[index - 1].participants -
                        comparisonPoint.participants,
                    )
                  : 0,
            }
          : {}),
      };
    });

    // Enhanced significant points detection with adaptive thresholds
    const windowSize = 3;
    const significant: SignificantPoint[] = [];
    const baselineThreshold = Math.max(5, sensitivity); // Minimum threshold of 5 participants
    const percentageThreshold = sensitivity / 100; // Convert sensitivity to percentage

    for (let i = windowSize; i < data.length - windowSize; i++) {
      const beforeWindow = data.slice(i - windowSize, i);
      const afterWindow = data.slice(i + 1, i + 1 + windowSize);
      const current = data[i];

      const avgBefore =
        beforeWindow.reduce((sum, p) => sum + p.participants, 0) / windowSize;
      const avgAfter =
        afterWindow.reduce((sum, p) => sum + p.participants, 0) / windowSize;
      const currentValue = current.participants;

      // Calculate both absolute and percentage changes
      const changeFromBefore = currentValue - avgBefore;
      const changeToAfter = currentValue - avgAfter;
      const percentageChangeFromBefore = Math.abs(changeFromBefore / avgBefore);

      // Adaptive threshold based on current participant count
      const adaptiveThreshold = Math.max(
        baselineThreshold,
        currentValue * percentageThreshold
      );

      // Enhanced detection logic for spikes and drops
      if (Math.abs(changeFromBefore) >= adaptiveThreshold || 
          percentageChangeFromBefore >= percentageThreshold) {
        
        // A spike is when the current value is significantly higher
        const isSpike = changeFromBefore > 0 && 
                       changeToAfter > 0 && 
                       currentValue > avgBefore * (1 + percentageThreshold);
        
        // A drop is when the current value is significantly lower
        const isDrop = changeFromBefore < 0 && 
                      changeToAfter < 0 && 
                      currentValue < avgBefore * (1 - percentageThreshold);

        if (isSpike || isDrop) {
          significant.push({
            time: current.time,
            value: currentValue,
            type: isSpike ? "spike" : "drop",
            change: Math.abs(changeFromBefore),
            impact: (Math.abs(changeFromBefore) / avg) * 100,
          });
        }
      }
    }

    // Enhanced filtering of significant points with smarter proximity detection
    const filteredPoints = significant.reduce((acc, point) => {
      const tooClose = acc.some((p) => {
        const timeAMinutes = safeGetMinutes(p.time);
        const timeBMinutes = safeGetMinutes(point.time);

        // Dynamic proximity threshold based on total session duration
        const sessionDuration = Math.max(
          ...data.map(d => safeGetMinutes(d.time)),
          1
        );
        const proximityThreshold = Math.max(10, Math.floor(sessionDuration * 0.1));

        // Check both time proximity and impact similarity
        const timeProximity = Math.abs(timeAMinutes - timeBMinutes) < proximityThreshold;
        const impactSimilarity = Math.abs(p.impact - point.impact) < 20; // 20% threshold

        return timeProximity && impactSimilarity;
      });

      if (!tooClose) {
        acc.push(point);
      }
      return acc;
    }, [] as SignificantPoint[]);

    return {
      highestParticipantCount: highest,
      chartData: prepared,
      significantPoints: filteredPoints,
      avgRetention: avg,
    };
  }, [
    data,
    comparisonData,
    isComparisonMode,
    maxParticipants,
    webinar1Name,
    webinar2Name,
    sensitivity,
  ]);

  // Calculate significant points counts
  const significantPointsCount = useMemo(() => {
    return {
      spikes: significantPoints.filter(p => p.type === 'spike').length,
      drops: significantPoints.filter(p => p.type === 'drop').length
    };
  }, [significantPoints]);
  
  // Function to analyze captions at significant points
  const analyzeCaptionsForInsights = useCallback(async () => {
    // Don't analyze if there are no captions or no significant points
    if (!captionData || captionData.length === 0) {
      console.log('No caption data available for analysis');
      return;
    }
    
    if (significantPoints.length === 0) {
      console.log('No significant points to analyze');
      return;
    }
    
    setIsAnalyzing(true);
    
    try {
      // Get the top 5 peaks and drops
      const peaks = significantPoints
        .filter(p => p.type === 'spike')
        .sort((a, b) => b.impact - a.impact)
        .slice(0, 5);
      
      const drops = significantPoints
        .filter(p => p.type === 'drop')
        .sort((a, b) => b.impact - a.impact)
        .slice(0, 5);
      
      // Process peaks first
      const peakAnalysisResults = await Promise.all(peaks.map(async (peak) => {
        try {
          // Convert time string to Date object for timestamp comparison
          // HH:MM format to Date
          const peakTime = new Date();
          const peakMinutes = safeGetMinutes(peak.time);
          peakTime.setHours(Math.floor(peakMinutes / 60), peakMinutes % 60, 0, 0);
          
          // Get time window around peak (default 2 minutes before and after)
          const { startTime, endTime } = getTimeWindowAroundEvent(peakTime);
          
          // Find captions in this time range
          const relevantCaptions = findCaptionsInTimeRange(captionData, startTime, endTime);
          const captionText = extractTextFromCaptions(relevantCaptions);
          
          if (!captionText || captionText.trim().length === 0) {
            return 'No captions available during this time period';
          }
          
          console.log(`Analyzing peak at ${peak.time} with ${relevantCaptions.length} caption segments`);
          
          // Call OpenAI for analysis
          const analysis = await analyzeEngagementMoment({
            captionText,
            type: 'peak',
            timePoint: peak.time,
            attendeeCount: peak.value
          });
          
          if (analysis.error) {
            console.error(`Error analyzing peak at ${peak.time}:`, analysis.error);
            return `Error: ${analysis.error}`;
          }
          
          return analysis.analysis;
        } catch (error) {
          console.error(`Error analyzing peak at ${peak.time}:`, error);
          return 'Error during analysis';
        }
      }));
      
      // Process drops
      const dropAnalysisResults = await Promise.all(drops.map(async (drop) => {
        try {
          // Convert time string to Date object
          const dropTime = new Date();
          const dropMinutes = safeGetMinutes(drop.time);
          dropTime.setHours(Math.floor(dropMinutes / 60), dropMinutes % 60, 0, 0);
          
          // Get time window around drop
          const { startTime, endTime } = getTimeWindowAroundEvent(dropTime);
          
          // Find captions in this time range
          const relevantCaptions = findCaptionsInTimeRange(captionData, startTime, endTime);
          const captionText = extractTextFromCaptions(relevantCaptions);
          
          if (!captionText || captionText.trim().length === 0) {
            return 'No captions available during this time period';
          }
          
          console.log(`Analyzing drop at ${drop.time} with ${relevantCaptions.length} caption segments`);
          
          // Call OpenAI for analysis
          const analysis = await analyzeEngagementMoment({
            captionText,
            type: 'drop',
            timePoint: drop.time,
            attendeeCount: Math.abs(drop.value)
          });
          
          if (analysis.error) {
            console.error(`Error analyzing drop at ${drop.time}:`, analysis.error);
            return `Error: ${analysis.error}`;
          }
          
          return analysis.analysis;
        } catch (error) {
          console.error(`Error analyzing drop at ${drop.time}:`, error);
          return 'Error during analysis';
        }
      }));
      
      setPeakInsights(peakAnalysisResults);
      setDropInsights(dropAnalysisResults);
      
    } catch (error) {
      console.error('Error during caption analysis:', error);
    } finally {
      setIsAnalyzing(false);
    }
  }, [captionData, significantPoints]);
  
  // Effect to trigger analysis when captions are loaded and significant points are available
  useEffect(() => {
    // Only run analysis if we have both captions and significant points
    // This allows the main UI to load first without being blocked by analysis
    if (captionData && captionData.length > 0 && significantPoints.length > 0) {
      // Clear previous insights
      setPeakInsights([]);
      setDropInsights([]);
      
      // Use a small delay to ensure the UI has time to update first
      const analysisTimeout = setTimeout(() => {
        analyzeCaptionsForInsights();
      }, 500);
      
      return () => clearTimeout(analysisTimeout);
    }
  }, [captionData, significantPoints, analyzeCaptionsForInsights]);

  return {
    hoveredPoint,
    setHoveredPoint,
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
    highestParticipantCount,
    chartData,
    significantPoints,
    avgRetention,
    significantPointsCount,
    // New caption analysis fields
    isAnalyzing,
    peakInsights,
    dropInsights,
    hasCaptionData: captionData && captionData.length > 0
  };
};

export default useGraphConfiguration;