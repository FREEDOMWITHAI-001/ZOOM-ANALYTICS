import Papa from "papaparse";

export interface AttendeeRecord {
  name?: string;
  email?: string;
  joinTime: Date;
  leaveTime: Date;
  duration?: number; // in minutes
}

export interface DataPoint {
  time: string;
  participants: number;
}

// Timeline event structure
export interface TimelineEvent {
  timestamp: number;  // Unix timestamp
  delta: number;      // +1 for join, -1 for leave
}

/**
 * Preprocess Zoom CSV file to handle files with meeting summary, host details,
 * and panelist details sections before the actual attendee data.
 * 
 * If "Attendee Details" is found in the file, only returns the CSV content
 * starting from that section.
 */
export const preprocessZoomCsv = (csvContent: string): string => {
  if (!csvContent || typeof csvContent !== 'string') {
    return csvContent;
  }

  console.log("Preprocessing CSV file...");
  
  // Split the content into lines
  const lines = csvContent.split(/\r?\n/);
  
  // Look for the "Attendee Details" marker
  const attendeeDetailsIndex = lines.findIndex(line => 
    line.trim().startsWith("Attendee Details"));
  
  if (attendeeDetailsIndex >= 0 && attendeeDetailsIndex < lines.length - 1) {
    console.log(`Found "Attendee Details" at line ${attendeeDetailsIndex + 1}. Processing only attendance data.`);
    
    // Get the header row (line after "Attendee Details")
    const headerRow = lines[attendeeDetailsIndex + 1];
    
    // Get all rows after the header row
    const dataRows = lines.slice(attendeeDetailsIndex + 2);
    
    // Combine header and data rows
    const processedCsv = [headerRow, ...dataRows].join("\n");
    
    console.log(`Processed CSV: extracted ${dataRows.length} data rows with headers.`);
    return processedCsv;
  }
  
  console.log("No 'Attendee Details' section found. Processing entire file.");
  return csvContent;
};

/**
 * Parse Zoom attendance CSV file
 * Expected format has columns for join time and leave time
 */
export const parseAttendanceCSV = (csvContent: string): AttendeeRecord[] => {
  // Preprocess the CSV content first
  const processedCsvContent = preprocessZoomCsv(csvContent);
  
  const results = Papa.parse(processedCsvContent, {
    header: true,
    skipEmptyLines: true,
    // Adding transform step to trim all string values
    transform: (value: any) => {
      return typeof value === 'string' ? value.trim() : value;
    }
  });

  if (!results.data || results.data.length === 0) {
    throw new Error("No data found in CSV file");
  }

  // Check for Papa Parse errors
  if (results.errors && results.errors.length > 0) {
    console.error("CSV parsing errors:", results.errors);
    throw new Error(`CSV parsing errors: ${results.errors.map(e => e.message).join(', ')}`);
  }

  // Find the column names for join time and leave time
  // Trim all header keys to prevent whitespace issues
  const headers = Object.keys(results.data[0]).map(h => String(h).trim());
  console.log("CSV Headers:", headers);

  // Print a sample row to help debug
  console.log("Sample row:", JSON.stringify(results.data[0], null, 2));

  // More flexible column name matching with multiple possible variations
  const joinTimeColumn = headers.find(
    (h) =>
      h.toLowerCase().includes("join") ||
      h.toLowerCase().includes("entered") ||
      h.toLowerCase().includes("start") ||
      h.toLowerCase().includes("in time") ||
      h.toLowerCase().includes("join time"),
  );

  const leaveTimeColumn = headers.find(
    (h) =>
      h.toLowerCase().includes("leave") ||
      h.toLowerCase().includes("left") ||
      h.toLowerCase().includes("exit") ||
      h.toLowerCase().includes("end") ||
      h.toLowerCase().includes("out time") ||
      h.toLowerCase().includes("leave time"),
  );

  // Find the attended column to check if the person actually attended
  const attendedColumn = headers.find(
    (h) =>
      h.toLowerCase() === "attended" || h.toLowerCase().includes("attended"),
  );

  const nameColumn = headers.find(
    (h) =>
      h.toLowerCase().includes("user name") ||
      h.toLowerCase().includes("name") ||
      h.toLowerCase().includes("participant") ||
      h.toLowerCase().includes("user") ||
      h.toLowerCase().includes("attendee"),
  );

  const emailColumn = headers.find(
    (h) =>
      h.toLowerCase().includes("email") ||
      h.toLowerCase().includes("mail") ||
      h.toLowerCase().includes("e-mail"),
  );

  // Find the duration column
  const durationColumn = headers.find(
    (h) =>
      h.toLowerCase().includes("duration") ||
      h.toLowerCase().includes("time in session") ||
      h.toLowerCase().includes("minutes"),
  );

  console.log("Detected columns:", {
    joinTimeColumn,
    leaveTimeColumn,
    attendedColumn,
    nameColumn,
    emailColumn,
    durationColumn
  });

  if (!joinTimeColumn || !leaveTimeColumn) {
    console.error("Available columns:", headers);
    throw new Error(
      "Could not find join time or leave time columns in CSV. " +
      "Expected columns containing words like 'join'/'entered' and 'leave'/'exit'. " +
      "Available columns: " +
      headers.join(", "),
    );
  }

  // Print the raw join and leave time values from the first few rows for debugging
  const sampleRows = results.data.slice(0, 5);
  console.log("First few rows of join/leave time values:", sampleRows);
  
  // Print raw timestamp values from sample rows to help diagnose format issues
  sampleRows.forEach((row, i) => {
    console.log(`Row ${i+1} timestamps:`, {
      joinTime: row[joinTimeColumn],
      leaveTime: row[leaveTimeColumn],
      attended: attendedColumn ? row[attendedColumn] : 'N/A',
      duration: durationColumn ? row[durationColumn] : 'N/A'
    });
  });

  const validRows = [];
  const invalidRows = [];

  // Process rows
  for (let i = 0; i < results.data.length; i++) {
    const row = results.data[i];
    
    try {
      // Skip completely empty rows
      if (Object.values(row).every(val => !val || String(val).trim() === "")) {
        console.log(`Skipping empty row ${i + 1}`);
        continue;
      }
      
      // Skip rows where the person didn't attend if that column exists
      if (attendedColumn && row[attendedColumn] !== undefined) {
        const attendedValue = String(row[attendedColumn]).toLowerCase();
        if (attendedValue === "no" || attendedValue === "false" || attendedValue === "0") {
          console.log(`Skipping row ${i + 1} with attended=${row[attendedColumn]}`);
          continue;
        }
      }

      // Skip rows with -- in join or leave time
      if (row[joinTimeColumn] === "--" || row[leaveTimeColumn] === "--") {
        console.log(`Skipping row ${i + 1} with -- in join or leave time`);
        continue;
      }
      
      // Strictly require join and leave times
      if (!row[joinTimeColumn] || !row[leaveTimeColumn]) {
        // Log the exact values to help diagnose the issue
        console.warn(`Row ${i + 1} missing join or leave time:`, {
          joinTimeCol: joinTimeColumn,
          joinTimeVal: row[joinTimeColumn],
          leaveTimeCol: leaveTimeColumn,
          leaveTimeVal: row[leaveTimeColumn]
        });
        invalidRows.push(row);
        continue;
      }

      // Get the raw timestamp strings
      const joinTimeRaw = String(row[joinTimeColumn]);
      const leaveTimeRaw = String(row[leaveTimeColumn]);
      
      // Log raw timestamp values for the first few rows to help debug parsing issues
      if (i < 5) {
        console.log(`Row ${i + 1} raw timestamps:`, { joinTimeRaw, leaveTimeRaw });
      }

      // Parse the timestamps
      const joinTime = parseZoomTimestamp(joinTimeRaw);
      const leaveTime = parseZoomTimestamp(leaveTimeRaw);

      // Skip rows with invalid timestamps
      if (!joinTime || !leaveTime) {
        console.warn(`Row ${i + 1} has invalid timestamp(s):`, { 
          joinTime: joinTimeRaw, 
          joinTimeParsed: joinTime, 
          leaveTime: leaveTimeRaw,
          leaveTimeParsed: leaveTime
        });
        invalidRows.push(row);
        continue;
      }

      // Skip rows where leave time is before or equal to join time
      if (leaveTime.getTime() <= joinTime.getTime()) {
        console.warn(`Row ${i + 1} has leave time (${leaveTimeRaw}) before or equal to join time (${joinTimeRaw}), skipping`);
        invalidRows.push(row);
        continue;
      }

      // Get duration from the column if it exists, otherwise calculate it
      let duration = undefined;
      if (durationColumn && row[durationColumn] && row[durationColumn] !== "--") {
        // Try to parse the duration value (might be "123" or "123 minutes" or "2:03")
        let durationValue = String(row[durationColumn]).trim();
        
        // Handle "HH:MM" format
        if (durationValue.includes(":")) {
          const [hours, minutes] = durationValue.split(":").map(Number);
          duration = hours * 60 + minutes;
        } 
        // Handle "X minutes" format
        else if (durationValue.toLowerCase().includes("minute")) {
          duration = parseInt(durationValue);
        } 
        // Handle just the number
        else {
          duration = parseInt(durationValue);
        }
        
        // Log successful duration parsing for the first few rows
        if (i < 5) {
          console.log(`Row ${i + 1} duration parsing:`, { 
            raw: row[durationColumn], 
            parsed: duration 
          });
        }
      }

      // If we couldn't parse the duration or it's not available, calculate it
      if (!duration || isNaN(duration)) {
        // Calculate duration in minutes
        const durationMs = leaveTime.getTime() - joinTime.getTime();
        duration = Math.round(durationMs / (1000 * 60));
        
        // Log calculated duration for the first few rows
        if (i < 5) {
          console.log(`Row ${i + 1} calculated duration:`, { 
            duration, 
            joinTime: joinTime.toISOString(), 
            leaveTime: leaveTime.toISOString() 
          });
        }
      }

      validRows.push({
        name: nameColumn && row[nameColumn] ? String(row[nameColumn]) : `Attendee ${i + 1}`,
        email: emailColumn && row[emailColumn] ? String(row[emailColumn]) : undefined,
        joinTime,
        leaveTime,
        duration,
      });
    } catch (error) {
      console.error(`Error parsing row ${i + 1}:`, row, error);
      invalidRows.push(row);
    }
  }

  console.log(
    `Processed ${validRows.length} valid rows and skipped ${invalidRows.length} invalid rows`,
  );
  
  // If no valid rows were found, provide specific error message
  if (validRows.length === 0) {
    throw new Error(
      "No valid attendance records found in the CSV file. This may be due to:\n" +
      "1. Missing required columns\n" +
      "2. Incorrect date/time format\n" +
      "3. Empty or corrupted file\n\n" +
      "Please check your CSV format and try again."
    );
  }

  return validRows;
};

/**
 * Parse Zoom timestamp format
 * Handles multiple formats including "Mar 22, 2025 19:52:01"
 */
const parseZoomTimestamp = (timestamp: string): Date | null => {
  // Handle empty or placeholder values
  if (
    !timestamp || 
    timestamp === "--" || 
    timestamp === "N/A" || 
    timestamp.toLowerCase() === "yes" ||
    timestamp.toLowerCase() === "true" ||
    timestamp.toLowerCase() === "1" ||
    timestamp.toLowerCase() === "no" ||
    timestamp.toLowerCase() === "false" ||
    timestamp.toLowerCase() === "0"
  ) {
    console.warn(`Invalid timestamp value: "${timestamp}", skipping this entry`);
    return null; // Return null for invalid timestamps
  }

  // Clean up the timestamp string
  const cleanTimestamp = timestamp.trim();
  if (!cleanTimestamp) {
    return null;
  }
  
  // Enhanced debug logging for timestamp parsing
  console.log(`Attempting to parse timestamp: "${cleanTimestamp}"`);

  // Try to parse the timestamp directly with Date constructor
  // This is included for convenience but may parse dates inconsistently
  const date = new Date(cleanTimestamp);
  if (!isNaN(date.getTime())) {
    console.log(`Timestamp "${cleanTimestamp}" parsed directly as: ${date.toISOString()}`);
    return date;
  }

  // ========== ZOOM SPECIFIC FORMAT ==========
  
  // Format: M/D/YY HH:MM (format from the provided sample, 2-digit year)
  // Examples: "1/4/25 19:31", "1/4/25 23:39"
  const zoomShortYearFormat = /^(\d{1,2})\/(\d{1,2})\/(\d{2})\s+(\d{1,2}):(\d{1,2})$/;
  const zoomMatch = cleanTimestamp.match(zoomShortYearFormat);
  
  if (zoomMatch) {
    const [_, month, day, shortYear, hour, minute] = zoomMatch;
    
    // Convert 2-digit year to 4-digit year
    // If year < 50, assume 2000+. If year >= 50, assume 1900+.
    const fullYear = parseInt(shortYear) < 50 
      ? 2000 + parseInt(shortYear) 
      : 1900 + parseInt(shortYear);
    
    const parsedDate = new Date(
      fullYear,
      parseInt(month) - 1,
      parseInt(day),
      parseInt(hour),
      parseInt(minute),
      0  // No seconds
    );
    
    console.log(`Timestamp "${cleanTimestamp}" parsed via Zoom format as: ${parsedDate.toISOString()}`);
    return parsedDate;
  }

  // ========== COMMON ZOOM FORMATS ==========
  
  // Format: M/D/YYYY h:MM:SS AM/PM (standard US format with single-digit month/day)
  // Examples: "1/15/2023 10:30:45 AM", "4/2/2023 2:15:30 PM"
  const usSingleDigitRegex = 
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{1,2}):(\d{1,2})(?:\s*(AM|PM|am|pm))?$/i;
  const usSingleDigitMatch = cleanTimestamp.match(usSingleDigitRegex);
  if (usSingleDigitMatch) {
    const [_, month, day, year, hour, minute, second, ampm] = usSingleDigitMatch;
    let hourNum = parseInt(hour);
    
    // Handle AM/PM if present
    if (ampm) {
      if (ampm.toLowerCase() === "pm" && hourNum < 12) {
        hourNum += 12;
      } else if (ampm.toLowerCase() === "am" && hourNum === 12) {
        hourNum = 0;
      }
    }
    
    const parsedDate = new Date(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day),
      hourNum,
      parseInt(minute),
      parseInt(second)
    );
    
    console.log(`Timestamp "${cleanTimestamp}" parsed via US format as: ${parsedDate.toISOString()}`);
    return parsedDate;
  }

  // Format: M/D/YYYY H:MM (without seconds)
  // Examples: "1/4/2025 19:31", "12/15/2024 9:30"
  const usFormatNoSeconds = 
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{1,2})$/;
  const usFormatNoSecondsMatch = cleanTimestamp.match(usFormatNoSeconds);
  if (usFormatNoSecondsMatch) {
    const [_, month, day, year, hour, minute] = usFormatNoSecondsMatch;
    
    const parsedDate = new Date(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day),
      parseInt(hour),
      parseInt(minute),
      0 // Set seconds to 0
    );
    
    console.log(`Timestamp "${cleanTimestamp}" parsed via M/D/YYYY H:MM format as: ${parsedDate.toISOString()}`);
    return parsedDate;
  }

  // Format: MMM DD, YYYY HH:MM:SS (e.g., "Mar 22, 2025 19:52:01")
  const monthNameRegex =
    /^([A-Za-z]{3})\s+(\d{1,2}),\s+(\d{4})\s+(\d{1,2}):(\d{1,2}):(\d{1,2})$/i;
  const monthNameMatch = cleanTimestamp.match(monthNameRegex);

  if (monthNameMatch) {
    const [_, monthStr, day, year, hour, minute, second] = monthNameMatch;
    const monthMap: Record<string, number> = {
      jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
      jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
    };

    const monthLower = monthStr.toLowerCase();
    const monthIndex = monthMap[monthLower];

    if (monthIndex !== undefined) {
      const parsedDate = new Date(
        parseInt(year),
        monthIndex,
        parseInt(day),
        parseInt(hour),
        parseInt(minute),
        parseInt(second)
      );
      
      console.log(`Timestamp "${cleanTimestamp}" parsed via month name format as: ${parsedDate.toISOString()}`);
      return parsedDate;
    }
  }

  // Format: MM/DD/YYYY HH:MM:SS AM/PM
  const mmddyyyyRegex =
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{1,2}):(\d{1,2})(?:\s*(AM|PM|am|pm))?$/i;
  const mmddyyyyMatch = cleanTimestamp.match(mmddyyyyRegex);

  if (mmddyyyyMatch) {
    const [_, month, day, year, hour, minute, second, ampm] = mmddyyyyMatch;
    let hourNum = parseInt(hour);
    
    if (ampm && ampm.toLowerCase() === "pm" && hourNum < 12) {
      hourNum += 12;
    } else if (ampm && ampm.toLowerCase() === "am" && hourNum === 12) {
      hourNum = 0;
    }

    const parsedDate = new Date(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day),
      hourNum,
      parseInt(minute),
      parseInt(second)
    );
    
    console.log(`Timestamp "${cleanTimestamp}" parsed via MM/DD/YYYY format as: ${parsedDate.toISOString()}`);
    return parsedDate;
  }

  // Format: DD/MM/YYYY HH:MM:SS (European format)
  const ddmmyyyyRegex =
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{1,2}):(\d{1,2})$/;
  const ddmmyyyyMatch = cleanTimestamp.match(ddmmyyyyRegex);

  if (ddmmyyyyMatch) {
    const [_, day, month, year, hour, minute, second] = ddmmyyyyMatch;
    
    const parsedDate = new Date(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day),
      parseInt(hour),
      parseInt(minute),
      parseInt(second)
    );
    
    console.log(`Timestamp "${cleanTimestamp}" parsed via DD/MM/YYYY format as: ${parsedDate.toISOString()}`);
    return parsedDate;
  }
  
  // Additional formats that might be in Zoom exports
  
  // Format: YYYY-MM-DD HH:MM:SS (ISO-like format)
  const isoFormatRegex = 
    /^(\d{4})-(\d{1,2})-(\d{1,2})\s+(\d{1,2}):(\d{1,2}):(\d{1,2})$/;
  const isoFormatMatch = cleanTimestamp.match(isoFormatRegex);
  
  if (isoFormatMatch) {
    const [_, year, month, day, hour, minute, second] = isoFormatMatch;
    
    const parsedDate = new Date(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day),
      parseInt(hour),
      parseInt(minute),
      parseInt(second)
    );
    
    console.log(`Timestamp "${cleanTimestamp}" parsed via ISO-like format as: ${parsedDate.toISOString()}`);
    return parsedDate;
  }

  // Format: DD-MM-YYYY HH:MM:SS
  const ddmmyyyyDashRegex = 
    /^(\d{1,2})-(\d{1,2})-(\d{4})\s+(\d{1,2}):(\d{1,2}):(\d{1,2})$/;
  const ddmmyyyyDashMatch = cleanTimestamp.match(ddmmyyyyDashRegex);
  
  if (ddmmyyyyDashMatch) {
    const [_, day, month, year, hour, minute, second] = ddmmyyyyDashMatch;
    
    const parsedDate = new Date(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day),
      parseInt(hour),
      parseInt(minute),
      parseInt(second)
    );
    
    console.log(`Timestamp "${cleanTimestamp}" parsed via DD-MM-YYYY format as: ${parsedDate.toISOString()}`);
    return parsedDate;
  }

  // ========== DATE-ONLY FORMATS ==========

  // Format: MM/DD/YYYY (Date only)
  const simpleDateRegex = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
  const simpleDateMatch = cleanTimestamp.match(simpleDateRegex);
  
  if (simpleDateMatch) {
    const [_, month, day, year] = simpleDateMatch;
    
    const parsedDate = new Date(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day)
    );
    
    console.log(`Timestamp "${cleanTimestamp}" parsed via MM/DD/YYYY date-only format as: ${parsedDate.toISOString()}`);
    return parsedDate;
  }

  // Format: YYYY-MM-DD (ISO date)
  const isoDateRegex = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;
  const isoDateMatch = cleanTimestamp.match(isoDateRegex);
  
  if (isoDateMatch) {
    const [_, year, month, day] = isoDateMatch;
    
    const parsedDate = new Date(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day)
    );
    
    console.log(`Timestamp "${cleanTimestamp}" parsed via YYYY-MM-DD date-only format as: ${parsedDate.toISOString()}`);
    return parsedDate;
  }

  // If all patterns fail, log the timestamp format that couldn't be parsed
  console.error(`Failed to parse timestamp: "${cleanTimestamp}" - No matching format found`);
  return null;
};

/**
 * Implements the algorithm as specified in the pseudocode to create
 * the "Number of People in Webinar Over Time" Graph
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
 * Legacy function for backward compatibility
 * Simply redirects to the new implementation
 */
export const generateTimeIntervals = (
  attendees: AttendeeRecord[],
  intervalMinutes: number,
): DataPoint[] => {
  return generateAttendanceTimeline(attendees, intervalMinutes);
};

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
) => {
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
) => {
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
) => {
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

/**
 * Calculate the total number of unique attendees
 * Optimized version with more efficient Set usage
 */
export const calculateTotalAttendees = (
  attendees: AttendeeRecord[],
): number => {
  if (attendees.length === 0) return 0;

  // Check if we have email addresses in a single pass
  let hasEmails = false;
  let hasNames = false;

  for (let i = 0; i < Math.min(10, attendees.length); i++) {
    if (attendees[i].email) hasEmails = true;
    if (attendees[i].name) hasNames = true;
    if (hasEmails && hasNames) break;
  }

  // If we have email addresses, use those for uniqueness
  if (hasEmails) {
    const uniqueEmails = new Set<string>();
    attendees.forEach((a) => {
      if (a.email) uniqueEmails.add(a.email.toLowerCase());
    });
    return uniqueEmails.size;
  }

  // Otherwise, use names
  if (hasNames) {
    const uniqueNames = new Set<string>();
    attendees.forEach((a) => {
      if (a.name) uniqueNames.add(a.name.toLowerCase());
    });
    return uniqueNames.size;
  }

  // If we don't have either, just return the total count
  return attendees.length;
};

/**
 * Generate sample data for demonstration purposes
 */
export const generateSampleData = (): AttendeeRecord[] => {
  console.log("Generating sample data for demonstration");
  
  const now = new Date();
  const baseJoinTime = new Date(now.getTime() - 120 * 60 * 1000); // 2 hours ago
  
  const sampleAttendees: AttendeeRecord[] = [];
  
  // Create 100 sample attendees
  for (let i = 0; i < 100; i++) {
    // Random join times clustered around the beginning
    const joinOffset = Math.floor(Math.random() * 30) * 60 * 1000; // Within first 30 minutes
    const joinTime = new Date(baseJoinTime.getTime() + joinOffset);
    
    // Duration follows a bell curve distribution
    const durationMinutes = Math.min(
      120, // Max 2 hours
      Math.max(
        5,   // Min 5 minutes
        Math.floor(60 + (Math.random() + Math.random() + Math.random() - 1.5) * 60)
      )
    );
    
    const leaveTime = new Date(joinTime.getTime() + durationMinutes * 60 * 1000);
    
    sampleAttendees.push({
      name: `Sample Attendee ${i + 1}`,
      email: `sample${i + 1}@example.com`,
      joinTime,
      leaveTime,
      duration: durationMinutes,
    });
  }
  
  return sampleAttendees;
};