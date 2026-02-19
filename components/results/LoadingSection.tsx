"use client";
import React from "react";
import { Loader2 } from "lucide-react";

interface LoadingSectionProps {
  isLoading: boolean;
  message?: string;
  stage?: string;
}

const LoadingSection: React.FC<LoadingSectionProps> = ({ 
  isLoading, 
  message = "Analyzing your webinar attendance information",
  stage = "Processing Data" 
}) => {
  if (!isLoading) return null;
  
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
      <h2 className="text-xl font-medium">{stage}...</h2>
      <p className="text-muted-foreground mt-2 text-center max-w-md">
        {message}
      </p>
      <div className="mt-4 text-xs text-muted-foreground">
        This may take a moment as we generate AI insights
      </div>
    </div>
  );
};

export default LoadingSection;