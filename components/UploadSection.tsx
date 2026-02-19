"use client";
import React, { useState, useEffect } from "react";
import {
  Upload,
  ArrowRight,
  FileText,
  FileSpreadsheet,
  AlertCircle,
  Users,
  Calendar,
  Clock,
  BarChart3,
  ChevronDown,
} from "lucide-react";
import { Button } from "./ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "./ui/card";
import { Alert, AlertDescription } from "./ui/alert";
import { motion } from "framer-motion";


// Import refactored components
import FileUploadField from "./upload/FileUploadField";
import IntervalSelector from "./upload/IntervalSelector";

// Interface for Zoom Recording (changed from ZoomMeeting)
interface ZoomRecording {
  id: string;
  uuid: string;
  topic: string;
  start_time: string;
  duration: number;
  recording_count: number;
  total_size: number;
  account_id: string;
  host_id: string;
  recording_files: Array<{
    id: string;
    file_type: string;
    file_size: number;
    play_url: string;
    download_url: string;
    recording_type: string;
  }>;
}

interface UploadSectionProps {
  onAnalysisStart?: (
    attendanceFile: File | null,
    transcriptFile: File | null,
    timeInterval: string,
    selectedRecordingId?: string | null  // Changed from selectedMeetingId
  ) => void;
  isVisible?: boolean;
}



const UploadSection = ({
  onAnalysisStart = () => {},
  isVisible = true,
}: UploadSectionProps) => {
  const [attendanceFile, setAttendanceFile] = useState<File | null>(null);
  const [transcriptFile, setTranscriptFile] = useState<File | null>(null);
  const [timeInterval, setTimeInterval] = useState<string>("5");
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [customInterval, setCustomInterval] = useState("");
  const [showCustomInterval, setShowCustomInterval] = useState(false);

  // Zoom Recordings API states (changed from meetings)
  const [recordings, setRecordings] = useState<ZoomRecording[]>([]);
  const [selectedRecording, setSelectedRecording] = useState<ZoomRecording | null>(null);
  const [isLoadingRecordings, setIsLoadingRecordings] = useState<boolean>(false);
  const [showRecordingsDropdown, setShowRecordingsDropdown] = useState<boolean>(false);

  // Fetch Zoom recordings when component mounts
  useEffect(() => {
    if (isVisible) {
      initializeZoom();
    }
  }, [isVisible]);

  const initializeZoom = async () => {
    setIsLoadingRecordings(true);
    setError(null);

    try {
      await fetchZoomRecordings();
    } catch (error: any) {
      console.error('Error initializing Zoom:', error);
      setError(`Failed to load recordings: ${error.message}`);
    } finally {
      setIsLoadingRecordings(false);
    }
  };

  // Commented out the old meetings API call
  /*
  const fetchZoomMeetings = async () => {
    try {
      const response = await fetch(`/api/meetings`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log("Meetings API Response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Backend API returned ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      console.log("Meetings data from backend:", data);

      if (!data.success) {
        throw new Error(data.error || "Failed to fetch meetings from Zoom API");
      }

      if (!data.meetings || data.meetings.length === 0) {
        setMeetings([]);
        setError("No past meetings found in your Zoom account.");
        return;
      }

      // Transform backend response to our format
      const meetingsData: ZoomMeeting[] = data.meetings.map((meeting: any) => ({
        id: meeting.id.toString(),
        topic: meeting.topic || 'Untitled Meeting',
        start_time: meeting.start_time,
        duration: meeting.duration || 0,
        participant_count: 0,
        join_url: meeting.join_url,
      }));

      setMeetings(meetingsData);
      setError(null);
    } catch (error: any) {
      console.error('Error fetching Zoom meetings:', error);
      setError(`Failed to load meetings: ${error.message}`);
      setMeetings([]);
    }
  };
  */

  // NEW: Fetch Zoom recordings instead of meetings
  const fetchZoomRecordings = async () => {
    try {
     const response = await fetch(`/api/recordings`, {
  method: "GET",
  headers: {
    "Content-Type": "application/json",
  },
});


      console.log("Recordings API Response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Backend API returned ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      console.log("Recordings data from backend:", data);

      if (!data.success) {
        throw new Error(data.error || "Failed to fetch recordings");
      }

      if (!data.meetings || data.meetings.length === 0) {
        setRecordings([]);
        setError("No recordings found.");
        return;
      }

      // Transform backend response to our format
      const recordingsData: ZoomRecording[] = data.meetings.map((recording: any) => ({
        id: recording.id.toString(),
        uuid: recording.uuid || '',
        topic: recording.topic || 'Untitled Recording',
        start_time: recording.start_time,
        duration: recording.duration || 0,
        recording_count: recording.recording_count || 0,
        total_size: recording.total_size || 0,
        account_id: recording.account_id,
        host_id: recording.host_id,
        recording_files: recording.recording_files || []
      }));

      setRecordings(recordingsData);
      setError(null);
    } catch (error: any) {
      console.error('Error fetching Zoom recordings:', error);
      setError(`Failed to load recordings: ${error.message}`);
      setRecordings([]);
    }
  };

  // Changed from handleMeetingSelect to handleRecordingSelect
  const handleRecordingSelect = (recording: ZoomRecording) => {
    setSelectedRecording(recording);
    setShowRecordingsDropdown(false);
    setError(null);
  };

  const handleAttendanceFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    setError(null);
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type !== "text/csv" && !file.name.endsWith(".csv")) {
        setError("Please upload a valid CSV file for attendance data");
        return;
      }
      setAttendanceFile(file);
    }
  };

  const handleTranscriptFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    setError(null);
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setTranscriptFile(file);
    }
  };

  const handleTimeIntervalChange = (value: string) => {
    if (value === "custom") {
      setShowCustomInterval(true);
    } else {
      setShowCustomInterval(false);
      setTimeInterval(value);
    }
  };

  const handleCustomIntervalChange = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    setCustomInterval(e.target.value);
  };

  const handleApplyCustomInterval = () => {
    if (customInterval && !isNaN(Number(customInterval))) {
      setTimeInterval(customInterval);
    }
  };

  const handleAnalysisStart = () => {
    // Changed from selectedMeeting to selectedRecording
    if (!selectedRecording && !attendanceFile) {
      setError("Please either select a Zoom recording or upload an attendance CSV file");
      return;
    }

    setIsUploading(true);
    setError(null);

    // Pass the selected recording ID to parent
    onAnalysisStart(
      attendanceFile,
      transcriptFile,
      timeInterval,
      selectedRecording ? selectedRecording.id : null  // Changed from selectedMeeting
    );

    setTimeout(() => {
      setIsUploading(false);
    }, 1500);
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return dateString;
    }
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  if (!isVisible) return null;

  return (
    <div className="w-full max-w-4xl mx-auto p-6">
      <Card className="glass-card shadow-xl dark:shadow-primary/5 border-border/50 overflow-visible">

              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-purple-500/5 pointer-events-none" />
        <CardHeader>
          <CardTitle className="text-2xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
            Upload Zoom Webinar Data
          </CardTitle>
          <CardDescription className="text-muted-foreground text-base">
            Select a Zoom recording or upload files to analyze engagement and retention patterns.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {error}
                <Button
                  variant="outline"
                  size="sm"
                  className="ml-2"
                  onClick={initializeZoom}
                >
                  Retry
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* Commented out the old meetings dropdown */}
          {/*
          <div className="space-y-3">
            <label className="text-base font-medium flex items-center gap-2 text-foreground">
              <Users className="h-4 w-4 text-primary" />
              Select Zoom Meeting
            </label>

            <div className="relative">
              <Button
                onClick={() => setShowMeetingDropdown(!showMeetingDropdown)}
                variant="outline"
                className="w-full h-12 justify-between border-2 border-primary/30 hover:border-primary/60 bg-background/50 hover:bg-background/80 transition-all duration-300"
                disabled={isLoadingMeetings}
              >
                <span className="font-medium truncate">
                  {selectedMeeting ? selectedMeeting.topic : "Select a meeting from Zoom..."}
                </span>
                <ChevronDown className={`h-4 w-4 transition-transform ${showMeetingDropdown ? 'rotate-180' : ''}`} />
              </Button>

              {showMeetingDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="absolute top-full left-0 right-0 mt-1 bg-background border border-border rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto"
                >
                  {isLoadingMeetings ? (
                    <div className="p-4 text-center text-muted-foreground">
                      <div className="h-4 w-4 rounded-full border-2 border-t-transparent border-primary animate-spin mx-auto mb-2"></div>
                      Loading meetings from Zoom API...
                    </div>
                  ) : meetings.length === 0 ? (
                    <div className="p-4 text-center text-muted-foreground">
                      No meetings found in your Zoom account
                    </div>
                  ) : (
                    meetings.map((meeting) => (
                      <button
                        key={meeting.id}
                        onClick={() => handleMeetingSelect(meeting)}
                        className="w-full p-3 text-left hover:bg-primary/10 border-b border-border last:border-b-0 transition-colors"
                      >
                        <div className="font-medium truncate">{meeting.topic}</div>
                        <div className="text-sm text-muted-foreground">
                          {formatDate(meeting.start_time)} • {formatDuration(meeting.duration)}
                        </div>
                        <div className="text-xs text-primary font-mono mt-1">ID: {meeting.id}</div>
                      </button>
                    ))
                  )}
                </motion.div>
              )}
            </div>

            <Selected Meeting Details
            {selectedMeeting && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 border border-primary/20 rounded-lg bg-primary/5 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-primary flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Selected Meeting
                  </h4>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground text-xs">Meeting ID:</span>
                    <div className="font-mono text-xs truncate">{selectedMeeting.id}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">Duration:</span>
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      <span>{formatDuration(selectedMeeting.duration)}</span>
                    </div>
                  </div>
                  <div className="col-span-2">
                    <span className="text-muted-foreground text-xs">Topic:</span>
                    <div className="font-medium truncate">{selectedMeeting.topic}</div>
                  </div>
                  <div className="col-span-2">
                    <span className="text-muted-foreground text-xs">Date & Time:</span>
                    <div>{formatDate(selectedMeeting.start_time)}</div>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
          */}

          {/* NEW: Zoom Recordings Selection */}
          <div className="space-y-3">
            <label className="text-base font-medium flex items-center gap-2 text-foreground">
              <Users className="h-4 w-4 text-primary" />
              Select Zoom Recording
            </label>

            <div className="relative">
              <Button
                onClick={() => setShowRecordingsDropdown(!showRecordingsDropdown)}
                variant="outline"
                className="w-full h-12 justify-between border-2 border-primary/30 hover:border-primary/60 bg-background/50 hover:bg-background/80 transition-all duration-300"
                disabled={isLoadingRecordings}
              >
                <span className="font-medium truncate">
                  {selectedRecording ? selectedRecording.topic : "Select a recording..."}
                </span>
                <ChevronDown className={`h-4 w-4 transition-transform ${showRecordingsDropdown ? 'rotate-180' : ''}`} />
              </Button>

              {showRecordingsDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="absolute top-full left-0 right-0 mt-1 bg-background border border-border rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto"
                >
                  {isLoadingRecordings ? (
                    <div className="p-4 text-center text-muted-foreground">
                      <div className="h-4 w-4 rounded-full border-2 border-t-transparent border-primary animate-spin mx-auto mb-2"></div>
                      Loading recordings...
                    </div>
                  ) : recordings.length === 0 ? (
                    <div className="p-4 text-center text-muted-foreground">
                      No recordings found
                    </div>
                  ) : (
                    recordings.map((recording) => (
                      <button
                        key={recording.id}
                        onClick={() => handleRecordingSelect(recording)}
                        className="w-full p-3 text-left hover:bg-primary/10 border-b border-border last:border-b-0 transition-colors"
                      >
                        <div className="font-medium truncate">{recording.topic}</div>
                        <div className="text-sm text-muted-foreground">
                          {formatDate(recording.start_time)} • {formatDuration(recording.duration)}
                        </div>
                        <div className="text-xs text-primary font-mono mt-1">ID: {recording.id}</div>
                      </button>
                    ))
                  )}
                </motion.div>
              )}
            </div>

            {/* Selected Recording Details */}
            {selectedRecording && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 border border-primary/20 rounded-lg bg-primary/5 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-primary flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Selected Recording
                  </h4>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground text-xs">Recording ID:</span>
                    <div className="font-mono text-xs truncate">{selectedRecording.id}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">Duration:</span>
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      <span>{formatDuration(selectedRecording.duration)}</span>
                    </div>
                  </div>
                  <div className="col-span-2">
                    <span className="text-muted-foreground text-xs">Topic:</span>
                    <div className="font-medium truncate">{selectedRecording.topic}</div>
                  </div>
                  <div className="col-span-2">
                    <span className="text-muted-foreground text-xs">Date & Time:</span>
                    <div>{formatDate(selectedRecording.start_time)}</div>
                  </div>
                </div>
              </motion.div>
            )}
          </div>

           {/* Custom Attendance CSV Upload (Optional)
          <FileUploadField
            id="attendance-file"
            label="Or Upload Custom Attendance CSV"
            icon={<FileSpreadsheet className="h-4 w-4 text-primary" />}
            accept=".csv"
            file={attendanceFile}
            onChange={handleAttendanceFileChange}
            placeholder="Upload Custom CSV (Optional)"
          />  */}

          {/* Transcript File Upload
          <FileUploadField
            id="transcript-file"
            label="Zoom Transcript File (Optional)"
            icon={<FileText className="h-4 w-4 text-primary" />}
            accept=".csv,.srt,.vtt"
            file={transcriptFile}
            onChange={handleTranscriptFileChange}
            placeholder="Upload Transcript File (CSV/SRT/VTT)"
          /> */}

          {/* Time Interval Selection */}
          <IntervalSelector
            timeInterval={timeInterval}
            onTimeIntervalChange={handleTimeIntervalChange}
            customInterval={customInterval}
            onCustomIntervalChange={handleCustomIntervalChange}
            showCustomInterval={showCustomInterval}
            onApplyCustomInterval={handleApplyCustomInterval}
          />
        </CardContent>
        <CardFooter className="flex justify-end pb-6">
          <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
            <Button
              onClick={handleAnalysisStart}
              disabled={(!selectedRecording && !attendanceFile) || isUploading}
              className="flex items-center gap-2 gradient-bg border-0 shadow-md shadow-primary/20 px-6 py-6 h-auto text-base font-medium"
            >
              {isUploading ? (
                <>
                  <div className="h-5 w-5 rounded-full border-2 border-t-transparent border-white animate-spin"></div>
                  Processing...
                </>
              ) : (
                <>
                  Start Analysis
                  <ArrowRight className="h-5 w-5 ml-1" />
                </>
              )}
            </Button>
          </motion.div>
        </CardFooter>
      </Card>
    </div>
  );
};

export default UploadSection;
