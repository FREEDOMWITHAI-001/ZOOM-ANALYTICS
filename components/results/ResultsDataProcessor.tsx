"use client";
import { useState, useEffect, useCallback } from "react";
import { 
  parseAttendanceCSV, 
  generateAttendanceTimeline,
  calculateTotalAttendees,
  type AttendeeRecord,
  type DataPoint,
  generateSampleData
} from "@/lib/utils";

import { calculateRetentionMetrics } from "@/lib/csv";
import { parseVTTCaptions, type CaptionSegment } from "@/lib/captions/caption-parser";
import { generateShortInsight } from "@/services/openai-service";

interface UseResultsDataProcessorProps {
  attendanceFile: File | null;
  transcriptFile: File | null;
  comparisonAttendanceFile: File | null;
  timeInterval: string;
  isComparisonMode: boolean;
}

interface InsightItem {
  timeInterval: string;
  count: number;
  percentageChange: number;
  description?: string;
}

export const useResultsDataProcessor = ({
  attendanceFile,
  transcriptFile,
  comparisonAttendanceFile,
  timeInterval,
  isComparisonMode
}: UseResultsDataProcessorProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [attendees, setAttendees] = useState<AttendeeRecord[]>([]);
  const [comparisonAttendees, setComparisonAttendees] = useState<AttendeeRecord[]>([]);

  // Statistics data
  const [totalAttendees, setTotalAttendees] = useState<number>(0);
  const [peakRetention, setPeakRetention] = useState<number>(0);
  const [averageRetention, setAverageRetention] = useState<number>(0);
  const [peakParticipants, setPeakParticipants] = useState<number>(0);
  const [averageParticipants, setAverageParticipants] = useState<number>(0);

  // Retention graph data
  const [retentionData, setRetentionData] = useState<DataPoint[]>([]);
  const [comparisonRetentionData, setComparisonRetentionData] = useState<DataPoint[]>([]);

  // Insights data
  const [peaks, setPeaks] = useState<InsightItem[]>([]);
  const [dropoffs, setDropoffs] = useState<InsightItem[]>([]);
  const [comparisonPeaks, setComparisonPeaks] = useState<InsightItem[]>([]);
  const [comparisonDropoffs, setComparisonDropoffs] = useState<InsightItem[]>([]);
  
  // AI insights data
  const [insights, setInsights] = useState<string[]>([]);
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [comparisonInsights, setComparisonInsights] = useState<string[]>([]);
  const [comparisonRecommendations, setComparisonRecommendations] = useState<string[]>([]);
  
  // Caption data from transcript file
  const [captionData, setCaptionData] = useState<CaptionSegment[]>([]);

  // New state for country distribution data
  const [countryData, setCountryData] = useState<{label: string, value: number}[]>([]);
  
  // New state for extra columns data
  const [extraColumnsData, setExtraColumnsData] = useState<{
    columns: string[];
    data: Record<string, {label: string, value: number}[]>;
  }>({
    columns: [],
    data: {}
  });
  
  // State to track which extra columns are enabled for display
  const [enabledExtraColumns, setEnabledExtraColumns] = useState<string[]>([]);

  // Helper function to read file content as text
  const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          resolve(e.target.result as string);
        } else {
          reject(new Error("Failed to read file"));
        }
      };
      reader.onerror = () => reject(new Error("Error reading file"));
      reader.readAsText(file);
    });
  };

  // Process the attendance data from fileContent
  const processAttendanceData = async (fileContent: string): Promise<AttendeeRecord[]> => {
    console.log("Processing attendance data...");
    
    // Basic validation - check if the file appears to be a CSV
    if (!fileContent || typeof fileContent !== 'string') {
      throw new Error("The uploaded file is empty or could not be read. Please check the file and try again.");
    }
    
    if (!fileContent.includes(',')) {
      throw new Error(
        "The uploaded file does not appear to be a valid CSV file. " + 
        "Please ensure it contains comma-separated values and has the expected Zoom format."
      );
    }

    // Get a preview of the first few lines to help with debugging
    try {
      // Log the first 100 characters to help with debugging
      console.log(`CSV data preview: ${fileContent.substring(0, 100)}...`);
      
      const attendees = parseAttendanceCSV(fileContent);
      console.log(`Successfully processed ${attendees.length} attendance records`);
      
      if (attendees.length === 0) {
        throw new Error("No valid attendance records found in the file. The file may be empty or in an incorrect format.");
      }
      
      return attendees;
    } catch (error) {
      console.error("Error parsing CSV:", error);
      
      // Add more detailed information to the original error
      const enhancedError = new Error(
        `${error.message}\n\n` +
        "The expected CSV format should include columns for: \n" +
        "- User Name (Original Name)\n" +
        "- Email (optional)\n" +
        "- Join Time (format: 'Mar 22, 2025 20:25:35')\n" +
        "- Leave Time (format: 'Mar 22, 2025 20:25:35')\n" +
        "- Time in Session (minutes) (optional)\n\n" +
        "If you exported this file from Zoom, please ensure you're using the Attendee Report, " +
        "not the Registration Report or other Zoom report types."
      );
      enhancedError.stack = error.stack;
      throw enhancedError;
    }
  };

  // Generate descriptions for peaks and dropoffs
  const generatePeakDescription = (percentageChange: number): string => {
    const descriptions = [
      "Possible content engagement spike",
      "Q&A or interactive segment",
      "Presentation of key information",
      "Demo or visual content",
      "Guest speaker or new topic",
    ];

    // Select a description based on the percentage change
    const index = Math.min(
      Math.floor(percentageChange / 3),
      descriptions.length - 1,
    );
    return descriptions[index];
  };

  const generateDropoffDescription = (percentageChange: number): string => {
    const descriptions = [
      "Brief attention drop",
      "Possible technical issue",
      "Content complexity increase",
      "Break announcement",
      "Session conclusion approaching",
    ];

    // Select a description based on the absolute percentage change
    const absChange = Math.abs(percentageChange);
    const index = Math.min(Math.floor(absChange / 3), descriptions.length - 1);
    return descriptions[index];
  };

  // Generate insights from time intervals using memoization
  const generateInsights = useCallback(
    (
      intervals: DataPoint[],
    ): { peakInsights: InsightItem[]; dropoffInsights: InsightItem[] } => {
      if (intervals.length < 2) {
        return { peakInsights: [], dropoffInsights: [] };
      }

      const changes: {
        timeInterval: string;
        count: number;
        percentageChange: number;
      }[] = [];

      // Calculate percentage changes between intervals
      for (let i = 1; i < intervals.length; i++) {
        const current = intervals[i].participants;
        const previous = intervals[i - 1].participants;

        if (previous === 0) continue;

        const percentageChange = ((current - previous) / previous) * 100;
        const timeInterval = `${intervals[i - 1].time} - ${intervals[i].time}`;

        changes.push({
          timeInterval,
          count: current,
          percentageChange: parseFloat(percentageChange.toFixed(1)),
        });
      }

      // Sort by percentage change (positive for peaks, negative for dropoffs)
      const sortedPeaks = [...changes]
        .filter((change) => change.percentageChange > 0)
        .sort((a, b) => b.percentageChange - a.percentageChange)
        .slice(0, 5);

      const sortedDropoffs = [...changes]
        .filter((change) => change.percentageChange < 0)
        .sort((a, b) => a.percentageChange - b.percentageChange)
        .slice(0, 5);
      
      // Add AI-based descriptions if caption data is available
      const peakInsights = sortedPeaks.map((peak) => {
        let description = generatePeakDescription(peak.percentageChange);
        
        // If caption data is available, try to generate a more relevant description
        if (captionData && captionData.length > 0) {
          try {
            // Extract the timestamp from the interval
            const timePoint = peak.timeInterval.split('-')[0].trim();
            let pointTime = new Date();
            
            // Try to parse the time component
            const timeComponents = timePoint.split(':');
            if (timeComponents.length >= 2) {
              const [hours, minutes] = timeComponents.map(Number);
              pointTime.setHours(hours, minutes, 0, 0);
            }
            
            // Find relevant captions for this time period
            const relevantCaptions = captionData.filter(caption => {
              try {
                const captionHour = new Date(caption.startTime).getHours();
                const pointHour = pointTime.getHours();
                return Math.abs(captionHour - pointHour) <= 1; // Within 1 hour
              } catch (err) {
                return false;
              }
            });
            
            // Extract text from relevant captions
            const captionText = relevantCaptions
              .map(caption => caption.text)
              .join(' ');
            
            if (captionText && captionText.trim().length > 0) {
              // Generate a short AI insight
              description = generateShortInsight(
                'peak',
                peak.timeInterval,
                peak.count,
                captionText
              );
            }
          } catch (error) {
            console.error('Error generating AI insight for peak:', error);
            // Fallback to the default description
          }
        }
        
        return {
          ...peak,
          description
        };
      });

      const dropoffInsights = sortedDropoffs.map((dropoff) => {
        let description = generateDropoffDescription(dropoff.percentageChange);
        
        // If caption data is available, try to generate a more relevant description
        if (captionData && captionData.length > 0) {
          try {
            // Extract the timestamp from the interval
            const timePoint = dropoff.timeInterval.split('-')[0].trim();
            let pointTime = new Date();
            
            // Try to parse the time component
            const timeComponents = timePoint.split(':');
            if (timeComponents.length >= 2) {
              const [hours, minutes] = timeComponents.map(Number);
              pointTime.setHours(hours, minutes, 0, 0);
            }
            
            // Find relevant captions for this time period
            const relevantCaptions = captionData.filter(caption => {
              try {
                const captionHour = new Date(caption.startTime).getHours();
                const pointHour = pointTime.getHours();
                return Math.abs(captionHour - pointHour) <= 1; // Within 1 hour
              } catch (err) {
                return false;
              }
            });
            
            // Extract text from relevant captions
            const captionText = relevantCaptions
              .map(caption => caption.text)
              .join(' ');
            
            if (captionText && captionText.trim().length > 0) {
              // Generate a short AI insight
              description = generateShortInsight(
                'drop',
                dropoff.timeInterval,
                Math.abs(dropoff.count),
                captionText
              );
            }
          } catch (error) {
            console.error('Error generating AI insight for dropoff:', error);
            // Fallback to the default description
          }
        }
        
        return {
          ...dropoff,
          description
        };
      });

      return { peakInsights, dropoffInsights };
    },
    [captionData] // Add captionData as a dependency
  );

  // Generate AI insights and recommendations with memoization
  const generateAIInsights = useCallback(
    (intervals: DataPoint[], attendeeRecords: AttendeeRecord[]) => {
      // This would typically be an API call to an AI service
      // For now, we'll generate some insights based on the data patterns
      if (!intervals.length || !attendeeRecords.length) return;

      const generatedInsights = [];
      const generatedRecommendations = [];

      // Find peak attendance time - do this once and cache the result
      const peakInterval = intervals.reduce(
        (max, interval) =>
          interval.participants > max.participants ? interval : max,
        intervals[0],
      );

      if (peakInterval) {
        generatedInsights.push(
          `Peak attendance of ${peakInterval.participants} participants occurred at ${peakInterval.time}`,
        );
      }

      // Find biggest drop-off - optimize by calculating all drops in a single pass
      let biggestDropoff = { time: "", percentage: 0 };
      const dropoffs = [];

      for (let i = 1; i < intervals.length; i++) {
        const current = intervals[i].participants;
        const previous = intervals[i - 1].participants;

        if (previous === 0) continue;

        const dropPercentage = ((previous - current) / previous) * 100;
        if (dropPercentage > 0) {
          dropoffs.push({
            time: `${intervals[i - 1].time} to ${intervals[i].time}`,
            percentage: dropPercentage,
          });

          if (dropPercentage > biggestDropoff.percentage) {
            biggestDropoff = {
              time: `${intervals[i - 1].time} to ${intervals[i].time}`,
              percentage: dropPercentage,
            };
          }
        }
      }

      if (biggestDropoff.time) {
        generatedInsights.push(
          `Largest drop-off of ${biggestDropoff.percentage.toFixed(1)}% occurred from ${biggestDropoff.time}`,
        );
      }

      // Analyze attendance patterns - optimize by pre-calculating sums
      const halfwayPoint = Math.floor(intervals.length / 2);
      const firstHalfSum = intervals
        .slice(0, halfwayPoint)
        .reduce((sum, interval) => sum + interval.participants, 0);

      const secondHalfSum = intervals
        .slice(halfwayPoint)
        .reduce((sum, interval) => sum + interval.participants, 0);

      const firstHalfAvg = firstHalfSum / halfwayPoint;
      const secondHalfAvg = secondHalfSum / (intervals.length - halfwayPoint);

      if (firstHalfAvg > secondHalfAvg) {
        const dropPercentage =
          ((firstHalfAvg - secondHalfAvg) / firstHalfAvg) * 100;
        generatedInsights.push(
          `Attendance dropped by ${dropPercentage.toFixed(1)}% in the second half of the webinar`,
        );
        generatedRecommendations.push(
          "Consider shortening the webinar or adding more engaging content in the second half",
        );
      } else if (secondHalfAvg > firstHalfAvg) {
        const increasePercentage =
          ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100;
        generatedInsights.push(
          `Attendance increased by ${increasePercentage.toFixed(1)}% in the second half of the webinar`,
        );
        generatedRecommendations.push(
          "The second half content was more engaging - consider similar content for future webinars",
        );
      }

      // Analyze join times - optimize by calculating the min join time once
      const webinarStartTime = attendeeRecords.reduce(
        (min, record) => (record.joinTime < min ? record.joinTime : min),
        attendeeRecords[0].joinTime,
      );

      const earlyJoiners = attendeeRecords.filter((record) => {
        const minutesDifference =
          (record.joinTime.getTime() - webinarStartTime.getTime()) /
          (1000 * 60);
        return minutesDifference <= 5;
      }).length;

      const earlyJoinPercentage = (earlyJoiners / attendeeRecords.length) * 100;
      generatedInsights.push(
        `${earlyJoinPercentage.toFixed(1)}% of attendees joined within the first 5 minutes`,
      );

      if (earlyJoinPercentage < 50) {
        generatedRecommendations.push(
          "Consider sending reminders closer to the webinar start time to improve punctuality",
        );
      }

      // Analyze duration - optimize by pre-calculating the sum
      const totalDuration = attendeeRecords.reduce(
        (sum, record) => sum + (record.duration || 0),
        0,
      );
      const averageDuration = totalDuration / attendeeRecords.length;

      // Parse the time string for the webinar duration
      let webinarDuration = intervals.length * parseInt(timeInterval);
      // If the time format contains actual timestamps, calculate duration differently
      if (intervals.length > 0 && intervals[intervals.length - 1].time.includes(':')) {
        try {
          // Use the total session time from the metrics calculation
          const lastTimePoint = new Date(intervals[intervals.length - 1].time);
          const firstTimePoint = new Date(intervals[0].time);
          webinarDuration = (lastTimePoint.getTime() - firstTimePoint.getTime()) / (60 * 1000);
        } catch (e) {
          console.log("Unable to calculate precise webinar duration from timestamps", e);
        }
      }

      const retentionRate = (averageDuration / webinarDuration) * 100;
      generatedInsights.push(
        `Average attendance duration was ${averageDuration.toFixed(0)} minutes (${retentionRate.toFixed(1)}% of total webinar time)`,
      );

      if (retentionRate < 70) {
        generatedRecommendations.push(
          "Content may be too long - consider breaking into shorter, more focused webinars",
        );
      }

      // Add general recommendations
      generatedRecommendations.push(
        "Add interactive elements every 15-20 minutes to maintain engagement",
      );
      generatedRecommendations.push(
        "Consider incorporating Q&A sessions throughout the webinar, not just at the end",
      );
      generatedRecommendations.push(
        "Use visual content and demonstrations to keep audience attention",
      );

      setInsights(generatedInsights);
      setRecommendations(generatedRecommendations);
    },
    [timeInterval],
  );

  // Generate sample data for demonstration
  const handleGenerateSampleData = () => {
    console.log("Generating sample data for demonstration");
    
    // Get sample attendees from utility function
    const sampleAttendees = generateSampleData();
    
    // Set the attendees state to use these sample records
    setAttendees(sampleAttendees);
    
    // Set a notice in the error state to indicate this is sample data
    setError("Using sample data for demonstration. This is not your actual data.");
  };

  // Process the extracted data to generate visualizations for country and extra columns
  const processExtraColumnsData = useCallback((attendees: AttendeeRecord[]) => {
    // Process country data if available
    const countryMap: Record<string, number> = {};
    const extraColumnsMap: Record<string, Record<string, number>> = {};
    const extraColumnsSet = new Set<string>();
    
    // First pass to identify all extra columns
    attendees.forEach(attendee => {
      if (attendee.country) {
        countryMap[attendee.country] = (countryMap[attendee.country] || 0) + 1;
      }
      
      if (attendee.extraData) {
        Object.entries(attendee.extraData).forEach(([column, value]) => {
          extraColumnsSet.add(column);
          
          if (!extraColumnsMap[column]) {
            extraColumnsMap[column] = {};
          }
          
          extraColumnsMap[column][value] = (extraColumnsMap[column][value] || 0) + 1;
        });
      }
    });
    
    // Convert country data to chart format
    const countryChartData = Object.entries(countryMap)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);
    
    // Convert extra columns data to chart format
    const allExtraColumns = Array.from(extraColumnsSet);
    const extraColumnsChartData: Record<string, {label: string, value: number}[]> = {};
    
    allExtraColumns.forEach(column => {
      if (extraColumnsMap[column]) {
        extraColumnsChartData[column] = Object.entries(extraColumnsMap[column])
          .map(([label, value]) => ({ label, value }))
          .sort((a, b) => b.value - a.value);
      }
    });
    
    // Update state with the processed data
    setCountryData(countryChartData);
    setExtraColumnsData({
      columns: allExtraColumns,
      data: extraColumnsChartData
    });
    
    // By default, enable all extra columns
    setEnabledExtraColumns(allExtraColumns);
    
  }, []);

  // Use memoization for processing attendance data with optimized performance for large datasets
  useEffect(() => {
    if (!attendees.length) return;

    try {
      // Calculate total unique attendees
      const total = calculateTotalAttendees(attendees);
      setTotalAttendees(total);

      // Generate time intervals with concurrency counts using the new algorithm
      const intervalMinutes = parseInt(timeInterval);
      const intervals = generateAttendanceTimeline(attendees, intervalMinutes);
      setRetentionData(intervals);

      // Calculate retention metrics
      const metrics = calculateRetentionMetrics(intervals, total, attendees);
      setPeakRetention(parseFloat(metrics.peakRetention.toFixed(1)));
      setAverageRetention(parseFloat(metrics.averageRetention.toFixed(1)));
      setPeakParticipants(metrics.peakParticipants);
      setAverageParticipants(parseFloat(metrics.averageParticipants.toFixed(1)));

      // Generate insights
      const { peakInsights, dropoffInsights } = generateInsights(intervals);
      setPeaks(peakInsights);
      setDropoffs(dropoffInsights);

      // Generate AI insights and recommendations
      generateAIInsights(intervals, attendees);

      // Add processExtraColumnsData to the data processing flow
      if (attendees.length > 0) {
        processExtraColumnsData(attendees);
      }
    } catch (err) {
      console.error("Error processing attendance data:", err);
      const errorMessage = err instanceof Error
        ? err.message
        : "Failed to analyze attendance data";
      setError(errorMessage);
    }
  }, [attendees, timeInterval, generateInsights, generateAIInsights, processExtraColumnsData]);

  // Process the attendance data file when it changes
  useEffect(() => {
    if (!attendanceFile) return;

    const processFile = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Read the file content
        const fileContent = await readFileAsText(attendanceFile);
        console.log("CSV loaded, now parsing...");

        // Process the data
        const attendeeRecords = await processAttendanceData(fileContent);
        setAttendees(attendeeRecords);
      } catch (err) {
        // Better error logging with serialized error details
        console.error("Error processing attendance data:", err instanceof Error ? 
          { message: err.message, stack: err.stack } : 
          String(err));

        const errorMessage = err instanceof Error
          ? err.message
          : "Failed to process attendance data";
        
        setError(errorMessage + "\n\nClick 'Use Sample Data' below if you'd like to see a demonstration with sample data.");
      } finally {
        setIsLoading(false);
      }
    };

    processFile();
  }, [attendanceFile]);

  // Process comparison data when it changes
  useEffect(() => {
    if (!comparisonAttendanceFile || !isComparisonMode) return;

    const processFile = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Read the file content
        const fileContent = await readFileAsText(comparisonAttendanceFile);
        
        // Process the data
        const attendeeRecords = await processAttendanceData(fileContent);
        setComparisonAttendees(attendeeRecords);
      } catch (err) {
        // Better error logging with serialized error details
        console.error("Error processing comparison data:", err instanceof Error ? 
          { message: err.message, stack: err.stack } : 
          String(err));

        const errorMessage = err instanceof Error
          ? err.message
          : "Failed to process comparison data";
        setError(errorMessage + "\n\nPlease ensure your comparison file is in the correct format.");
      } finally {
        setIsLoading(false);
      }
    };

    processFile();
  }, [comparisonAttendanceFile, isComparisonMode]);

  // Use memoization for processing comparison data
  useEffect(() => {
    if (!comparisonAttendees.length || !isComparisonMode) return;

    // Generate time intervals using the new algorithm
    const intervalMinutes = parseInt(timeInterval);
    const intervals = generateAttendanceTimeline(comparisonAttendees, intervalMinutes);
    setComparisonRetentionData(intervals);

    // Generate insights
    const { peakInsights, dropoffInsights } = generateInsights(intervals);
    setComparisonPeaks(peakInsights);
    setComparisonDropoffs(dropoffInsights);

    // Generate AI insights for comparison if needed
    // This would be similar to the main generateAIInsights but for comparison data
    // For simplicity, we're not implementing it here
  }, [comparisonAttendees, timeInterval, isComparisonMode, generateInsights]);
  
  // Process transcript file when it changes
  useEffect(() => {
    if (!transcriptFile) return;
    
    const processTranscriptFile = async () => {
      try {
        // Only process VTT files
        if (!transcriptFile.name.toLowerCase().endsWith('.vtt')) {
          console.log('Skipping non-VTT file:', transcriptFile.name);
          return;
        }
        
        console.log('Processing transcript file:', transcriptFile.name);
        const fileContent = await readFileAsText(transcriptFile);
        
        // Parse the VTT captions
        const parsedCaptions = parseVTTCaptions(fileContent);
        console.log(`Parsed ${parsedCaptions.length} caption segments`);
        setCaptionData(parsedCaptions);
      } catch (err) {
        console.error('Error processing transcript file:', err);
        // We don't set this as a blocking error since captions are optional
      }
    };
    
    processTranscriptFile();
  }, [transcriptFile]);

  // Function to toggle visibility of extra column charts
  const toggleExtraColumn = (column: string) => {
    setEnabledExtraColumns(prev => {
      if (prev.includes(column)) {
        return prev.filter(col => col !== column);
      } else {
        return [...prev, column];
      }
    });
  };

  return {
    isLoading,
    error,
    attendees,
    comparisonAttendees,
    totalAttendees,
    peakRetention,
    averageRetention,
    peakParticipants,
    averageParticipants,
    retentionData,
    comparisonRetentionData,
    peaks,
    dropoffs,
    comparisonPeaks,
    comparisonDropoffs,
    insights,
    recommendations,
    comparisonInsights,
    comparisonRecommendations,
    captionData,
    generateSampleData: handleGenerateSampleData,
    countryData,
    extraColumnsData,
    enabledExtraColumns,
    toggleExtraColumn
  };
};