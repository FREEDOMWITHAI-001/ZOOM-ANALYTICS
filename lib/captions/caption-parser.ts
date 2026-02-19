// Custom VTT parser without external dependencies

export interface CaptionSegment {
  id: number;
  startTime: Date;
  endTime: Date;
  text: string;
}

/**
 * Parses a WebVTT caption file
 */
export function parseVTTCaptions(content: string): CaptionSegment[] {
  try {
    // Basic validation
    if (!content.trim().toUpperCase().startsWith('WEBVTT')) {
      throw new Error('Invalid VTT format: Missing WEBVTT header');
    }
    
    console.log("Starting VTT parsing...");
    
    const segments: CaptionSegment[] = [];
    const lines = content.split('\n');
    let currentSegment: Partial<CaptionSegment> = {};
    let currentId = 1;
    let inCue = false;
    let collectingText = false;
    let currentText: string[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Skip empty lines and comments
      if (!line || line.startsWith('NOTE')) continue;
      
      // Skip the WEBVTT header
      if (line === 'WEBVTT') continue;
      
      // Check if this is a timestamp line
      if (line.includes(' --> ')) {
        // Start a new cue
        inCue = true;
        collectingText = true;
        currentText = [];
        
        // Parse timestamps
        const [startTimeStr, endTimeStr] = line.split(' --> ');
        
        const parseTime = (timeStr: string): Date => {
          // Handle different time formats
          // Format 1: 00:03:14.690 (hour:minute:second.millisecond)
          // Format 2: 03:14.690 (minute:second.millisecond)
          
          console.log(`Parsing time string: ${timeStr}`);
          
          const parts = timeStr.split(':');
          let hours = 0;
          let minutes = 0;
          let seconds = 0;
          let milliseconds = 0;
          
          if (parts.length === 3) {
            // Format 1: 00:03:14.690
            hours = parseInt(parts[0], 10);
            minutes = parseInt(parts[1], 10);
            
            // Handle seconds.milliseconds
            const secondParts = parts[2].split('.');
            seconds = parseInt(secondParts[0], 10);
            if (secondParts.length > 1) {
              milliseconds = parseInt(secondParts[1], 10);
            }
          } else if (parts.length === 2) {
            // Format 2: 03:14.690
            minutes = parseInt(parts[0], 10);
            
            // Handle seconds.milliseconds
            const secondParts = parts[1].split('.');
            seconds = parseInt(secondParts[0], 10);
            if (secondParts.length > 1) {
              milliseconds = parseInt(secondParts[1], 10);
            }
          } else {
            throw new Error(`Unsupported time format: ${timeStr}`);
          }
          
          // Create a date object using the current day
          const date = new Date();
          date.setHours(hours);
          date.setMinutes(minutes);
          date.setSeconds(seconds);
          date.setMilliseconds(milliseconds);
          
          // For debugging
          console.log(`Parsed time: ${date.toISOString()} from ${timeStr} (${hours}:${minutes}:${seconds}.${milliseconds})`);
          
          return date;
        };
        
        try {
          const startTime = parseTime(startTimeStr);
          const endTime = parseTime(endTimeStr);
          
          currentSegment = {
            id: currentId++,
            startTime,
            endTime,
          };
        } catch (timeError) {
          console.error(`Error parsing timestamp at line ${i + 1}:`, timeError);
          // Continue to the next line rather than failing completely
          inCue = false;
          collectingText = false;
          continue;
        }
      } 
      // If we're in a cue and this is not another timestamp, it's the text content
      else if (inCue && collectingText) {
        // If it's a blank line after we've collected some text, finalize the cue
        if (!line && currentText.length > 0) {
          collectingText = false;
          currentSegment.text = currentText.join(' ').trim();
          segments.push(currentSegment as CaptionSegment);
          inCue = false;
        } else if (line) {
          // Add to the current text content
          currentText.push(line);
        }
      }
      // If we're at the end of a segment (blank line after collecting text)
      else if (inCue && !collectingText && !line) {
        inCue = false;
      }
      // Check if line is just a segment ID (number)
      else if (/^\d+$/.test(line)) {
        // This is just a segment ID, which we auto-generate anyway
        continue;
      }
    }
    
    // Handle the last segment if there is one
    if (inCue && currentText.length > 0 && currentSegment.startTime) {
      currentSegment.text = currentText.join(' ').trim();
      segments.push(currentSegment as CaptionSegment);
    }
    
    console.log(`Successfully parsed ${segments.length} caption segments`);
    
    // Log a few samples for debugging
    if (segments.length > 0) {
      console.log("Sample caption segments:");
      segments.slice(0, 3).forEach((segment, index) => {
        console.log(`[${index}] ${segment.startTime.toISOString()} - ${segment.endTime.toISOString()}: ${segment.text.substring(0, 30)}${segment.text.length > 30 ? '...' : ''}`);
      });
    }
    
    return segments;
  } catch (error) {
    console.error('Error parsing VTT captions:', error);
    throw new Error(`Failed to parse VTT file: ${error.message}`);
  }
}

/**
 * Finds caption segments that overlap with a specific time range
 */
export function findCaptionsInTimeRange(
  captions: CaptionSegment[],
  startTime: Date,
  endTime: Date
): CaptionSegment[] {
  console.log(`Finding captions between ${startTime.toISOString()} and ${endTime.toISOString()}`);
  
  const results = captions.filter(segment => {
    // Check if the segment overlaps with the specified time range
    const overlap = (
      (segment.startTime <= endTime && segment.endTime >= startTime) ||
      (segment.startTime >= startTime && segment.startTime <= endTime) ||
      (segment.endTime >= startTime && segment.endTime <= endTime)
    );
    
    // For more flexible matching, also check if hours match
    const hourMatch = (
      Math.abs(segment.startTime.getHours() - startTime.getHours()) <= 1 || 
      Math.abs(segment.endTime.getHours() - endTime.getHours()) <= 1
    );
    
    return overlap || hourMatch;
  });
  
  console.log(`Found ${results.length} captions in the time range`);
  return results;
}

/**
 * Extracts text from caption segments
 */
export function extractTextFromCaptions(captions: CaptionSegment[]): string {
  if (captions.length === 0) return '';
  
  return captions.map(caption => caption.text).join(' ');
}

/**
 * Get a time window around a specific event (peak or drop) for context
 * @param eventTime The timestamp of the event
 * @param minutesBefore Minutes to look before the event (default: 2)
 * @param minutesAfter Minutes to look after the event (default: 2)
 * @returns Object containing startTime and endTime Date objects
 */
export function getTimeWindowAroundEvent(
  eventTime: Date,
  minutesBefore: number = 2,
  minutesAfter: number = 2
): { startTime: Date; endTime: Date } {
  const startTime = new Date(eventTime.getTime() - (minutesBefore * 60 * 1000));
  const endTime = new Date(eventTime.getTime() + (minutesAfter * 60 * 1000));
  
  return { startTime, endTime };
}
