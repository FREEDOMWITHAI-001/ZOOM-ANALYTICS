import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

// Import and re-export everything from the csv module
import * as csvUtils from './csv';

/**
 * A utility function for merging tailwind classes with clsx
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Validate required environment variables and provide helpful messages
 */
export function validateEnvironment() {
  // VITE_OPENAI_API_KEY is optional — AI analysis goes through the backend
  return true;
}

// Re-export necessary types and functions from the CSV utilities
export type {
  AttendeeRecord,
  DataPoint,
  TimelineEvent,
  RetentionMetrics,
  RetentionDebugInfo
} from './csv';

export {
  parseAttendanceCSV,
  calculateTotalAttendees,
  generateAttendanceTimeline,
  generateTimeIntervals,
  generateSampleData,
  generateScenarioData
} from './csv';
