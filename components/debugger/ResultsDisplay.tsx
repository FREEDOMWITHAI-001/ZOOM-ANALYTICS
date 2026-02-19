"use client";
import React from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";

interface DebugInfo {
  totalAttendees: number;
  sessionDuration: number;
  totalParticipantIntervals: number;
  maxPossibleParticipantIntervals: number;
  totalParticipantTime: number;
  maxPossibleAttendanceTime: number;
  rawPeakRetention: number;
  rawAverageRetention: number;
}

interface ResultsDisplayProps {
  peakRetention: number;
  averageRetention: number;
  peakParticipants: number;
  averageParticipants: number;
  debugInfo: DebugInfo;
}

const ResultsDisplay: React.FC<ResultsDisplayProps> = ({
  peakRetention,
  averageRetention,
  peakParticipants,
  averageParticipants,
  debugInfo
}) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Calculation Results</CardTitle>
        <CardDescription>Retention metrics and debug info</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <h3 className="font-medium text-lg">Final Metrics</h3>
            <p>
              <strong>Peak Retention:</strong>{" "}
              {peakRetention.toFixed(2)}%
            </p>
            <p>
              <strong>Average Retention:</strong>{" "}
              {averageRetention.toFixed(2)}%
            </p>
            <p>
              <strong>Peak Participants:</strong> {peakParticipants}
            </p>
            <p>
              <strong>Average Participants:</strong>{" "}
              {averageParticipants.toFixed(2)}
            </p>
          </div>

          <div>
            <h3 className="font-medium text-lg">Debug Information</h3>
            <p>
              <strong>Total Attendees:</strong>{" "}
              {debugInfo.totalAttendees}
            </p>
            <p>
              <strong>Session Duration:</strong>{" "}
              {debugInfo.sessionDuration.toFixed(2)} minutes
            </p>
            
            {/* Show either interval-based or direct calculation metrics */}
            {debugInfo.totalParticipantIntervals > 0 ? (
              <>
                <p>
                  <strong>Total Participant Intervals:</strong>{" "}
                  {debugInfo.totalParticipantIntervals}
                </p>
                <p>
                  <strong>Max Possible Participant Intervals:</strong>{" "}
                  {debugInfo.maxPossibleParticipantIntervals}
                </p>
              </>
            ) : (
              <>
                <p>
                  <strong>Total Participant Time:</strong>{" "}
                  {debugInfo.totalParticipantTime.toFixed(2)} minutes
                </p>
                <p>
                  <strong>Max Possible Attendance Time:</strong>{" "}
                  {debugInfo.maxPossibleAttendanceTime.toFixed(2)} minutes
                </p>
              </>
            )}
            
            <p>
              <strong>Raw Peak Retention:</strong>{" "}
              {debugInfo.rawPeakRetention.toFixed(2)}%
            </p>
            <p>
              <strong>Raw Average Retention:</strong>{" "}
              {debugInfo.rawAverageRetention.toFixed(2)}%
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ResultsDisplay;