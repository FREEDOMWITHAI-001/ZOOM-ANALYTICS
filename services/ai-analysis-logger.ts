/**
 * AI Analysis Logger
 */

import { CaptionSegment } from '@/lib/captions/caption-parser';

export interface AIAnalysisLogEntry {
  timestamp: string;
  requestType: 'peak' | 'drop' | 'combined';
  timePoint?: string;
  attendeeCount?: number;
  captionText?: string;
  response: any;
  captionsUsed?: number;
  success: boolean;
  error?: string;
  request?: any;
}

class AIAnalysisLogger {
  private _logs: AIAnalysisLogEntry[] = [];
  private static _instance: AIAnalysisLogger;

  private constructor() {}

  public static getInstance(): AIAnalysisLogger {
    if (!AIAnalysisLogger._instance) {
      AIAnalysisLogger._instance = new AIAnalysisLogger();
    }
    return AIAnalysisLogger._instance;
  }

  public logAnalysis(params: AIAnalysisLogEntry | any): void {
    let logEntry: AIAnalysisLogEntry;

    if (params.timestamp) {
      logEntry = params as AIAnalysisLogEntry;
    } else {
      logEntry = {
        timestamp: new Date().toISOString(),
        requestType: params.type || 'combined',
        timePoint: params.timePoint,
        attendeeCount: params.attendeeCount,
        captionText: params.captionText,
        response: params.response,
        success: params.success !== false,
        error: params.error
      };
    }

    this._logs.push(logEntry);
    console.log(
      `AI Analysis logged - ${logEntry.requestType} - ${
        logEntry.success ? 'Success' : 'Failed'
      }`
    );
  }

  public getLogs(): AIAnalysisLogEntry[] {
    return [...this._logs];
  }

  public clearLogs(): void {
    this._logs = [];
  }
}

export const aiAnalysisLogger = AIAnalysisLogger.getInstance();
