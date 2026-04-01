"use client";
import React, { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Loader2, Lightbulb, ChevronDown, ChevronUp, RefreshCw, CheckCircle } from "lucide-react";

interface AIAnalysisPanelProps {
  meetingId: string;

  isAnalyzing?: boolean;
  onAnalyze?: (progressCallback?: (progress: {stage: string, progress: number, message: string}) => void) => Promise<void>;
  peakInsights?: string[];
  dropInsights?: string[];
  timeFrame?: number;
  hasCaptionData?: boolean;
  shouldUpdateOnTimeFrameChange?: boolean;
  isComparisonMode?: boolean;
  comparisonInsights?: string[];
  comparisonRecommendations?: string[];
  webinar1Name?: string;
  webinar2Name?: string;
  isAlwaysExpanded?: boolean;


  // New props for AI analysis
  peaks?: any[];
  dropoffs?: any[];
  totalAttendees?: number;
  averageRetention?: number;
  captionSegments?: any[];
    comparisonPeaks?: any[];
  comparisonDropoffs?: any[];
  transcriptText?: string;

  // Pre-computed AI analysis from DB
  preComputedInsights?: string[];
  preComputedRecommendations?: string[];
}

const AIAnalysisPanel = ({
  meetingId,
  isAnalyzing = false,
  onAnalyze = async () => {},
  peakInsights = [],
  dropInsights = [],
  timeFrame = 5,
  hasCaptionData = false,
  shouldUpdateOnTimeFrameChange = true,
  isComparisonMode = false,
  comparisonInsights = [],
  comparisonRecommendations = [],
  webinar1Name = "Webinar 1",
  webinar2Name = "Webinar 2",
  isAlwaysExpanded = false,
  transcriptText,


  // New props
  peaks = [],
  dropoffs = [],
  totalAttendees = 0,
  averageRetention = 0,
  captionSegments = [],

  comparisonPeaks = [],
  comparisonDropoffs = [],
  preComputedInsights = [],
  preComputedRecommendations = [],
}: AIAnalysisPanelProps) => {
  // State for UI controls
  const [isExpanded, setIsExpanded] = useState(isAlwaysExpanded);
  const [showRecommendations, setShowRecommendations] = useState(true);
  const [analysisProgress, setAnalysisProgress] = useState<{stage: string, progress: number, message: string} | null>(null);
  const [showSuccessToast, setShowSuccessToast] = useState(false);

  // Track if analysis has been performed
  const [hasPerformedAnalysis, setHasPerformedAnalysis] = useState(false);

  // State for AI generated content
  const [aiGeneratedInsights, setAiGeneratedInsights] = useState<string[]>([]);
  const [aiGeneratedRecommendations, setAiGeneratedRecommendations] = useState<string[]>([]);
  const [comparisonRecommendationsAI, setComparisonRecommendationsAI] = useState<string[]>([]);

  // Auto-populate from pre-computed DB data when available
  useEffect(() => {
    if (preComputedInsights.length > 0 && aiGeneratedInsights.length === 0) {
      setAiGeneratedInsights(preComputedInsights);
      setHasPerformedAnalysis(true);
    }
    if (preComputedRecommendations.length > 0 && aiGeneratedRecommendations.length === 0) {
      setAiGeneratedRecommendations(preComputedRecommendations);
      setHasPerformedAnalysis(true);
    }
  }, [preComputedInsights, preComputedRecommendations]);

  // Track if timeFrame has changed after initial analysis
  const [lastAnalyzedTimeFrame, setLastAnalyzedTimeFrame] = useState<number | null>(null);

  // Filter out insights with no content or error messages
  const filteredPeakInsights = useMemo(() => {
    return peakInsights.filter(insight =>
      insight &&
      !insight.includes('No caption content available') &&
      !insight.includes('Error:') &&
      !insight.includes('OpenAI API key not found')
    ).map(insight => {
      if (insight.includes('Using generated analysis due to')) {
        return insight.split('To use AI analysis')[0].replace('Using generated analysis due to missing OpenAI API key.', '');
      }
      return insight;
    });
  }, [peakInsights]);

  const filteredDropInsights = useMemo(() => {
    return dropInsights.filter(insight =>
      insight &&
      !insight.includes('No caption content available') &&
      !insight.includes('Error:') &&
      !insight.includes('OpenAI API key not found')
    ).map(insight => {
      if (insight.includes('Using generated analysis due to')) {
        return insight.split('To use AI analysis')[0].replace('Using generated analysis due to missing OpenAI API key.', '');
      }
      return insight;
    });
  }, [dropInsights]);

  // Get combined insights
  const insights = useMemo(() => {
    // Use AI generated insights if available
    if (aiGeneratedInsights.length > 0) {
      return aiGeneratedInsights;
    }

    const combinedInsights = [
      ...filteredPeakInsights.map(insight => `Peak: ${insight}`),
      ...filteredDropInsights.map(insight => `Drop: ${insight}`)
    ];

    if (combinedInsights.length === 0) {
      if (peakInsights.some(i => i?.includes('OpenAI API key')) || dropInsights.some(i => i?.includes('OpenAI API key'))) {
        return ["Click 'Generate AI Analysis' to get AI-powered insights about your webinar performance."];
      }
      return [];
    }

    return combinedInsights;
  }, [filteredPeakInsights, filteredDropInsights, peakInsights, dropInsights, aiGeneratedInsights]);

  // Use AI generated recommendations
  const recommendations = useMemo(() => {
    return aiGeneratedRecommendations;
  }, [aiGeneratedRecommendations]);

  // For comparison mode - use AI generated comparison recommendations
  const finalComparisonRecommendations = useMemo(() => {
    return comparisonRecommendationsAI.length > 0 ? comparisonRecommendationsAI : comparisonRecommendations;
  }, [comparisonRecommendationsAI, comparisonRecommendations]);

  // Update the analysis when time frame changes
  useEffect(() => {
    if (hasPerformedAnalysis &&
        shouldUpdateOnTimeFrameChange &&
        lastAnalyzedTimeFrame !== null &&
        timeFrame !== lastAnalyzedTimeFrame) {

      console.log(`TimeFrame changed from ${lastAnalyzedTimeFrame} to ${timeFrame}, updating analysis`);
      setAnalysisProgress(null);
      setLastAnalyzedTimeFrame(timeFrame);
      handleGenerate();
    }
  }, [timeFrame, shouldUpdateOnTimeFrameChange, hasPerformedAnalysis, lastAnalyzedTimeFrame]);

  // Force expanded state
  useEffect(() => {
    if (isAlwaysExpanded) {
      setIsExpanded(true);
    }
  }, [isAlwaysExpanded]);

  // Auto-hide success toast after 3 seconds
  useEffect(() => {
    if (showSuccessToast) {
      const timer = setTimeout(() => {
        setShowSuccessToast(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [showSuccessToast]);

  // Enhanced function to call OpenAI API for comprehensive analysis
const callBackendAnalysis = async (
  progressCallback: (progress: { stage: string; progress: number; message: string }) => void
): Promise<void> => {

  try {
  progressCallback({
    stage: "Analyzing",
    progress: 0.3,
    message: "Analyzing full webinar transcript..."
  });


  // Combine FULL transcript into one string
  // FULL transcript already fetched from backend analytics

const fullTranscript = transcriptText || "";


if (fullTranscript.length < 100) {
  throw new Error("Transcript text not available");
}



 const res = await fetch(`/api/ai/analyze-full-transcript`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    meeting_id: meetingId,
    transcript: fullTranscript,
   peaks,
  dropoffs,
  peak_drop_reasons: (window as any).__PEAK_DROP_REASONS__ || {},
total_participants: totalAttendees
  })
});


  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();

  if (!data.key_insights || !data.recommendations) {
    throw new Error("Invalid AI response");
  }

  // SET FINAL UI DATA
  setAiGeneratedInsights(data.key_insights);
  setAiGeneratedRecommendations(data.recommendations);

  progressCallback({
    stage: "Complete",
    progress: 1,
    message: "Transcript analysis complete"
  });

  setTimeout(() => {
    setAnalysisProgress(null);
    setShowSuccessToast(true);
  }, 500);

} catch (err) {
  console.error("Transcript analysis error", err);

  setAiGeneratedInsights([
    "Unable to generate transcript-based insights. Please ensure captions are available."
  ]);

  setAiGeneratedRecommendations([
    "Ensure the webinar transcript is uploaded correctly.",
    "Avoid long uninterrupted monologues.",
    "Add explicit action-oriented statements to improve engagement."
  ]);

  progressCallback({
    stage: "Complete",
    progress: 1,
    message: "Fallback analysis complete"
  });

  setTimeout(() => {
    setAnalysisProgress(null);
    setShowSuccessToast(true);
  }, 500);
}

};

  // Fallback simple analysis
  const callSimpleAnalysis = async (
    progressCallback: (progress: { stage: string; progress: number; message: string }) => void
  ): Promise<void> => {
    try {
      progressCallback({
        stage: "Analyzing",
        progress: 0.5,
        message: "Using standard analysis..."
      });

      const res = await fetch(`/api/analysis/simple`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          timeFrame,
          totalAttendees,
          averageRetention,
          peaks,
          dropoffs
        })
      });

      const data = await res.json();

      if (data.success) {
        setAiGeneratedInsights(data.insights || []);
        setAiGeneratedRecommendations(data.recommendations || []);

        progressCallback({
          stage: "Complete",
          progress: 1,
          message: "Analysis complete"
        });
      } else {
        throw new Error("Simple analysis failed");
      }

    } catch (err) {
      console.error("Simple analysis error", err);

      // Final fallback
      setAiGeneratedInsights([
        `Webinar had ${totalAttendees} attendees with ${averageRetention.toFixed(1)}% retention`
      ]);

      setAiGeneratedRecommendations([
        "Improve pacing during drop-off segments",
        "Add interaction during low engagement moments",
        "Consider incorporating Q&A sessions"
      ]);

      progressCallback({
        stage: "Complete",
        progress: 1,
        message: "Basic analysis complete"
      });
    } finally {
      setTimeout(() => {
        setAnalysisProgress(null);
        setShowSuccessToast(true);
      }, 500);
    }
  };

  // Handle generate button click
  const handleGenerate = async () => {

  if (!transcriptText || transcriptText.length < 100) {
    alert("Transcript is still loading. Please wait 2–3 seconds.");
    return;
  }

  setAnalysisProgress({
    stage: "Starting",
    progress: 0,
    message: "Initializing AI analysis..."
  });

  setHasPerformedAnalysis(true);
  setLastAnalyzedTimeFrame(timeFrame);
  setShowSuccessToast(false);

  await callBackendAnalysis(setAnalysisProgress);
};


  // Handle refresh button click
  const handleRefresh = async () => {
    setAnalysisProgress({
      stage: "Refreshing",
      progress: 0,
      message: "Refreshing AI analysis..."
    });

    setShowSuccessToast(false);

    await callBackendAnalysis(setAnalysisProgress);
  };

  // Render UI
  return (
    <div className="w-full rounded-lg border border-border bg-card p-6 shadow-sm relative">

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-amber-500" />
          <h3 className="text-xl font-semibold">AI Analysis</h3>
          <div className="ml-2 text-xs bg-primary/20 px-2 py-1 rounded-full flex items-center gap-1">
            <div className="h-2 w-2 rounded-full bg-primary animate-pulse"></div>
            AI-Powered
          </div>
        </div>
        {!isAlwaysExpanded && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="h-8 w-8 p-0"
          >
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        )}
      </div>

      {isExpanded && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Get AI-powered insights and recommendations based on your webinar
            attendance data.
          </p>

          {/* Success Toast INSIDE the panel */}
          {showSuccessToast && (
            <div className="animate-in slide-in-from-top duration-300">
              <div className="bg-green-500 text-white px-4 py-3 rounded-lg shadow-sm flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                <span>AI analysis completed successfully!</span>
                <button
                  onClick={() => setShowSuccessToast(false)}
                  className="ml-auto text-white/80 hover:text-white"
                >
                  ✕
                </button>
              </div>
            </div>
          )}

          {/* Loading Progress Bar - INSIDE the panel */}
          {analysisProgress && analysisProgress.progress < 1 && (
            <div className="bg-card p-4 rounded-lg border border-primary/20 shadow-sm">
              <div className="flex items-center justify-center mb-4">
                <Loader2 className="mr-2 h-5 w-5 animate-spin text-primary" />
                <h3 className="text-lg font-semibold">{analysisProgress.stage}</h3>
              </div>

              <div className="w-full">
                <div className="mb-2 flex justify-between text-sm">
                  <span className="font-medium">{analysisProgress.message}</span>
                  <span className="font-medium">{Math.round(analysisProgress.progress * 100)}%</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2.5">
                  <div
                    className="bg-primary h-2.5 rounded-full transition-all duration-300"
                    style={{ width: `${Math.round(analysisProgress.progress * 100)}%` }}
                  ></div>
                </div>
              </div>
            </div>
          )}

          {(!insights.length || !hasPerformedAnalysis) && !analysisProgress ? (
            <div className="flex flex-col items-center justify-center py-8">
             <Button
  onClick={handleGenerate}
  disabled={!hasCaptionData || analysisProgress !== null}
   className="gap-2"
>


                {analysisProgress ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  "Generate AI Analysis"
                )}
              </Button>
              {!analysisProgress && !hasCaptionData && (
                <p className="mt-2 text-xs text-destructive">
                Transcript is missing for this meeting. Engagement data and attendance graph are still available above.
                </p>
              )}
              {!analysisProgress && hasCaptionData && (
                <p className="mt-2 text-xs text-muted-foreground">
                  This may take a few moments to process your data
                </p>
              )}
            </div>
          ) : !analysisProgress ? (
            <div className="space-y-6">
              {insights.length > 0 && (
                <div>
                  <h4 className="text-lg font-medium mb-2">
                    {isComparisonMode ? (
                      <div className="flex items-center gap-2">
                        Key Insights
                        <div className="flex items-center gap-1 text-sm font-normal">
                          <div className="w-2 h-2 rounded-full bg-primary"></div>
                          <span>{webinar1Name}</span>
                        </div>
                      </div>
                    ) : (
                      "Key Insights"
                    )}
                  </h4>
                  <ul className="space-y-2">
                    {insights.map((insight, index) => (
                      <li
                        key={`insight-${index}`}
                        className="flex gap-2 text-sm bg-muted/50 p-3 rounded-md"
                      >
                        <span className="text-primary font-medium">
                          {index + 1}.
                        </span>
                        <span>{insight}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {isComparisonMode && comparisonInsights.length > 0 && (
                <div className="mt-6">
                  <h4 className="text-lg font-medium mb-2">
                    <div className="flex items-center gap-2">
                      Key Insights
                      <div className="flex items-center gap-1 text-sm font-normal">
                        <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                        <span>{webinar2Name}</span>
                      </div>
                    </div>
                  </h4>
                  <ul className="space-y-2">
                    {comparisonInsights.map((insight, index) => (
                      <li
                        key={`comparison-insight-${index}`}
                        className="flex gap-2 text-sm bg-purple-500/10 p-3 rounded-md"
                      >
                        <span className="text-purple-500 font-medium">
                          {index + 1}.
                        </span>
                        <span>{insight}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {isComparisonMode &&
                insights.length > 0 &&
                comparisonInsights.length > 0 && (
                  <div className="mt-6 p-4 border border-primary/20 rounded-md bg-primary/5">
                    <h4 className="text-lg font-medium mb-2">
                      Comparative Analysis
                    </h4>
                    <ul className="space-y-2">
                      <li className="flex gap-2 text-sm p-3 rounded-md bg-gradient-to-r from-primary/10 to-purple-500/10">
                        <span className="text-primary font-medium">•</span>
                        <span>
                          {webinar2Name} showed patterns of engagement that differ from {webinar1Name} in key segments.
                        </span>
                      </li>
                      <li className="flex gap-2 text-sm p-3 rounded-md bg-gradient-to-r from-primary/10 to-purple-500/10">
                        <span className="text-primary font-medium">•</span>
                        <span>
                          Peak attendance moments reveal insights about content effectiveness across both webinars.
                        </span>
                      </li>
                      <li className="flex gap-2 text-sm p-3 rounded-md bg-gradient-to-r from-primary/10 to-purple-500/10">
                        <span className="text-primary font-medium">•</span>
                        <span>
                          Drop-off patterns indicate opportunities for improving audience retention in future sessions.
                        </span>
                      </li>
                    </ul>
                  </div>
                )}

              {recommendations.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-lg font-medium">
                      {isComparisonMode ? (
                        <div className="flex items-center gap-2">
                          Recommendations
                          <div className="flex items-center gap-1 text-sm font-normal">
                            <div className="w-2 h-2 rounded-full bg-primary"></div>
                            <span>{webinar1Name}</span>
                          </div>
                        </div>
                      ) : (
                        "AI Recommendations"
                      )}
                    </h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setShowRecommendations(!showRecommendations)
                      }
                      className="h-8 gap-1 text-xs"
                    >
                      {showRecommendations ? "Hide" : "Show"}
                      {showRecommendations ? (
                        <ChevronUp className="h-3 w-3" />
                      ) : (
                        <ChevronDown className="h-3 w-3" />
                      )}
                    </Button>
                  </div>

                  {showRecommendations && (
                    <ul className="space-y-2">
                      {recommendations.map((recommendation, index) => (
                        <li
                          key={`recommendation-${index}`}
                          className={cn(
                            "flex gap-2 text-sm p-3 rounded-md",
                            index % 2 === 0
                              ? "bg-primary/10"
                              : "bg-secondary/30",
                          )}
                        >
                          <span className="text-primary font-medium">
                            {index + 1}.
                          </span>
                          <span>{recommendation}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {isComparisonMode &&
                finalComparisonRecommendations.length > 0 &&
                showRecommendations && (
                  <div className="mt-6">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-lg font-medium">
                        <div className="flex items-center gap-2">
                          Recommendations
                          <div className="flex items-center gap-1 text-sm font-normal">
                            <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                            <span>{webinar2Name}</span>
                          </div>
                        </div>
                      </h4>
                    </div>

                    <ul className="space-y-2">
                      {finalComparisonRecommendations.map(
                        (recommendation, index) => (
                          <li
                            key={`comparison-recommendation-${index}`}
                            className={cn(
                              "flex gap-2 text-sm p-3 rounded-md",
                              index % 2 === 0
                                ? "bg-purple-500/10"
                                : "bg-purple-500/5",
                            )}
                          >
                            <span className="text-purple-500 font-medium">
                              {index + 1}.
                            </span>
                            <span>{recommendation}</span>
                          </li>
                        ),
                      )}
                    </ul>
                  </div>
                )}

              <div className="flex justify-between items-center">
                <div className="text-xs text-muted-foreground">
                  {aiGeneratedInsights.length > 0

                  }
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRefresh}
                    disabled={analysisProgress !== null}
                    className="gap-2"
                  >
                    {analysisProgress ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Refreshing...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-3.5 w-3.5" />
                        Refresh Analysis
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};

export default AIAnalysisPanel;
