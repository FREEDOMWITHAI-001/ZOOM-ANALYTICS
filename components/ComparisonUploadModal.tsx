"use client";
import React, { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { FileSpreadsheet, FileText, Upload } from "lucide-react";
import { motion } from "framer-motion";

interface ComparisonUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadComplete: (
    attendanceFile: File | null,
    transcriptFile: File | null,
  ) => void;
}

const ComparisonUploadModal = ({
  isOpen,
  onClose,
  onUploadComplete,
}: ComparisonUploadModalProps) => {
  const [attendanceFile, setAttendanceFile] = useState<File | null>(null);
  const [transcriptFile, setTranscriptFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const attendanceInputRef = useRef<HTMLInputElement>(null);
  const transcriptInputRef = useRef<HTMLInputElement>(null);

  const handleAttendanceFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    if (e.target.files && e.target.files[0]) {
      setAttendanceFile(e.target.files[0]);
    }
  };

  const handleTranscriptFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    if (e.target.files && e.target.files[0]) {
      setTranscriptFile(e.target.files[0]);
    }
  };

  const handleAttendanceButtonClick = () => {
    attendanceInputRef.current?.click();
  };

  const handleTranscriptButtonClick = () => {
    transcriptInputRef.current?.click();
  };

  const handleSubmit = () => {
    setIsUploading(true);
    // Simulate upload process
    setTimeout(() => {
      onUploadComplete(attendanceFile, transcriptFile);
      setIsUploading(false);
      resetForm();
      onClose();
    }, 1500);
  };

  const resetForm = () => {
    setAttendanceFile(null);
    setTranscriptFile(null);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="glass-card sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
            Upload Comparison Data
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Upload a second set of Zoom webinar data to compare with your
            current analysis.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Attendance File Upload */}
          <div className="space-y-3">
            <Label
              htmlFor="comparison-attendance-file"
              className="text-base font-medium flex items-center gap-2"
            >
              <FileSpreadsheet className="h-4 w-4 text-primary" />
              Zoom Attendance CSV
            </Label>
            <div className="flex items-center gap-4">
              <Input
                id="comparison-attendance-file"
                type="file"
                accept=".csv"
                className="hidden"
                ref={attendanceInputRef}
                onChange={handleAttendanceFileChange}
              />
              <Button
                onClick={handleAttendanceButtonClick}
                variant="outline"
                className="flex-1 h-20 border-dashed border-2 border-primary/30 hover:border-primary/60 flex flex-col items-center justify-center gap-2 bg-background/50 hover:bg-background/80 transition-all duration-300"
              >
                <Upload className="h-6 w-6 text-primary" />
                <span className="font-medium text-sm">
                  {attendanceFile
                    ? attendanceFile.name
                    : "Upload Attendance CSV"}
                </span>
              </Button>
              {attendanceFile && (
                <div className="text-sm text-primary flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-primary animate-pulse"></div>
                  File ready
                </div>
              )}
            </div>
          </div>

          {/* Transcript File Upload */}
          <div className="space-y-3">
            <Label
              htmlFor="comparison-transcript-file"
              className="text-base font-medium flex items-center gap-2"
            >
              <FileText className="h-4 w-4 text-primary" />
              Zoom Transcript File
            </Label>
            <div className="flex items-center gap-4">
              <Input
                id="comparison-transcript-file"
                type="file"
                accept=".csv,.srt,.vtt"
                className="hidden"
                ref={transcriptInputRef}
                onChange={handleTranscriptFileChange}
              />
              <Button
                onClick={handleTranscriptButtonClick}
                variant="outline"
                className="flex-1 h-20 border-dashed border-2 border-primary/30 hover:border-primary/60 flex flex-col items-center justify-center gap-2 bg-background/50 hover:bg-background/80 transition-all duration-300"
              >
                <Upload className="h-6 w-6 text-primary" />
                <span className="font-medium text-sm">
                  {transcriptFile
                    ? transcriptFile.name
                    : "Upload Transcript File (CSV/SRT/VTT)"}
                </span>
              </Button>
              {transcriptFile && (
                <div className="text-sm text-primary flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-primary animate-pulse"></div>
                  File ready
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!attendanceFile || !transcriptFile || isUploading}
            className="gradient-bg border-0 shadow-md shadow-primary/20"
          >
            {isUploading ? (
              <>
                <div className="h-4 w-4 rounded-full border-2 border-t-transparent border-white animate-spin mr-2"></div>
                Processing...
              </>
            ) : (
              "Upload & Compare"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ComparisonUploadModal;
