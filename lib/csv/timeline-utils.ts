import { AttendeeRecord, DataPoint, TimelineEvent } from "./types";

/**
 * Format timestamp for display in the graph
 * Returns a format like "MM-DD HH:MM" (e.g., "04-19 15:30")
 */
const formatTimeForDisplay = (date: Date): string => {
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const hour = date.getHours().toString().padStart(2, '0');
  const minute = date.getMinutes().toString().padStart(2, '0');
  
  return `${month}-${day} ${hour}:${minute}`;
};

/**
 * Implements the algorithm to create the "Number of People in Webinar Over Time" Graph
 * 
 * This is the main function for generating attendance timeline data
 */
export const generateAttendanceTimeline = (
  attendees: AttendeeRecord[],
  intervalMinutes: number = 1, // Default to 1-minute intervals
): DataPoint[] => {
  if (attendees.length === 0) return [];

  // Step 1: Initialize an empty list to store attendance events
  const timeline: TimelineEvent[] = [];

  // Step 2: Populate with join/leave events for each attendee
  for (const attendee of attendees) {
    // Add join event (+1)
    timeline.push({
      timestamp: attendee.joinTime.getTime(),
      delta: 1
    });
    
    // Add leave event (-1)
    timeline.push({
      timestamp: attendee.leaveTime.getTime(),
      delta: -1
    });
  }

  // Step 3: Sort the timeline by timestamp (to process events in order)
  timeline.sort((a, b) => {
    if (a.timestamp === b.timestamp) {
      return a.delta - b.delta; // Prioritize leave events over join events at the same timestamp
    }
    return a.timestamp - b.timestamp;
  });

  // Step 4: Calculate the number of people at each time point (in real-time)
  let currentPeople = 0;
  const exactAttendance: { timestamp: number; participants: number }[] = [];

  // Push the initial state (start with 0 participants at the earliest time)
  exactAttendance.push({ timestamp: timeline[0].timestamp, participants: 0 });

  for (const event of timeline) {
    currentPeople += event.delta;
    exactAttendance.push({
      timestamp: event.timestamp,
      participants: currentPeople
    });
  }

  // Step 5: Generate data points at regular intervals for smooth visualization
  const result: DataPoint[] = [];
  const samplingIntervalMs = intervalMinutes * 60 * 1000;

  const startTimestamp = exactAttendance[0].timestamp;
  const endTimestamp = exactAttendance[exactAttendance.length - 1].timestamp;

  // Step 6: Create regular time intervals from start to end
  for (let t = startTimestamp; t <= endTimestamp; t += samplingIntervalMs) {
    // Find the attendance value at this time
    let participantCount = 0;

    // Find the latest event that occurred before or at this time point
    for (let i = 0; i < exactAttendance.length && exactAttendance[i].timestamp <= t; i++) {
      participantCount = exactAttendance[i].participants;
    }

    // Format time for display (MM-DD HH:MM)
    const timeStr = formatTimeForDisplay(new Date(t));

    result.push({
      time: timeStr,
      participants: participantCount
    });
  }

  return result;
};

/**
 * Legacy function for backward compatibility
 * Simply redirects to the new implementation
 */
export const generateTimeIntervals = (
  attendees: AttendeeRecord[],
  intervalMinutes: number,
): DataPoint[] => {
  return generateAttendanceTimeline(attendees, intervalMinutes);
};