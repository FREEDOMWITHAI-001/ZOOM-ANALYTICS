"use client";
import React from "react";
import { Alert, AlertDescription } from "../ui/alert";
import { AlertCircle } from "lucide-react";
import { Button } from "../ui/button";

interface ErrorSectionProps {
  error: string | null;
  onReanalyze: () => void;
  onUseSampleData: () => void;
}

const ErrorSection: React.FC<ErrorSectionProps> = ({
  error,
  onReanalyze,
  onUseSampleData,
}) => {
  if (!error) return null;
  
  return (
    <Alert variant="destructive" className="mb-6">
      <AlertCircle className="h-4 w-4" />
      <AlertDescription className="whitespace-pre-line">{error}</AlertDescription>
      {error.includes("Please check your CSV format") && (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onUseSampleData}
          >
            Use Sample Data
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onReanalyze}
          >
            Upload Different File
          </Button>
        </div>
      )}
    </Alert>
  );
};

export default ErrorSection;