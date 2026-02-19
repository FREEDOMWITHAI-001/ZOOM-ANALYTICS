import { AttendeeRecord, DataPoint, RetentionMetrics } from "./types";

/**
 * Calculate retention metrics based on attendance data
 * 
 * Implements the algorithm:
 * 1. Peak Retention: Maximum number of concurrent attendees / total unique attendees
 * 2. Average Retention: Average percentage of time that attendees stayed
 */
export const calculateRetentionMetrics = (
  timeIntervals: DataPoint[],
  totalAttendees: number,
  attendees?: AttendeeRecord[],
): RetentionMetrics => {
  if ((timeIntervals.length === 0 && (!attendees || attendees.length === 0)) || totalAttendees === 0) {
    return {
      peakRetention: 0,
      averageRetention: 0,
      peakParticipants: 0,
      averageParticipants: 0,
      debugInfo: {
        totalAttendees,
        sessionDuration: 0,
        totalParticipantIntervals: 0,
        totalParticipantTime: 0,
        maxPossibleParticipantIntervals: 0,
        maxPossibleAttendanceTime: 0,
        rawPeakRetention: 0,
        rawAverageRetention: 0,
      },
    };
  }

  // If attendee records are available, use the minute-by-minute attendance method as requested
  if (attendees && attendees.length > 0) {
    return calculateMinuteByMinuteRetention(attendees, totalAttendees);
  }

  // Use the interval-based calculation as fallback
  return calculateRetentionMetricsFromIntervals(timeIntervals, totalAttendees);
};

/**
 * Calculate retention metrics using the minute-by-minute approach
 * This implements the algorithm as requested by the user:
 * 1. Create minute-by-minute intervals
 * 2. Track attendance in each interval
 * 3. Sum attendance across all intervals
 * 4. Calculate average
 */
const calculateMinuteByMinuteRetention = (
  attendees: AttendeeRecord[],
  totalAttendees: number,
): RetentionMetrics => {
  // Step 1: Find earliest join and latest leave to calculate session bounds
  let earliestJoin = attendees[0].joinTime.getTime();
  let latestLeave = attendees[0].leaveTime.getTime();
  
  for (const attendee of attendees) {
    earliestJoin = Math.min(earliestJoin, attendee.joinTime.getTime());
    latestLeave = Math.max(latestLeave, attendee.leaveTime.getTime());
  }
  
  // Step 2: Create minute-by-minute intervals
  const minuteMs = 60 * 1000; // 1 minute in milliseconds
  const totalMinutes = Math.ceil((latestLeave - earliestJoin) / minuteMs);
  
  // Initialize attendance count for each minute
  const attendanceByMinute: number[] = Array(totalMinutes).fill(0);
  
  // Step 3: Track attendance in each interval
  for (const attendee of attendees) {
    // Convert join and leave times to minute indices
    const joinMinuteIndex = Math.floor((attendee.joinTime.getTime() - earliestJoin) / minuteMs);
    const leaveMinuteIndex = Math.ceil((attendee.leaveTime.getTime() - earliestJoin) / minuteMs);
    
    // Mark attendance for each minute this attendee was present
    for (let i = joinMinuteIndex; i < leaveMinuteIndex && i < totalMinutes; i++) {
      if (i >= 0) {
        attendanceByMinute[i]++;
      }
    }
  }
  
  // Step 4: Calculate metrics
  // Find peak attendance (maximum concurrent attendees)
  const peakAttendance = Math.max(...attendanceByMinute);
  
  // Calculate total attendance (sum of all minute-by-minute attendance counts)
  const totalAttendanceMinutes = attendanceByMinute.reduce((sum, count) => sum + count, 0);
  
  // Calculate average attendance per minute
  const averageAttendance = totalAttendanceMinutes / totalMinutes;
  
  // Calculate retention percentages
  const rawPeakRetention = (peakAttendance / totalAttendees) * 100;
  const peakRetention = Math.min(100, rawPeakRetention);
  
  // Average retention is the percentage of possible attendance time actually spent
  const maxPossibleAttendanceMinutes = totalAttendees * totalMinutes;
  const rawAverageRetention = (totalAttendanceMinutes / maxPossibleAttendanceMinutes) * 100;
  const averageRetention = Math.min(100, rawAverageRetention);

  return {
    peakRetention,
    averageRetention,
    peakParticipants: peakAttendance,
    averageParticipants: averageAttendance,
    debugInfo: {
      totalAttendees,
      sessionDuration: totalMinutes,
      totalParticipantIntervals: totalAttendanceMinutes,
      maxPossibleParticipantIntervals: maxPossibleAttendanceMinutes,
      totalParticipantTime: totalAttendanceMinutes, // For compatibility
      maxPossibleAttendanceTime: maxPossibleAttendanceMinutes, // For compatibility
      rawPeakRetention,
      rawAverageRetention,
    },
  };
};

/**
 * Calculate retention metrics based on time intervals
 * This maintains compatibility with the existing code
 */
const calculateRetentionMetricsFromIntervals = (
  timeIntervals: DataPoint[],
  totalAttendees: number,
): RetentionMetrics => {
  // Find peak participants count (max concurrency)
  const peakParticipants = Math.max(
    ...timeIntervals.map((interval) => interval.participants),
  );

  // Calculate total session duration (in time intervals)
  const sessionDuration = timeIntervals.length;

  // Calculate the sum of all participant-intervals
  // Each participant-interval represents one person attending for one interval
  const totalParticipantIntervals = timeIntervals.reduce(
    (sum, interval) => sum + interval.participants,
    0,
  );

  // Calculate the maximum possible participant-intervals if everyone attended the whole session
  const maxPossibleParticipantIntervals = totalAttendees * sessionDuration;

  // Calculate raw values before applying any caps
  const rawPeakRetention = (peakParticipants / totalAttendees) * 100;
  const rawAverageRetention =
    (totalParticipantIntervals / maxPossibleParticipantIntervals) * 100;

  // Apply caps to ensure values don't exceed 100%
  const peakRetention = Math.min(100, rawPeakRetention);
  const averageRetention = Math.min(100, rawAverageRetention);

  // Calculate average participants per interval
  const averageParticipants = totalParticipantIntervals / sessionDuration;

  return {
    peakRetention,
    averageRetention,
    peakParticipants,
    averageParticipants,
    debugInfo: {
      totalAttendees,
      sessionDuration,
      totalParticipantIntervals,
      maxPossibleParticipantIntervals,
      totalParticipantTime: 0, // For compatibility with direct method
      maxPossibleAttendanceTime: 0, // For compatibility with direct method
      rawPeakRetention,
      rawAverageRetention,
    },
  };
};