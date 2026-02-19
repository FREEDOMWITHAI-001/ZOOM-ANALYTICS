"use client";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import LandingSection from "@/components/LandingSection";
import UploadSection from "@/components/UploadSection";
import ResultsSection from "@/components/ResultsSection";
import { ThemeToggle } from "@/components/ThemeToggle";

const IndexPage = () => {
  const [currentStep, setCurrentStep] = useState<
    "landing" | "upload" | "results"
  >("landing");
  const [attendanceFile, setAttendanceFile] = useState<File | null>(null);
  const [transcriptFile, setTranscriptFile] = useState<File | null>(null);
  const [comparisonAttendanceFile, setComparisonAttendanceFile] =
    useState<File | null>(null);
  const [comparisonTranscriptFile, setComparisonTranscriptFile] =
    useState<File | null>(null);
  const [zoomAnalyticsData, setZoomAnalyticsData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null);
  const [timeInterval, setTimeInterval] = useState<string>("5");

  // Handle start analysis button click on landing page
  const handleStartAnalysis = () => {
    setCurrentStep("upload");
  };

  // UPDATED: Enhanced handleAnalysisStart function with better transcript handling
  const handleAnalysisStart = async (
    attendanceFile: File | null,
    transcriptFile: File | null,
    timeInterval: string,
    selectedMeetingId?: string | null
  ) => {
    setTimeInterval(timeInterval);

    if (selectedMeetingId) {
      setSelectedMeetingId(selectedMeetingId);
      setIsLoading(true);

      console.log("Starting Zoom API analysis...");
      console.log("Meeting ID:", selectedMeetingId);
      console.log("Time Interval:", timeInterval);

      try {
        // CRITICAL: Use the analytics-with-insights endpoint
        console.log("STEP 1: Fetching analytics with insights...");
        const insightsResponse = await fetch(
         `/api/analytics-with-insights/${selectedMeetingId}?interval=${timeInterval}`

        );

        let analyticsData;

        if (insightsResponse.ok) {
          analyticsData = await insightsResponse.json();
          console.log("Analytics with insights received:", analyticsData);
          console.log("Has engagement_insights?", !!analyticsData.engagement_insights);
          console.log("Peaks from API:", analyticsData.peaks);
          console.log("Dropoffs from API:", analyticsData.dropoffs);
        } else {
          // Fallback to regular analytics
          console.log("Insights endpoint failed, falling back to regular analytics");
          const regularResponse = await fetch(
            `/api/analytics/${selectedMeetingId}?interval=${timeInterval}`

          );

          if (!regularResponse.ok) {
            throw new Error(`Analytics API failed: ${regularResponse.status}`);
          }

          analyticsData = await regularResponse.json();
          console.log("Regular analytics data received:", analyticsData);

          // Calculate insights from regular analytics data
          if (analyticsData.engagement_graph) {
            const calculatedInsights = calculateInsightsFromEngagementData(
              analyticsData.engagement_graph,
              timeInterval,
              analyticsData.total_participants || 0
            );

            analyticsData.engagement_insights = calculatedInsights;
            analyticsData.peaks = calculatedInsights.peaks;
            analyticsData.dropoffs = calculatedInsights.dropoffs;
          }
        }

        // Check for transcript
        if (!analyticsData.transcript_available || !analyticsData.transcript) {
          console.log("STEP 2: Fetching transcript separately...");
          const transcriptResponse = await fetch(
            `/api/transcript-direct/${selectedMeetingId}`

          );

          if (transcriptResponse.ok) {
            const transcriptData = await transcriptResponse.json();
            console.log("Transcript data received:", transcriptData);
            analyticsData.transcript = transcriptData;
          }
        }

        setZoomAnalyticsData(analyticsData);
        setAttendanceFile(null);
        setTranscriptFile(transcriptFile);
        setCurrentStep("results");

      } catch (error) {
        console.error('Error fetching meeting data:', error);
        alert(`Failed to fetch meeting data: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`);
      } finally {
        setIsLoading(false);
      }
    } else {
      // Handle CSV file upload (existing logic)
      console.log("Using CSV file upload instead of Zoom API");
      setSelectedMeetingId(null);
      setAttendanceFile(attendanceFile);
      setTranscriptFile(transcriptFile);
      setZoomAnalyticsData(null);
      setCurrentStep("results");
    }
  };

  // Add this helper function to calculate insights from engagement data
  const calculateInsightsFromEngagementData = (
    engagementGraph: any,
    interval: string,
    totalParticipants: number
  ) => {
    const intervalNum = parseInt(interval) || 5;

    if (!engagementGraph || !engagementGraph.active_participants || !engagementGraph.labels) {
      return {
        peaks: [],
        dropoffs: [],
        engagement_score: 0
      };
    }

    const activeParticipants = engagementGraph.active_participants;
    const labels = engagementGraph.labels;

    const peaks: any[] = [];
    const dropoffs: any[] = [];

    // Calculate percentage changes
    for (let i = 1; i < activeParticipants.length; i++) {
      const prev = activeParticipants[i-1];
      const curr = activeParticipants[i];

      if (prev > 0) {
        const percentageChange = ((curr - prev) / prev) * 100;

       if (percentageChange > 5) {
  peaks.push({
    timeInterval: labels[i] || `Time ${i}`,
    count: curr,
    percentageChange: Math.round(percentageChange),
    description: getPeakDescription(peaks.length, labels[i]),
  });
}
else if (percentageChange < -5) {
  dropoffs.push({
    timeInterval: labels[i] || `Time ${i}`,
    count: curr,
    percentageChange: Math.round(percentageChange),
    description: getDropoffDescription(dropoffs.length, labels[i]),
  });
}

      }
    }

    // Sort and limit to top 5
   peaks.sort((a, b) => b.percentageChange - a.percentageChange);
dropoffs.sort((a, b) => a.percentageChange - b.percentageChange);

    // Calculate engagement score
    const maxActive = Math.max(...activeParticipants);
    const avgActive = activeParticipants.reduce((a: number, b: number) => a + b, 0) / activeParticipants.length;
    const engagementScore = maxActive > 0 ? Math.round((avgActive / maxActive) * 100) : 0;

    return {
      peaks: peaks.slice(0, 5),
      dropoffs: dropoffs.slice(0, 5),
      engagement_score: engagementScore,
      total_participants: totalParticipants,
      max_active: maxActive,
      avg_active: Math.round(avgActive)
    };
  };

  // Helper functions for descriptions
  const getPeakDescription = (index: number, time: string) => {
    const descriptions = [
      `Engagement spike at ${time} - likely interactive content`,
      `Participant increase at ${time} - possibly Q&A session`,
      `Attention boost at ${time} - key content delivered`,
      `Retention peak at ${time} - audience engaged`,
      `Viewer surge at ${time} - scheduled joiners arrived`
    ];
    return descriptions[Math.min(index, descriptions.length - 1)];
  };

  const getDropoffDescription = (index: number, time: string) => {
    const descriptions = [
      `Drop-off at ${time} - check technical issues`,
      `Audience decline at ${time} - content transition`,
      `Engagement dip at ${time} - complex topic`,
      `Participant decrease at ${time} - break time`,
      `Attention drop at ${time} - lengthy explanation`
    ];
    return descriptions[Math.min(index, descriptions.length - 1)];
  };

  // Also update the handleIntervalChangeWithZoom function:
  const handleIntervalChangeWithZoom = (newInterval: string) => {
    setTimeInterval(newInterval);

    // If we're viewing Zoom meeting results, refetch with new interval
    if (selectedMeetingId && !attendanceFile) {
      // Don't show the full-page loading overlay for interval changes
      // Instead, the ResultsSection will handle showing a small loader in the graph section

      // Make API call but don't trigger full-page loading
      fetch(`/api/analytics-with-insights/${selectedMeetingId}?interval=${newInterval}`)

        .then(response => {
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }
          return response.json();
        })
        .then(data => {
          console.log("Refetched data with new interval:", data);
          setZoomAnalyticsData(data);
        })
        .catch(error => {
          console.error('Error refetching analytics:', error);

          // Fallback to regular analytics
          fetch(`/api/analytics/${selectedMeetingId}?interval=${newInterval}`)

            .then(response => response.json())
            .then(fallbackData => {
              // Calculate insights from fallback data
              if (fallbackData.engagement_graph) {
                const calculatedInsights = calculateInsightsFromEngagementData(
                  fallbackData.engagement_graph,
                  newInterval,
                  fallbackData.total_participants || 0
                );
                fallbackData.engagement_insights = calculatedInsights;
                fallbackData.peaks = calculatedInsights.peaks;
                fallbackData.dropoffs = calculatedInsights.dropoffs;
              }
              setZoomAnalyticsData(fallbackData);
            })
            .catch(() => {
              console.error("Failed to fetch analytics with new interval");
            });
        });
    }
  };

  // Handle comparison file uploads
  const handleComparisonUpload = (
    attendanceFile: File | null,
    transcriptFile: File | null,
  ) => {
    setComparisonAttendanceFile(attendanceFile);
    setComparisonTranscriptFile(transcriptFile);
  };

  // Handle export results
  const handleExportResults = () => {
    console.log("Exporting results...");
    // Implementation would go here
  };

  // Handle share results
  const handleShareResults = () => {
    console.log("Sharing results...");
    // Implementation would go here
  };

  return (
    <div className="min-h-screen bg-background transition-colors duration-300">
      <header className="bg-card/80 backdrop-blur-sm shadow-md dark:shadow-primary/5 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
            Zoom Webinar Attendance Analyzer
          </h1>
          <ThemeToggle />
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <AnimatePresence mode="wait">
            {/* Landing Section */}
            {currentStep === "landing" && (
              <motion.div
                key="landing"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <LandingSection onStartAnalysis={handleStartAnalysis} />
              </motion.div>
            )}

            {/* Upload Section */}
            {currentStep === "upload" && (
              <motion.div
                key="upload"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <UploadSection
                  isVisible={currentStep === "upload"}
                  onAnalysisStart={handleAnalysisStart}
                />
              </motion.div>
            )}

            {/* Results Section */}
            {currentStep === "results" && (
              <motion.div
                key="results"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <ResultsSection
                  isVisible={currentStep === "results"}
                  attendanceData={attendanceFile}
                  transcriptData={transcriptFile}
                  zoomAnalyticsData={zoomAnalyticsData}
                  timeInterval={timeInterval}
                  onIntervalChange={handleIntervalChangeWithZoom}
                  onExportResults={handleExportResults}
                  onShareResults={handleShareResults}
                  onComparisonUpload={handleComparisonUpload}
                  onReanalyze={() => setCurrentStep("upload")}
                  selectedMeetingId={selectedMeetingId} // CRITICAL: This must be passed!
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Loading Overlay - Only show for initial analysis, not interval changes */}
      {isLoading && (
        <div className="fixed inset-0 bg-background/80 flex items-center justify-center z-50">
          <div className="text-center bg-white p-6 rounded-lg shadow-lg">
            <div className="h-8 w-8 rounded-full border-4 border-t-transparent border-primary animate-spin mx-auto mb-4"></div>
            <p className="text-lg font-medium">Analyzing Zoom Meeting Data</p>
            <p className="text-sm text-gray-600 mt-2">Meeting ID: {selectedMeetingId}</p>
            <div className="mt-3 space-y-1">
              <p className="text-xs text-gray-500">• Fetching participant data...</p>
              <p className="text-xs text-gray-500">• Calculating engagement metrics...</p>
              <p className="text-xs text-gray-500">• Generating insights and peaks/dropoffs...</p>
              <p className="text-xs text-gray-500">• Loading transcript (if available)...</p>
            </div>
          </div>
        </div>
      )}

      <footer className="bg-card/50 backdrop-blur-sm mt-auto border-t border-border">
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
          <p className="text-center text-sm text-muted-foreground">
            Zoom Webinar Attendance Analyzer - Analyze participant engagement
            without login
          </p>
        </div>
      </footer>
    </div>
  );
};

export default IndexPage;
