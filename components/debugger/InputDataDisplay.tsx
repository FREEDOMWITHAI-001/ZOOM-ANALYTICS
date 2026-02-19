"use client";
import React from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { DataPoint, AttendeeRecord } from "@/lib/csv/types";

interface InputDataDisplayProps {
  scenarioName: string;
  totalAttendees: number;
  timeIntervals: DataPoint[];
  attendees: AttendeeRecord[];
}

const InputDataDisplay: React.FC<InputDataDisplayProps> = ({
  scenarioName,
  totalAttendees,
  timeIntervals,
  attendees
}) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Input Data</CardTitle>
        <CardDescription>Scenario: {scenarioName}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <p>
            <strong>Total Attendees:</strong>{" "}
            {totalAttendees}
          </p>
          <p>
            <strong>Time Intervals:</strong>
          </p>
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="border p-2 text-left">Time</th>
                <th className="border p-2 text-left">Participants</th>
              </tr>
            </thead>
            <tbody>
              {timeIntervals.map((interval, index) => (
                <tr key={index}>
                  <td className="border p-2">{interval.time}</td>
                  <td className="border p-2">{interval.participants}</td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {attendees && attendees.length > 0 && (
            <div className="mt-4">
              <p><strong>Attendee Records:</strong> {attendees.length} records</p>
              <div className="max-h-60 overflow-auto mt-2">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className="border p-2 text-left">Join Time</th>
                      <th className="border p-2 text-left">Leave Time</th>
                      <th className="border p-2 text-left">Duration (min)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendees.map((attendee, index) => (
                      <tr key={index}>
                        <td className="border p-2">{attendee.joinTime.toLocaleTimeString()}</td>
                        <td className="border p-2">{attendee.leaveTime.toLocaleTimeString()}</td>
                        <td className="border p-2">{attendee.duration}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default InputDataDisplay;