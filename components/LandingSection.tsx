"use client";
import React from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight, BarChart2, Users, LineChart } from "lucide-react";
import { motion } from "framer-motion";

interface LandingSectionProps {
  onStartAnalysis?: () => void;
}

const LandingSection = ({
  onStartAnalysis = () => console.log("Start analysis clicked"),
}: LandingSectionProps) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[500px] p-8 glass-card rounded-xl shadow-lg dark:shadow-primary/5 text-center space-y-8 transition-all duration-300">
      <div className="space-y-6 max-w-2xl">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex justify-center mb-6"
        >
          <div className="p-4 rounded-full gradient-bg shadow-lg">
            <BarChart2 className="h-12 w-12 text-white" />
          </div>
        </motion.div>

        <h1 className="text-4xl md:text-5xl font-bold tracking-tight bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
          Welcome to Zoom Webinar Attendance Analyzer
        </h1>

        <p className="text-xl text-muted-foreground">
          Upload your Zoom attendance report and transcript to analyze
          engagement and retention patterns without requiring login.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-3xl mt-8">
        <motion.div
          whileHover={{ y: -5 }}
          className="flex flex-col items-center p-6 rounded-lg bg-card/60 border border-border shadow-sm transform-gpu"
        >
          <Users className="h-8 w-8 text-primary mb-3" />
          <h3 className="font-semibold text-lg mb-1">Track Attendance</h3>
          <p className="text-sm text-muted-foreground">
            Monitor participant engagement throughout your webinar
          </p>
        </motion.div>

        <motion.div
          whileHover={{ y: -5 }}
          className="flex flex-col items-center p-6 rounded-lg bg-card/60 border border-border shadow-sm transform-gpu"
        >
          <LineChart className="h-8 w-8 text-primary mb-3" />
          <h3 className="font-semibold text-lg mb-1">Analyze Patterns</h3>
          <p className="text-sm text-muted-foreground">
            Identify key moments of engagement and drop-offs
          </p>
        </motion.div>

        <motion.div
          whileHover={{ y: -5 }}
          className="flex flex-col items-center p-6 rounded-lg bg-card/60 border border-border shadow-sm transform-gpu"
        >
          <BarChart2 className="h-8 w-8 text-primary mb-3" />
          <h3 className="font-semibold text-lg mb-1">Get Insights</h3>
          <p className="text-sm text-muted-foreground">
            Receive AI-powered recommendations to improve future webinars
          </p>
        </motion.div>
      </div>

      <motion.div
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.98 }}
        className="transform-gpu"
      >
        <Button
          onClick={onStartAnalysis}
          size="lg"
          className="mt-8 text-lg px-10 py-7 h-auto font-semibold gradient-bg border-0 shadow-md shadow-primary/20"
        >
          Start Analysis
          <ArrowRight className="ml-2 h-5 w-5" />
        </Button>
      </motion.div>

      <div className="mt-8 text-sm text-muted-foreground">
        <p>
          Analyze participant engagement and discover actionable insights from
          your webinar data
        </p>
      </div>
    </div>
  );
};

export default LandingSection;
