"use client";
import React, { useEffect } from "react";
import AIAnalysisPanel from "../AIAnalysisPanel";
import { Button } from "../ui/button";
import { Loader2, Lightbulb } from "lucide-react";




interface AISectionProps {
  showAIAnalysis: boolean;
  insights: string[];
  recommendations: string[];
  comparisonInsights: string[];
  comparisonRecommendations: string[];
  isAnalyzing: boolean;
  isComparisonMode: boolean;
  webinar1Name: string;
  webinar2Name: string;
  onAnalyze: () => Promise<void>;
  peakInsights?: string[];
  dropInsights?: string[];
  timeFrame?: number;
  hasCaptionData?: boolean;

  // New props
  peaks?: any[];
  dropoffs?: any[];
  totalAttendees?: number;
  averageRetention?: number;
  captionSegments?: any[];
  retentionData?: any[];
  comparisonPeaks?: any[];
  comparisonDropoffs?: any[];

  zoomAnalyticsData?: any;

}

const AISection: React.FC<AISectionProps> = ({
  showAIAnalysis,
  insights,
  recommendations,
  comparisonInsights,
  comparisonRecommendations,
  isAnalyzing,
  isComparisonMode,
  webinar1Name,
  webinar2Name,
  onAnalyze,
  peakInsights = [],
  dropInsights = [],
  timeFrame = 5,
  hasCaptionData = false,

  // New props
  peaks = [],
  dropoffs = [],
  totalAttendees = 0,
  averageRetention = 0,
    retentionData = [],
  comparisonPeaks = [],
  comparisonDropoffs = [],
  zoomAnalyticsData,
}) => {

const [fullTranscript, setFullTranscript] = React.useState<string>("");
const [transcriptReady, setTranscriptReady] = React.useState(false);


useEffect(() => {
  if (!zoomAnalyticsData?.meeting_id) return;

  fetch(`/api/transcript-direct/${zoomAnalyticsData.meeting_id}`)
    .then(res => res.json())
    .then(data => {
      if (data.success && data.content) {
        setFullTranscript(data.content);
        setTranscriptReady(data.content.length > 100);
        console.log("Transcript loaded from backend");
      }
    })
    .catch(err => {
      console.error("Transcript fetch failed", err);
      setTranscriptReady(false);
    });
}, [zoomAnalyticsData]);





  console.log("AISection -> zoomAnalyticsData:", zoomAnalyticsData);

  // Extract pre-computed AI analysis from DB data
  const preComputedAI = zoomAnalyticsData?.overall_ai_analysis;
  const preComputedInsights: string[] = preComputedAI?.key_insights || [];
  const preComputedRecommendations: string[] = preComputedAI?.recommendations || [];

  return (
  <AIAnalysisPanel
  meetingId={zoomAnalyticsData?.meeting_id}
  peakInsights={peakInsights}
  dropInsights={dropInsights}
  comparisonInsights={isComparisonMode ? comparisonInsights : []}
  comparisonRecommendations={isComparisonMode ? comparisonRecommendations : []}
  onAnalyze={onAnalyze}
  isAnalyzing={isAnalyzing}
  isComparisonMode={isComparisonMode}
  webinar1Name={webinar1Name}
  webinar2Name={webinar2Name}
  timeFrame={timeFrame}
  hasCaptionData={transcriptReady}
  isAlwaysExpanded={true}

  peaks={peaks}
  dropoffs={dropoffs}
  totalAttendees={totalAttendees}
  averageRetention={averageRetention}

  comparisonPeaks={comparisonPeaks}
  comparisonDropoffs={comparisonDropoffs}

  transcriptText={fullTranscript}

  preComputedInsights={preComputedInsights}
  preComputedRecommendations={preComputedRecommendations}
/>


  );
};




export default AISection;
