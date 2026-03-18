"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import UploadSection from "@/components/UploadSection";
import ResultsSection from "@/components/ResultsSection";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LogoutButton } from "@/components/LogoutButton";

const IndexPage = () => {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<"upload" | "results">(
    "upload"
  );
  const [selectedClient, setSelectedClient] = useState<string | null>(null);
  const [attendanceFile, setAttendanceFile] = useState<File | null>(null);
  const [transcriptFile, setTranscriptFile] = useState<File | null>(null);
  const [comparisonAttendanceFile, setComparisonAttendanceFile] =
    useState<File | null>(null);
  const [comparisonTranscriptFile, setComparisonTranscriptFile] =
    useState<File | null>(null);
  const [zoomAnalyticsData, setZoomAnalyticsData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(
    null
  );
  const [timeInterval, setTimeInterval] = useState<string>("5");
  const [authLoading, setAuthLoading] = useState(true);
  const [userRole, setUserRole] = useState<string>('user');

  // Check authentication on mount
  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.authenticated && data.client_name) {
          // Admin users should be on /admin, not here
          if (data.role === 'admin') {
            router.push('/admin');
            return;
          }
          setSelectedClient(data.client_name);
          setUserRole(data.role || 'user');
        } else {
          router.push("/login");
        }
      })
      .catch(() => {
        router.push("/login");
      })
      .finally(() => {
        setAuthLoading(false);
      });
  }, [router]);

  // Enhanced handleAnalysisStart function
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

      try {
        const insightsResponse = await fetch(
          `/api/analytics-with-insights/${selectedMeetingId}`
        );

        if (!insightsResponse.ok) {
          throw new Error(`Analytics API failed: ${insightsResponse.status}`);
        }

        const analyticsData = await insightsResponse.json();
        console.log("Analytics received:", analyticsData);

        setZoomAnalyticsData(analyticsData);
        setAttendanceFile(null);
        setTranscriptFile(transcriptFile);
        setCurrentStep("results");
      } catch (error) {
        console.error("Error fetching meeting data:", error);
        alert(
          `Failed to fetch meeting data: ${error instanceof Error ? error.message : "Unknown error"}. Please try again.`
        );
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

  // For minute-level data, interval changes don't require a refetch — ResultsSection re-aggregates locally.
  const handleIntervalChangeWithZoom = (newInterval: string) => {
    setTimeInterval(newInterval);
    // No API refetch needed — aggregation is done client-side in ResultsSection.
  };

  // Handle comparison file uploads
  const handleComparisonUpload = (
    attendanceFile: File | null,
    transcriptFile: File | null
  ) => {
    setComparisonAttendanceFile(attendanceFile);
    setComparisonTranscriptFile(transcriptFile);
  };

  // Handle export results
  const handleExportResults = () => {
    console.log("Exporting results...");
  };

  // Handle share results
  const handleShareResults = () => {
    console.log("Sharing results...");
  };

  // Show nothing while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-4 border-t-transparent border-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background transition-colors duration-300">
      <header className="bg-card/80 backdrop-blur-sm shadow-md dark:shadow-primary/5 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
            Zoom Webinar Attendance Analyzer
          </h1>
          <div className="flex items-center gap-2">
            {selectedClient && <LogoutButton clientName={selectedClient} />}
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <AnimatePresence mode="wait">
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
                  selectedClient={selectedClient}
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
                  selectedMeetingId={selectedMeetingId}
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
            <p className="text-lg font-medium">
              Analyzing Zoom Meeting Data
            </p>
            <p className="text-sm text-gray-600 mt-2">
              Meeting ID: {selectedMeetingId}
            </p>
            <div className="mt-3 space-y-1">
              <p className="text-xs text-gray-500">
                Fetching participant data...
              </p>
              <p className="text-xs text-gray-500">
                Calculating engagement metrics...
              </p>
              <p className="text-xs text-gray-500">
                Generating insights and peaks/dropoffs...
              </p>
              <p className="text-xs text-gray-500">
                Loading transcript (if available)...
              </p>
            </div>
          </div>
        </div>
      )}

      <footer className="bg-card/50 backdrop-blur-sm mt-auto border-t border-border">
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
          <p className="text-center text-sm text-muted-foreground">
            Zoom Webinar Attendance Analyzer - Analyze participant engagement
          </p>
        </div>
      </footer>
    </div>
  );
};

export default IndexPage;
