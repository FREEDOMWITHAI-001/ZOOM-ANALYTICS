"use client";
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Paperclip, Loader2, AlertCircle } from 'lucide-react';
import { parseVTTCaptions, CaptionSegment } from '@/lib/captions/caption-parser';

interface CaptionUploaderProps {
  onCaptionsLoaded: (captions: CaptionSegment[]) => void;
  disabled?: boolean;
}

export function CaptionUploader({ onCaptionsLoaded, disabled = false }: CaptionUploaderProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filename, setFilename] = useState<string | null>(null);
  
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    setLoading(true);
    setError(null);
    setFilename(file.name);
    
    try {
      const content = await readFileAsText(file);
      const captions = parseVTTCaptions(content);
      
      if (captions.length === 0) {
        throw new Error('No captions found in the file');
      }
      
      console.log(`Successfully parsed ${captions.length} caption segments`);
      onCaptionsLoaded(captions);
    } catch (err) {
      console.error('Error parsing caption file:', err);
      setError(`Failed to parse captions: ${err.message}`);
      setFilename(null);
    } finally {
      setLoading(false);
    }
  };
  
  const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          resolve(e.target.result as string);
        } else {
          reject(new Error('Failed to read file'));
        }
      };
      reader.onerror = () => reject(new Error('Error reading file'));
      reader.readAsText(file);
    });
  };
  
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="file"
          accept=".vtt,.srt"
          onChange={handleFileUpload}
          disabled={loading || disabled}
          className="hidden"
          id="caption-file-input"
        />
        <label
          htmlFor="caption-file-input"
          className={`inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium ring-offset-background transition-colors 
            ${disabled 
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
              : 'bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer'}`}
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Paperclip className="mr-2 h-4 w-4" />
              {filename ? 'Change Caption File' : 'Upload Caption File'}
            </>
          )}
        </label>
        
        {filename && !loading && !error && (
          <span className="text-sm text-green-600">
            {filename} loaded successfully
          </span>
        )}
      </div>
      
      {error && (
        <div className="flex items-center text-sm text-red-500">
          <AlertCircle className="mr-1 h-4 w-4" />
          {error}
        </div>
      )}
      
      <div className="text-xs text-gray-500">
        Upload your meeting caption file (VTT format) for AI to analyze engagement peaks and drop-offs.
      </div>
    </div>
  );
}
