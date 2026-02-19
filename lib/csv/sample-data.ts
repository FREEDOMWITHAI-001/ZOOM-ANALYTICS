import { AttendeeRecord } from "./types";

/**
 * Generate sample data for demonstration purposes
 */
export const generateSampleData = (): AttendeeRecord[] => {
  console.log("Generating sample data for demonstration");
  
  const now = new Date();
  const baseJoinTime = new Date(now.getTime() - 120 * 60 * 1000); // 2 hours ago
  
  const sampleAttendees: AttendeeRecord[] = [];
  
  // Create 100 sample attendees with realistic patterns
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

/**
 * Generate more complex patterns for testing specific scenarios
 */
export const generateScenarioData = (scenario: string): AttendeeRecord[] => {
  const now = new Date();
  const baseTime = new Date(now.getTime() - 120 * 60 * 1000); // 2 hours ago
  const attendees: AttendeeRecord[] = [];
  
  switch (scenario) {
    case "perfect-retention":
      // Everyone joins at the start and stays to the end
      for (let i = 0; i < 50; i++) {
        attendees.push({
          name: `Perfect Attendee ${i + 1}`,
          email: `perfect${i + 1}@example.com`,
          joinTime: new Date(baseTime),
          leaveTime: new Date(baseTime.getTime() + 120 * 60 * 1000),
          duration: 120
        });
      }
      break;
      
    case "gradual-dropoff":
      // People leave gradually throughout the webinar
      for (let i = 0; i < 100; i++) {
        const stayPercentage = 1 - (i / 100);
        const duration = Math.max(5, Math.round(stayPercentage * 120));
        
        attendees.push({
          name: `Dropoff Attendee ${i + 1}`,
          email: `dropoff${i + 1}@example.com`,
          joinTime: new Date(baseTime),
          leaveTime: new Date(baseTime.getTime() + duration * 60 * 1000),
          duration
        });
      }
      break;
      
    case "late-joiners":
      // People join throughout the webinar
      for (let i = 0; i < 100; i++) {
        const joinDelay = Math.round((i / 100) * 60); // Join up to 1 hour late
        
        attendees.push({
          name: `Late Joiner ${i + 1}`,
          email: `late${i + 1}@example.com`,
          joinTime: new Date(baseTime.getTime() + joinDelay * 60 * 1000),
          leaveTime: new Date(baseTime.getTime() + 120 * 60 * 1000),
          duration: 120 - joinDelay
        });
      }
      break;
      
    case "engagement-spike":
      // Base group joins at start
      for (let i = 0; i < 50; i++) {
        attendees.push({
          name: `Base Attendee ${i + 1}`,
          email: `base${i + 1}@example.com`,
          joinTime: new Date(baseTime),
          leaveTime: new Date(baseTime.getTime() + 120 * 60 * 1000),
          duration: 120
        });
      }
      
      // Spike group joins during the middle for a short time
      const spikeTime = new Date(baseTime.getTime() + 60 * 60 * 1000); // 1 hour in
      for (let i = 0; i < 30; i++) {
        attendees.push({
          name: `Spike Attendee ${i + 1}`,
          email: `spike${i + 1}@example.com`,
          joinTime: new Date(spikeTime),
          leaveTime: new Date(spikeTime.getTime() + 15 * 60 * 1000), // Stay for 15 minutes
          duration: 15
        });
      }
      break;
      
    default:
      // Default to regular sample data
      return generateSampleData();
  }
  
  return attendees;
};