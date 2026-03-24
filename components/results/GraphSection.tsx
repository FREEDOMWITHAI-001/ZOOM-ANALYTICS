"use client";
import React, { useState, useEffect } from "react";
import RetentionGraph from "../RetentionGraph";
import { GraphType } from "../graph/GraphControls";
import { DataPoint } from "@/lib/utils";
import { CaptionSegment } from "@/lib/captions/caption-parser";

interface GraphSectionProps {
  retentionData: DataPoint[];
  comparisonRetentionData: DataPoint[];
  isComparisonMode: boolean;
  webinar1Name: string;
  webinar2Name: string;
  graphType: GraphType;
  onGraphTypeChange: (type: GraphType) => void;
  captionData?: CaptionSegment[];
  transcriptData?: any;
  meetingId?: string;
   onTranscriptReady?: (
    segments: { time: string; start_time?: number; text: string }[]
  ) => void;
}

interface TranscriptSegment {
  time: string;
  start_time?: number;
  duration?: number;
  speaker?: string;
  text: string;
  confidence?: number;
}




const GraphSection: React.FC<GraphSectionProps> = ({
  retentionData,
  comparisonRetentionData,
  isComparisonMode,
  webinar1Name,
  webinar2Name,
  graphType,
  onGraphTypeChange,
  captionData = [],
  transcriptData,
  meetingId,
  onTranscriptReady,
}) => {
  const [selectedPoint, setSelectedPoint] = useState<{time: string, participants: number} | null>(null);
  const [showTranscript, setShowTranscript] = useState(false);
  const [realTranscriptSegments, setRealTranscriptSegments] = useState<TranscriptSegment[]>([]);
  const [isLoadingTranscript, setIsLoadingTranscript] = useState(false);
  const [transcriptError, setTranscriptError] = useState<string | null>(null);
  const [hasAttemptedDownload, setHasAttemptedDownload] = useState(false);

  // AI Analysis State
  const [isAnalyzingWithAI, setIsAnalyzingWithAI] = useState(false);
  const [aiAnalysisResult, setAiAnalysisResult] = useState<any | null>(null);

  const [showAiAnalysis, setShowAiAnalysis] = useState(false);

  // ========== INITIAL LOAD ==========
  useEffect(() => {
    if (!meetingId || hasAttemptedDownload) return;

    console.log("Initial transcript load for meeting:", meetingId);
    fetchTranscriptFromAPI(meetingId);
    setHasAttemptedDownload(true);
  }, [meetingId, hasAttemptedDownload]);

  // ========== MAIN FUNCTION: Fetch transcript when clicking graph points ==========
  const fetchTranscriptFromAPI = async (meetingId: string) => {
    if (!meetingId) {
      console.error("No meetingId provided");
      setTranscriptError("No meeting ID available");
      return;
    }

    setIsLoadingTranscript(true);
    setTranscriptError(null);

    try {
      // STEP 1: Use the working /transcript-direct endpoint
      const response = await fetch(`/api/transcript-direct/${meetingId}`);

      if (response.ok) {
        const data = await response.json();

        if (data.success && data.content) {
          // We have the transcript content directly!
          const parsedSegments = parseVTTContent(data.content);
          setRealTranscriptSegments(parsedSegments);

// SEND TRANSCRIPT UP
onTranscriptReady?.(parsedSegments);


          setTranscriptError(null);
          setIsLoadingTranscript(false);
          return;
        }
      }

      // All strategies failed
      setTranscriptError("Transcript content is not available for this meeting.");
      setRealTranscriptSegments([]);

    } catch (error) {
      console.error("Error in fetchTranscriptFromAPI:", error);
      setTranscriptError(`Failed to fetch transcript: ${(error as Error).message}`);
      setRealTranscriptSegments([]);
    } finally {
      setIsLoadingTranscript(false);
    }
  };

  // ========== HELPER FUNCTIONS ==========

  // Parse VTT content with robust error handling
  const parseVTTContent = (vttContent: string): TranscriptSegment[] => {
    try {
      const segments: TranscriptSegment[] = [];
      const lines = vttContent.split('\n');

      let currentSegment: TranscriptSegment | null = null;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Skip empty lines and headers
        if (!line || line === 'WEBVTT' || line.startsWith('NOTE') || line.startsWith('STYLE')) {
          continue;
        }

        // Check for timestamp line (contains -->)
        if (line.includes('-->')) {
          // If we have a previous segment, save it
          if (currentSegment && currentSegment.text) {
            segments.push(currentSegment);
          }

          // Parse timestamp
          const [startTime, endTime] = line.split('-->').map(t => t.trim());
          const timeDisplay = formatVttTimeToDisplay(startTime);
          const startTimeInSeconds = convertVttTimeToSeconds(startTime);

          // Create new segment
          currentSegment = {
            time: timeDisplay,
            start_time: startTimeInSeconds,
            text: ''
          };

          // The next line(s) should be the text
          let textLines = [];
          i++;
          while (i < lines.length && lines[i].trim() && !lines[i].includes('-->')) {
            textLines.push(lines[i].trim());
            i++;
          }
          i--; // Go back one line

          if (textLines.length > 0) {
            currentSegment.text = textLines.join(' ');
          }
        }
      }

      // Don't forget the last segment
      if (currentSegment && currentSegment.text) {
        segments.push(currentSegment);
      }

      return segments;
    } catch (error) {
      console.error("Error parsing VTT content:", error);
      return [];
    }
  };

  // Helper function to convert VTT time (00:01:23.456) to display format (00:01)
  const formatVttTimeToDisplay = (vttTime: string): string => {
    try {
      // Remove milliseconds if present
      const timeWithoutMs = vttTime.split('.')[0];
      const parts = timeWithoutMs.split(':');

      if (parts.length === 3) {
        // Format: HH:MM:SS -> HH:MM
        const hours = parts[0];
        const minutes = parts[1];
        return `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}`;
      }
    } catch (error) {
      console.error("Error formatting VTT time:", error);
    }
    return "00:00";
  };

  // Helper function to convert VTT time to seconds
  const convertVttTimeToSeconds = (vttTime: string): number => {
    try {
      const timeWithoutMs = vttTime.split('.')[0];
      const parts = timeWithoutMs.split(':').map(Number);

      if (parts.length === 3) {
        // HH:MM:SS
        return parts[0] * 3600 + parts[1] * 60 + parts[2];
      } else if (parts.length === 2) {
        // MM:SS (sometimes in VTT)
        return parts[0] * 60 + parts[1];
      }
    } catch (error) {
      console.error("Error converting VTT time to seconds:", error);
    }
    return 0;
  };

  // Convert graph time (HH:MM) to seconds
  const convertGraphTimeToSeconds = (time: string): number => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 3600 + minutes * 60;
  };

  // MAIN FUNCTION: Get transcript for time - uses real data first, falls back to mock data
  const getTranscriptForTime = (time: string): string => {
    // Try to find real transcript segment first
    const realTranscript = findRealTranscriptSegment(time);
    if (realTranscript) {
      return realTranscript;
    }

    // Fallback to mock data
    return getMockTranscriptForTime(time);
  };

  // Find real transcript segment for specific time
  const findRealTranscriptSegment = (time: string): string | null => {
    if (!realTranscriptSegments || realTranscriptSegments.length === 0) {
      return null;
    }

    // Convert graph time to seconds
    const targetTimeInSeconds = convertGraphTimeToSeconds(time);

    // Find the closest transcript segment within 30 seconds
    let closestSegment: TranscriptSegment | null = null;
    let minDifference = Infinity;

    realTranscriptSegments.forEach(segment => {
      if (segment.start_time !== undefined) {
        const difference = Math.abs(segment.start_time - targetTimeInSeconds);

        // Accept segments within 30 seconds of the graph point
        if (difference < minDifference && difference <= 30) {
          minDifference = difference;
          closestSegment = segment;
        }
      }
    });

    if (closestSegment && closestSegment.text) {
      return `[${closestSegment.time}] ${closestSegment.text}`;
    }

    return null;
  };

  // Mock transcript data as fallback
  const getMockTranscriptForTime = (time: string): string => {
    const transcripts: {[key: string]: string} = {
      "00:00": "Welcome everyone to today's webinar on data analytics. We'll be covering the latest trends and techniques in data visualization and business intelligence.",
      "00:05": "Let's start with an overview of the agenda. We'll cover data collection, analysis techniques, visualization best practices, and real-world case studies.",
      "00:10": "Now discussing data collection methods. Proper data gathering is crucial for accurate analysis. We're covering surveys, APIs, and automated data pipelines.",
      "00:15": "Moving to data cleaning and preprocessing. This step ensures data quality and reliability for our analysis. We're removing outliers and handling missing values.",
      "00:20": "Introducing statistical analysis techniques. We're covering descriptive statistics, correlation analysis, and hypothesis testing methods.",
      "00:25": "Now exploring data visualization principles. We're discussing chart selection, color theory, and how to make complex data understandable at a glance.",
      "00:30": "Demonstrating interactive dashboards. This is where we show live examples of how dynamic visualizations can reveal hidden patterns in your data.",
      "00:35": "Discussing business intelligence tools. We're comparing Tableau, Power BI, and custom solutions for different organizational needs.",
      "00:40": "Case study: Retail analytics. Showing how a major retailer increased sales by 25% through better customer behavior analysis and inventory optimization.",
      "00:45": "Case study: Healthcare data. Exploring how predictive analytics helped hospitals reduce patient wait times and improve resource allocation.",
      "00:50": "Introducing machine learning concepts. We're covering supervised vs unsupervised learning and when to use each approach in business contexts.",
      "00:55": "Live demo: Building a simple prediction model. Showing step-by-step how to create a sales forecast using historical data and trend analysis.",
      "01:00": "Q&A session begins. Answering questions about implementation challenges, tool costs, and team skill requirements for data projects.",
      "01:05": "Addressing data privacy concerns. Discussing GDPR compliance, anonymization techniques, and ethical data usage practices.",
      "01:10": "Talking about data governance frameworks. How to establish policies, procedures, and accountability for data management across organizations.",
      "01:15": "Future trends in analytics. Covering AI-powered insights, real-time analytics, and the growing importance of data storytelling.",
      "01:20": "Implementation roadmap. Step-by-step guide for organizations starting their data analytics journey, from assessment to full deployment.",
      "01:25": "Best practices summary. Key takeaways for successful data projects: start small, focus on business value, and ensure executive buy-in.",
      "01:30": "Resources and next steps. Sharing additional learning materials, community forums, and hands-on workshops for continued development.",
      "01:35": "Final Q&A opportunity. Addressing remaining questions about specific use cases, tool recommendations, and getting started with small projects.",
      "01:40": "Closing remarks and thank you. Summarizing key insights and encouraging participants to apply these techniques in their own organizations."
    };

    // If exact time not found, find the closest match
    if (!transcripts[time]) {
      const allTimes = Object.keys(transcripts);
      const currentTime = time.split(':').map(Number);
      let closestTime = allTimes[0];
      let minDifference = Infinity;

      allTimes.forEach(t => {
        const targetTime = t.split(':').map(Number);
        const difference = Math.abs((currentTime[0] * 60 + currentTime[1]) - (targetTime[0] * 60 + targetTime[1]));

        if (difference < minDifference) {
          minDifference = difference;
          closestTime = t;
        }
      });

      return transcripts[closestTime] || `During this time period (${time}), the presenter was discussing data analytics concepts.`;
    }

    return transcripts[time];
  };

  // ========== EVENT HANDLERS ==========

  // Enhanced point click handler
  const handlePointClick = (point: {time: string, participants: number}) => {
    setSelectedPoint(point);
    setShowTranscript(true);

    // Reset AI analysis when new point is clicked
    setShowAiAnalysis(false);
    setAiAnalysisResult(null);

    // Check if we have real transcript data
    if (realTranscriptSegments.length === 0 && !isLoadingTranscript && meetingId) {
      fetchTranscriptFromAPI(meetingId);
    }
  };

  const handleCopyTranscript = () => {
    if (selectedPoint) {
      const transcript = getTranscriptForTime(selectedPoint.time);
      navigator.clipboard.writeText(transcript)
        .then(() => {
          alert("Transcript copied to clipboard!");
        })
        .catch(() => {
          alert("Failed to copy transcript. Please select and copy manually.");
        });
    }
  };

  const handleRefreshTranscript = () => {
    if (meetingId) {
      setHasAttemptedDownload(false); // Reset to allow retry
      fetchTranscriptFromAPI(meetingId);
    }
  };

  // AI Analysis Function
 const handleAIAnalyzeTranscript = async () => {
  if (!selectedPoint) return;

  setIsAnalyzingWithAI(true);
  setAiAnalysisResult(null);
  setShowAiAnalysis(true);

  try {
    const transcript = getTranscriptForTime(selectedPoint.time);

   const response = await fetch(
  `/api/ai/analyze-transcript`,
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      time: selectedPoint.time,
      participants: selectedPoint.participants,
      transcript
    })
  }
);


    const data = await response.json();

    if (data.error) {
      throw new Error(data.error);
    }

    setAiAnalysisResult(data);
  } catch (err) {
    console.error(err);
    setAiAnalysisResult("AI analysis failed.");
  } finally {
    setIsAnalyzingWithAI(false);
  }
};


  // Function to copy AI analysis
  const handleCopyAiAnalysis = () => {
    if (aiAnalysisResult) {
      navigator.clipboard.writeText(aiAnalysisResult)
        .then(() => {
          alert("AI analysis copied to clipboard!");
        })
        .catch(() => {
          alert("Failed to copy analysis.");
        });
    }
  };

  return (
    <div className="w-full space-y-6">
      <RetentionGraph
        data={retentionData}
        comparisonData={isComparisonMode ? comparisonRetentionData : []}
        title="Participant Retention Over Time"
        description="This graph shows how many participants remained in the webinar over time. Click on any point to see the transcript for that time."
        isComparisonMode={isComparisonMode}
        webinar1Name={webinar1Name}
        webinar2Name={webinar2Name}
        graphType={graphType}
        onGraphTypeChange={onGraphTypeChange}
        captionData={captionData}
        onPointClick={handlePointClick}
      />

      {/* Transcript Display Section */}
      {showTranscript && selectedPoint && (
        <div className="mt-6 p-6 border border-primary/20 rounded-lg bg-primary/5 animate-in fade-in duration-300">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-lg font-semibold text-primary">
                Transcript for {selectedPoint.time}
              </h3>
              <p className="text-sm text-muted-foreground">
                {selectedPoint.participants} participants at this time
                {realTranscriptSegments.length > 0 ? (
                  <span className="ml-2 text-green-600">• Real Transcript</span>
                ) : (
                  <span className="ml-2 text-yellow-600">• Transcript Unavailable</span>
                )}
              </p>
            </div>
            <div className="flex gap-2">
              {meetingId && (
                <button
                  onClick={handleRefreshTranscript}
                  disabled={isLoadingTranscript}
                  className="text-sm px-3 py-1 border border-border rounded hover:bg-accent transition-colors disabled:opacity-50"
                >
                  {isLoadingTranscript ? 'Loading...' : 'Refresh Transcript'}
                </button>
              )}
              <button
                onClick={() => {
                  setShowTranscript(false);
                  setShowAiAnalysis(false);
                }}
                className="text-muted-foreground hover:text-foreground transition-colors p-2 hover:bg-primary/10 rounded"
              >
                ✕
              </button>
            </div>
          </div>

          {transcriptError && (
            <div className="mb-4 p-3 bg-yellow-100 border border-yellow-300 rounded text-yellow-700 text-sm">
              <div dangerouslySetInnerHTML={{ __html: transcriptError }} />
            </div>
          )}

          <div className="bg-white dark:bg-gray-900 p-4 rounded-lg border mb-4 shadow-sm">
            {isLoadingTranscript ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-6 w-6 rounded-full border-2 border-t-transparent border-primary animate-spin mr-2"></div>
                <p>Loading transcript...</p>
              </div>
            ) : (
              <p className="text-foreground leading-relaxed whitespace-pre-wrap">
                {getTranscriptForTime(selectedPoint.time)}
              </p>
            )}
          </div>

          {/* AI Analysis Section */}
          {showAiAnalysis && (
            <div className="mb-4 p-5 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center">
                  <div className="h-8 w-8 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 flex items-center justify-center mr-3">
                    <span className="text-white text-sm font-bold">AI</span>
                  </div>
                  <h4 className="font-semibold text-blue-700 dark:text-blue-300">
                    AI Analysis for {selectedPoint.time}
                  </h4>
                </div>
                <button
                  onClick={() => setShowAiAnalysis(false)}
                  className="text-blue-500 hover:text-blue-700 p-1 rounded hover:bg-blue-100"
                >
                  ✕
                </button>
              </div>

              {isAnalyzingWithAI ? (
                <div className="flex flex-col items-center justify-center py-6">
                  <div className="h-8 w-8 rounded-full border-3 border-t-transparent border-blue-600 animate-spin mb-3"></div>
                  <p className="text-blue-600 font-medium">Analyzing with AI...</p>
                </div>
              ) : aiAnalysisResult ? (
                <div className="bg-white dark:bg-gray-900 p-4 rounded border shadow-sm">
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                   {aiAnalysisResult && (
  <table className="w-full border-collapse text-sm">
    <tbody>

      <tr>
        <td className="font-semibold p-2 border">Time</td>
        <td className="p-2 border">{aiAnalysisResult.time}</td>
      </tr>

      <tr className="bg-gray-50 dark:bg-gray-800">
        <td colSpan={2} className="font-semibold p-2 border">
          Content Quality
        </td>
      </tr>
      <tr>
        <td className="p-2 border">Clarity</td>
        <td className="p-2 border">{aiAnalysisResult.content_quality?.clarity_1to5}/5</td>
      </tr>
      <tr>
        <td className="p-2 border">Structure</td>
        <td className="p-2 border">{aiAnalysisResult.content_quality?.structure_1to5}/5</td>
      </tr>
      <tr>
        <td className="p-2 border">Specificity</td>
        <td className="p-2 border">{aiAnalysisResult.content_quality?.specificity_1to5}/5</td>
      </tr>

      <tr className="bg-gray-50 dark:bg-gray-800">
        <td colSpan={2} className="font-semibold p-2 border">
          Engagement Potential
        </td>
      </tr>
      <tr>
        <td className="p-2 border">Energy</td>
        <td className="p-2 border">{aiAnalysisResult.engagement_potential?.energy_1to5}/5</td>
      </tr>
      <tr>
        <td className="p-2 border">Interactivity</td>
        <td className="p-2 border">{aiAnalysisResult.engagement_potential?.interactivity_1to5}/5</td>
      </tr>
      <tr>
        <td className="p-2 border">Actionability</td>
        <td className="p-2 border">{aiAnalysisResult.engagement_potential?.actionability_1to5}/5</td>
      </tr>

      <tr className="bg-gray-50 dark:bg-gray-800">
        <td colSpan={2} className="font-semibold p-2 border">
          Evidence Phrases
        </td>
      </tr>
      <tr>
        <td colSpan={2} className="p-2 border">
          <ul className="list-disc ml-6">
            {aiAnalysisResult.evidence_phrases?.map((p: string, i: number) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        </td>
      </tr>

      <tr>
        <td className="font-semibold p-2 border">Summary</td>
        <td className="p-2 border">{aiAnalysisResult.one_line_summary}</td>
      </tr>

      <tr>
        <td className="font-semibold p-2 border">Improvement</td>
        <td className="p-2 border">{aiAnalysisResult.one_improvement}</td>
      </tr>

    </tbody>
  </table>
)}

                  </div>

                  <div className="mt-5 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <button
                      onClick={handleCopyAiAnalysis}
                      className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-sm font-medium"
                    >
                      Copy Analysis
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          <div className="flex gap-3 flex-wrap">
            <button
              onClick={handleCopyTranscript}
              disabled={isLoadingTranscript}
              className="px-4 py-2 border border-border rounded-lg hover:bg-accent transition-colors font-medium disabled:opacity-50"
            >
              Copy Transcript
            </button>

            <button
              onClick={handleAIAnalyzeTranscript}
              disabled={isLoadingTranscript || isAnalyzingWithAI}
              className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-colors font-medium disabled:opacity-50 flex items-center min-w-[150px] justify-center"
            >
              {isAnalyzingWithAI ? (
                <>
                  <div className="h-4 w-4 rounded-full border-2 border-t-transparent border-white animate-spin mr-2"></div>
                  Analyzing...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                  </svg>
                  AI Analyze
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default GraphSection;
