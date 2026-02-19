/**
 * Core data types for attendance analysis
 */

/**
 * Represents a single attendee record with join and leave times
 */
export interface AttendeeRecord {
  name?: string;
  email?: string;
  joinTime: Date;
  leaveTime: Date;
  duration?: number; // in minutes
  country?: string;  // Country/Region field
  extraData?: Record<string, string>; // For storing any additional columns from the CSV
}

/**
 * Represents a single data point in the attendance timeline
 */
export interface DataPoint {
  time: string;
  participants: number;
}

/**
 * Represents a join or leave event in the timeline
 */
export interface TimelineEvent {
  timestamp: number;  // Unix timestamp
  delta: number;      // +1 for join, -1 for leave
}

/**
 * Debug info for retention metrics
 */
export interface RetentionDebugInfo {
  totalAttendees: number;
  sessionDuration: number;
  totalParticipantIntervals: number;
  maxPossibleParticipantIntervals: number;
  totalParticipantTime: number; // For compatibility
  maxPossibleAttendanceTime: number; // For compatibility
  rawPeakRetention: number;
  rawAverageRetention: number;
}

/**
 * Retention metrics calculation results
 */
export interface RetentionMetrics {
  peakRetention: number;
  averageRetention: number;
  peakParticipants: number;
  averageParticipants: number;
  debugInfo: RetentionDebugInfo;
}