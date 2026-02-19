"use client";
import React from "react";
import StatisticCard from "../StatisticCard";
import { Users, TrendingUp, Percent } from "lucide-react";

interface StatisticsSectionProps {
  totalAttendees: number;
  peakRetention: number;
  averageRetention: number;
  peakParticipants: number;
  averageParticipants: number;
   engagementScore?: number;
}

const StatisticsSection: React.FC<StatisticsSectionProps> = ({
  totalAttendees,
  peakRetention,
  averageRetention,
  peakParticipants,
  averageParticipants,
  engagementScore
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <StatisticCard
        title="Total Attendees"
        value={totalAttendees}
        bgColor="bg-blue-50 dark:bg-blue-950/30"
        textColor="text-blue-600 dark:text-blue-400"
        icon={<Users size={24} />}
      />
      <StatisticCard
        title="Peak Retention"
        value={`${peakRetention}%`}
        bgColor="bg-green-50 dark:bg-green-950/30"
        textColor="text-green-600 dark:text-green-400"
        icon={<TrendingUp size={24} />}
      />
      <StatisticCard
        title="Average Retention"
        value={`${averageRetention}%`}
        bgColor="bg-purple-50 dark:bg-purple-950/30"
        textColor="text-purple-600 dark:text-purple-400"
        icon={<Percent size={24} />}
      />
    </div>
  );
};

export default StatisticsSection;