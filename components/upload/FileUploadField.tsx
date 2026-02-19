"use client";
import React, { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload } from "lucide-react";
import { motion } from "framer-motion";

interface FileUploadFieldProps {
  id: string;
  label: string;
  icon: React.ReactNode;
  accept: string;
  file: File | null;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder: string;
  required?: boolean;
}

const FileUploadField: React.FC<FileUploadFieldProps> = ({
  id,
  label,
  icon,
  accept,
  file,
  onChange,
  placeholder,
  required = false
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  
  const handleButtonClick = () => {
    inputRef.current?.click();
  };
  
  return (
    <motion.div
      className="space-y-3"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
    >
      <Label
        htmlFor={id}
        className="text-base font-medium flex items-center gap-2"
      >
        {icon}
        {label} {required && <span className="text-red-500">*</span>}
      </Label>
      <div className="flex items-center gap-4">
        <Input
          id={id}
          type="file"
          accept={accept}
          className="hidden"
          ref={inputRef}
          onChange={onChange}
        />
        <Button
          onClick={handleButtonClick}
          variant="outline"
          className="flex-1 h-28 border-dashed border-2 border-primary/30 hover:border-primary/60 flex flex-col items-center justify-center gap-3 bg-background/50 hover:bg-background/80 transition-all duration-300"
        >
          <Upload className="h-8 w-8 text-primary" />
          <span className="font-medium">
            {file ? file.name : placeholder}
          </span>
        </Button>
        {file && (
          <div className="text-sm text-primary flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse"></div>
            File ready
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default FileUploadField;