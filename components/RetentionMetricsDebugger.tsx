"use client";
import { useState } from "react";
import { 
  type DataPoint, 
  type AttendeeRecord 
} from "@/lib/csv/types";

import { calculateRetentionMetrics } from "@/lib/csv";
import ScenarioSelector from "./debugger/ScenarioSelector";
import InputDataDisplay from "./debugger/InputDataDisplay";
import ResultsDisplay from "./debugger/ResultsDisplay";

// Sample attendee data for more realistic debugger scenarios
const sampleAttendees: Record<string, AttendeeRecord[]> = {
  "Perfect Attendance": [
    {
      joinTime: new Date("2023-01-01T14:00:00"),
      leaveTime: new Date("2023-01-01T16:00:00"),
      duration: 120
    },
    {
      joinTime: new Date("2023-01-01T14:00:00"),
      leaveTime: new Date("2023-01-01T16:00:00"),
      duration: 120
    },
    {
      joinTime: new Date("2023-01-01T14:00:00"),
      leaveTime: new Date("2023-01-01T16:00:00"),
      duration: 120
    }
  ],
  "Gradual Drop-off": [
    {
      joinTime: new Date("2023-01-01T14:00:00"),
      leaveTime: new Date("2023-01-01T16:00:00"),
      duration: 120
    },
    {
      joinTime: new Date("2023-01-01T14:00:00"),
      leaveTime: new Date("2023-01-01T15:30:00"),
      duration: 90
    },
    {
      joinTime: new Date("2023-01-01T14:00:00"),
      leaveTime: new Date("2023-01-01T15:00:00"),
      duration: 60
    },
    {
      joinTime: new Date("2023-01-01T14:00:00"),
      leaveTime: new Date("2023-01-01T14:30:00"),
      duration: 30
    }
  ],
  "Late Arrivals": [
    {
      joinTime: new Date("2023-01-01T14:00:00"),
      leaveTime: new Date("2023-01-01T16:00:00"),
      duration: 120
    },
    {
      joinTime: new Date("2023-01-01T14:30:00"),
      leaveTime: new Date("2023-01-01T16:00:00"),
      duration: 90
    },
    {
      joinTime: new Date("2023-01-01T15:00:00"),
      leaveTime: new Date("2023-01-01T16:00:00"),
      duration: 60
    }
  ],
  "Realistic Webinar": [
    // Early joiners who stay the whole time
    {
      joinTime: new Date("2023-01-01T13:50:00"),
      leaveTime: new Date("2023-01-01T16:00:00"),
      duration: 130
    },
    {
      joinTime: new Date("2023-01-01T13:55:00"),
      leaveTime: new Date("2023-01-01T16:00:00"),
      duration: 125
    },
    // On-time joiners with varied leave times
    {
      joinTime: new Date("2023-01-01T14:00:00"),
      leaveTime: new Date("2023-01-01T16:00:00"),
      duration: 120
    },
    {
      joinTime: new Date("2023-01-01T14:00:00"),
      leaveTime: new Date("2023-01-01T15:45:00"),
      duration: 105
    },
    {
      joinTime: new Date("2023-01-01T14:00:00"),
      leaveTime: new Date("2023-01-01T15:30:00"),
      duration: 90
    },
    // Late joiners
    {
      joinTime: new Date("2023-01-01T14:15:00"),
      leaveTime: new Date("2023-01-01T16:00:00"),
      duration: 105
    },
    {
      joinTime: new Date("2023-01-01T14:30:00"),
      leaveTime: new Date("2023-01-01T15:45:00"),
      duration: 75
    },
    // Very late joiner who leaves early
    {
      joinTime: new Date("2023-01-01T15:00:00"),
      leaveTime: new Date("2023-01-01T15:30:00"),
      duration: 30
    }
  ]
};

// Sample data scenarios
const scenarios = [
  {
    id: "perfect-attendance",
    name: "Perfect Attendance",
    totalAttendees: 10,
    timeIntervals: [
      { time: "0", participants: 10 },
      { time: "5", participants: 10 },
      { time: "10", participants: 10 },
    ],
    attendees: sampleAttendees["Perfect Attendance"]
  },
  {
    id: "gradual-dropoff",
    name: "Gradual Drop-off",
    totalAttendees: 10,
    timeIntervals: [
      { time: "0", participants: 10 },
      { time: "5", participants: 8 },
      { time: "10", participants: 5 },
      { time: "15", participants: 3 },
    ],
    attendees: sampleAttendees["Gradual Drop-off"]
  },
  {
    id: "late-arrivals",
    name: "Late Arrivals",
    totalAttendees: 10,
    timeIntervals: [
      { time: "0", participants: 3 },
      { time: "5", participants: 7 },
      { time: "10", participants: 10 },
      { time: "15", participants: 8 },
    ],
    attendees: sampleAttendees["Late Arrivals"]
  },
  {
    id: "realistic-webinar",
    name: "Realistic Webinar",
    totalAttendees: 8,
    timeIntervals: [
      { time: "00:00", participants: 5 },
      { time: "15:00", participants: 7 },
      { time: "30:00", participants: 8 },
      { time: "45:00", participants: 7 },
      { time: "60:00", participants: 6 },
      { time: "75:00", participants: 5 },
      { time: "90:00", participants: 4 },
      { time: "105:00", participants: 3 },
      { time: "120:00", participants: 2 },
    ],
    attendees: sampleAttendees["Realistic Webinar"]
  },
];

export function RetentionMetricsDebugger() {
  const [selectedScenarioId, setSelectedScenarioId] = useState("realistic-webinar");

  // Find the selected scenario
  const selectedScenario = scenarios.find(s => s.id === selectedScenarioId) || scenarios[0];
  
  // Calculate metrics for the selected scenario
  const metrics = calculateRetentionMetrics(
    selectedScenario.timeIntervals as DataPoint[],
    selectedScenario.totalAttendees,
    selectedScenario.attendees as AttendeeRecord[]
  );

  return (
    <div className="p-6 bg-white dark:bg-gray-900 rounded-lg space-y-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold">Retention Metrics Debugger</h2>

      <ScenarioSelector 
        scenarios={scenarios.map(s => ({ id: s.id, name: s.name }))}
        selectedScenario={selectedScenarioId}
        onSelectScenario={setSelectedScenarioId}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <InputDataDisplay 
          scenarioName={selectedScenario.name}
          totalAttendees={selectedScenario.totalAttendees}
          timeIntervals={selectedScenario.timeIntervals as DataPoint[]}
          attendees={selectedScenario.attendees as AttendeeRecord[]}
        />

        <ResultsDisplay 
          peakRetention={metrics.peakRetention}
          averageRetention={metrics.averageRetention}
          peakParticipants={metrics.peakParticipants}
          averageParticipants={metrics.averageParticipants}
          debugInfo={metrics.debugInfo}
        />
      </div>
    </div>
  );
}

export default RetentionMetricsDebugger;