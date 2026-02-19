/**
 * OpenAI API Integration Service
 *
 * Handles interaction with OpenAI API for generating insights based on meeting captions
 */

import { aiAnalysisLogger } from './ai-analysis-logger';
import { CaptionSegment } from '@/lib/captions/caption-parser';

// Constants for request limits and timeouts
const MAX_PROMPT_LENGTH = 4000; // Maximum characters for prompt
const DEFAULT_TIMEOUT_MS = 30000; // 30 seconds default timeout
const MAX_RETRIES = 2; // Maximum number of retries on failure

/**
 * Get the OpenAI API key from environment variables
 */
const getOpenAIKey = (): string => {
  // Check for the key in all possible locations
  const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY ||
                process.env.OPENAI_API_KEY;

  if (!apiKey) {
    // Log more detailed information for debugging
    console.error('OpenAI API key not found in environment variables');
    console.error('Available environment variables:',
      []
        .filter(key => !key.includes('KEY')) // Don't log actual keys for security
        .join(', ')
    );
    console.error('Make sure you have VITE_OPENAI_API_KEY defined in your .env file');
    console.error('And that you have restarted the development server after making changes to the .env file');
  } else {
    // Log success but mask the key for security
    const keyPreview = apiKey.substring(0, 3) + '...' + apiKey.substring(apiKey.length - 3);
    console.log(`OpenAI API key found: ${keyPreview}`);
  }

  return apiKey;
};

/**
 * Truncate text to a specified length, preserving whole sentences
 * @param text Text to truncate
 * @param maxLength Maximum length to truncate to
 * @returns Truncated text
 */
const truncateText = (text: string, maxLength: number = MAX_PROMPT_LENGTH): string => {
  if (!text || text.length <= maxLength) return text;

  // Try to find a sentence boundary near the max length
  const sentenceEndIndex = text.lastIndexOf('.', maxLength);
  if (sentenceEndIndex > maxLength * 0.75) {
    return text.substring(0, sentenceEndIndex + 1) + ' [text truncated]';
  }

  // If no good sentence boundary, truncate at maxLength
  return text.substring(0, maxLength) + ' [text truncated]';
};

/**
 * Fetch with retry and proper timeout handling using non-recursive approach
 */
const fetchWithRetry = async (
  url: string,
  options: RequestInit,
  maxRetries: number = MAX_RETRIES,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<Response> => {
  let retriesLeft = maxRetries;
  let lastError: Error | null = null;

  // Use a while loop instead of recursion to avoid stack overflow
  while (retriesLeft >= 0) {
    // Create new abort controller for each attempt
    const controller = new AbortController();
    const signal = controller.signal;

    // Set timeout for this attempt
    const timeoutId = setTimeout(() => {
      controller.abort('Request timeout');
    }, timeoutMs);

    try {
      console.log(`Attempt ${maxRetries - retriesLeft + 1}/${maxRetries + 1} for ${url}`);

      // Add our signal to the options
      const fetchOptions = {
        ...options,
        signal
      };

      const response = await fetch(url, fetchOptions);
      clearTimeout(timeoutId);

      // If response is OK, return it immediately
      if (response.ok) {
        return response;
      }

      // If response is not OK but not retryable, return it anyway
      if (response.status !== 429 && response.status < 500) {
        return response;
      }

      // If we're here, response is not OK but retryable
      console.log(`Received status ${response.status}, retries left: ${retriesLeft}`);
      lastError = new Error(`HTTP error: ${response.status}`);

      // If no retries left, return the response anyway
      if (retriesLeft <= 0) {
        return response;
      }
    } catch (error) {
      clearTimeout(timeoutId);

      // Save the error for potential rethrowing later
      lastError = error instanceof Error ? error : new Error(String(error));

      // If it's not an abort error or we're out of retries, break the loop
      if (!(error instanceof Error && error.name === 'AbortError') || retriesLeft <= 0) {
        break;
      }

      console.log(`Request aborted (timeout), retries left: ${retriesLeft}`);
    }

    // Decrease retry counter
    retriesLeft--;

    // If we have retries left, wait with exponential backoff
    if (retriesLeft >= 0) {
      const backoffMs = Math.min(1000 * Math.pow(2, maxRetries - retriesLeft), 10000);
      console.log(`Waiting ${backoffMs}ms before next attempt...`);
      await new Promise(resolve => setTimeout(resolve, backoffMs));
    }
  }

  // If we got here, we ran out of retries or had a non-retryable error
  throw lastError || new Error('Request failed after all retry attempts');
};

/**
 * Analyze an engagement moment (peak or drop) from meeting captions
 */
export interface EngagementAnalysisRequest {
  type: 'peak' | 'drop';
  timePoint: string;
  attendeeCount?: number;
  captionText: string;
}

export interface EngagementAnalysisResponse {
  analysis?: string;
  error?: string;
}

/**
 * Generate a basic fallback analysis when the OpenAI API is not available
 */
const generateFallbackAnalysis = (request: EngagementAnalysisRequest): string => {
  const { type, timePoint, attendeeCount, captionText } = request;

  // Extract some keywords from the caption text to make the analysis somewhat relevant
  const keywords = captionText.split(' ')
    .filter(word => word.length > 5)  // Only consider longer words
    .filter(word => !['because', 'through', 'should', 'would', 'could'].includes(word.toLowerCase()))
    .slice(0, 5)
    .join(', ');

  if (type === 'peak') {
    return `This appears to be a moment of increased engagement at ${timePoint}, with ${attendeeCount || 'several'} new participants joining.

The transcript suggests this may be related to discussion of ${keywords || 'key topics'}, which likely resonated with the audience. Engagement often increases when presenters address practical, actionable content or when they introduce a new concept that offers clear value to attendees.

Consider emphasizing similar content in future webinars to maintain high engagement levels.`;
  } else {
    return `At ${timePoint}, there was a notable drop in attendance with ${attendeeCount || 'several'} participants leaving.

This may be related to the discussion of ${keywords || 'certain topics'} which might have been less relevant to some participants. Attendance drops sometimes occur when content becomes too technical, when there's a natural break in the presentation, or when the core value proposition has already been delivered.

To minimize future drop-offs, consider adding more interactive elements during this segment or restructuring the content to maintain engagement.`;
  }
};

/**
 * Analyze an engagement moment (peak or drop) from meeting captions
 */
export const analyzeEngagementMoment = async (
  request: EngagementAnalysisRequest
): Promise<EngagementAnalysisResponse> => {
  // Start measuring execution time
  const startTime = performance.now();

  // Input validation
  if (!request || !request.type) {
    return { error: 'Invalid request format.' };
  }

  if (!request.captionText || request.captionText.trim().length === 0) {
    return { error: 'No caption text provided for analysis.' };
  }

  // Truncate caption text if it's too long
  const truncatedCaptionText = truncateText(request.captionText);
  const truncated = truncatedCaptionText.length < request.captionText.length;
  if (truncated) {
    console.log(`Caption text truncated from ${request.captionText.length} to ${truncatedCaptionText.length} characters`);
  }

  // Log the analysis request at start
  try {
    aiAnalysisLogger.logAnalysis({
      timestamp: new Date().toISOString(),
      requestType: request.type,
      request: {
        ...request,
        captionText: `${truncatedCaptionText.length} chars${truncated ? ' (truncated)' : ''}`
      },
      response: null,
      error: null,
      success: false, // Will be updated if successful
    });
  } catch (logError) {
    console.error('Failed to log analysis request:', logError);
    // Continue with the analysis even if logging fails
  }

  try {
    const apiKey = getOpenAIKey();
    if (!apiKey) {
      console.warn('Using fallback analysis generation due to missing OpenAI API key');
      const fallbackAnalysis = generateFallbackAnalysis({
        ...request,
        captionText: truncatedCaptionText
      });

      // Log the fallback response
      aiAnalysisLogger.logAnalysis({
        timestamp: new Date().toISOString(),
        requestType: request.type,
        request: {
          ...request,
          captionText: `${truncatedCaptionText.length} chars${truncated ? ' (truncated)' : ''}`
        },
        response: { analysis: 'FALLBACK: ' + fallbackAnalysis.substring(0, 50) + '...' },
        success: true,
        executionTimeMs: performance.now() - startTime
      });

      return {
        analysis: fallbackAnalysis,
        error: 'Using generated analysis due to missing OpenAI API key. To use AI analysis, please add a valid VITE_OPENAI_API_KEY to your .env file.'
      };
    }

    // Build the appropriate prompt based on the type of analysis
    let prompt = '';
    if (request.type === 'peak') {
      prompt = `You are an expert in audience engagement analysis for webinars and live events.\n\nThis is a transcript excerpt from a Zoom webinar at timestamp ${request.timePoint}. At this point in the session, there was a noticeable spike in attendance, with ${request.attendeeCount || 'several'} participants joining.\n\nYour task is to analyze the following segment and infer what might have triggered this increase in viewer interest. Consider factors like topic transitions, speaker changes, demonstrations, Q&A sessions, key information reveals, etc.\n\nTranscript excerpt:\n${truncatedCaptionText}\n\nProvide a concise assessment (2-3 paragraphs) of what specifically in this segment likely drove the engagement spike.`;
    } else {
      prompt = `You are an expert in audience engagement analysis for webinars and live events.\n\nThis is a transcript excerpt from a Zoom webinar at timestamp ${request.timePoint}. At this point in the session, there was a noticeable drop in attendance, with ${request.attendeeCount || 'several'} participants leaving.\n\nYour task is to analyze the following segment and identify potential reasons for this decrease in viewer engagement. Consider factors like topic difficulty, presentation pacing, technical content, conclusion of major points, etc.\n\nTranscript excerpt:\n${truncatedCaptionText}\n\nProvide a concise assessment (2-3 paragraphs) of what might have caused viewers to leave during this segment and suggestions for how this could have been prevented.`;
    }

    // Make the OpenAI API request with timeout handling and retry logic
    const response = await fetchWithRetry('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: 'You are an expert webinar and meeting analyst.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 500
      })
    }, MAX_RETRIES, DEFAULT_TIMEOUT_MS);

    if (!response.ok) {
      try {
        const errorData = await response.json();
        const errorMessage = errorData?.error?.message || `API Error: ${response.status} ${response.statusText}`;

        // Log the error
        aiAnalysisLogger.logAnalysis({
          timestamp: new Date().toISOString(),
          requestType: request.type,
          request: {
            type: request.type,
            timePoint: request.timePoint,
            attendeeCount: request.attendeeCount,
            captionTextLength: truncatedCaptionText.length
          },
          response: null,
          error: errorMessage,
          success: false,
          executionTimeMs: performance.now() - startTime
        });

        return { error: errorMessage };
      } catch (jsonError) {
        const errorMessage = `API Error: ${response.status} ${response.statusText}. Could not parse error response.`;
        return { error: errorMessage };
      }
    }

    // Parse the successful response
    try {
      const data = await response.json();
      const analysisText = data?.choices?.[0]?.message?.content || '';

      if (!analysisText) {
        const errorMessage = 'Received empty analysis from OpenAI';
        // Log the error
        aiAnalysisLogger.logAnalysis({
          timestamp: new Date().toISOString(),
          requestType: request.type,
          request: {
            type: request.type,
            timePoint: request.timePoint,
            attendeeCount: request.attendeeCount,
            captionTextLength: truncatedCaptionText.length
          },
          response: null,
          error: errorMessage,
          success: false,
          executionTimeMs: performance.now() - startTime
        });
        return { error: errorMessage };
      }

      // Log the successful analysis
      aiAnalysisLogger.logAnalysis({
        timestamp: new Date().toISOString(),
        requestType: request.type,
        request: {
          type: request.type,
          timePoint: request.timePoint,
          attendeeCount: request.attendeeCount,
          captionTextLength: truncatedCaptionText.length
        },
        response: analysisText,
        error: null,
        success: true,
        executionTimeMs: performance.now() - startTime
      });

      return { analysis: analysisText };
    } catch (parseError) {
      const errorMessage = 'Failed to parse OpenAI response';
      console.error(errorMessage, parseError);

      // Log the error
      aiAnalysisLogger.logAnalysis({
        timestamp: new Date().toISOString(),
        requestType: request.type,
        request: {
          type: request.type,
          timePoint: request.timePoint,
          attendeeCount: request.attendeeCount,
          captionTextLength: truncatedCaptionText.length
        },
        response: null,
        error: errorMessage,
        success: false,
        executionTimeMs: performance.now() - startTime
      });

      return { error: errorMessage };
    }
  } catch (error) {
    // Create detailed error message for debugging
    const errorMessage = error instanceof Error
      ? `${error.name}: ${error.message}`
      : 'Unknown error during OpenAI analysis';

    // If it's an AbortError, it was likely due to timeout
    const isTimeout = error instanceof Error && error.name === 'AbortError';
    const friendlyMessage = isTimeout
      ? 'Analysis request timed out. This might be due to heavy server load or a temporary issue. Please try again.'
      : errorMessage;

    // Add more details for debugging
    console.error('OpenAI API error:', {
      error,
      request: {
        type: request.type,
        timePoint: request.timePoint,
        captionTextLength: truncatedCaptionText.length,
        isTimeout
      }
    });

    // Log the error
    try {
      aiAnalysisLogger.logAnalysis({
        timestamp: new Date().toISOString(),
        requestType: request.type,
        request: {
          type: request.type,
          timePoint: request.timePoint,
          attendeeCount: request.attendeeCount,
          captionTextLength: truncatedCaptionText.length
        },
        response: null,
        error: friendlyMessage,
        success: false,
        executionTimeMs: performance.now() - startTime
      });
    } catch (logError) {
      console.error('Failed to log analysis error:', logError);
    }

    return { error: friendlyMessage };
  } finally {
    // Nothing to clean up in the finally block anymore since fetchWithRetry handles timeouts internally
  }
}

/**
 * Generate a short concise insight for the engagement table
 * This creates a very brief reason for a peak or drop event
 */
export const generateShortInsight = (
  type: 'peak' | 'drop',
  timePoint: string,
  attendeeCount: number,
  captionText: string
): string => {
  // Get a short version of the caption text for analysis
  const shortText = captionText.substring(0, 500);

  // Extract key phrases that might indicate discussion topics
  const keyPhrasePatterns = [
    // Product/feature patterns
    /(?:introducing|discuss(?:ing)?|explain(?:ing)?|present(?:ing)?|demonstrate|showcase)\s+(?:our|the)\s+([a-z0-9\s-]+(?:feature|product|service|platform|solution|tool|application|app))/i,
    // Demo patterns
    /(?:demo(?:nstrat(?:ing|e))?|show(?:ing)?|present(?:ing)?)\s+(?:how|the)\s+([a-z0-9\s-]+)/i,
    // Technical topics
    /(?:technical|advanced|detailed)\s+([a-z0-9\s-]+)/i,
    // Q&A patterns
    /(?:questions?|Q\s*&\s*A|answers?|responding)\s+(?:about|on|regarding)?\s*([a-z0-9\s-]+)?/i,
    // Pricing/cost patterns
    /(?:pric(?:ing|e)|cost|subscription|payment)\s+(?:model|plan|structure|details?|information|options?)/i,
  ];

  // Extract names that might indicate speakers
  const namePattern = /(?:(?:welcome|introduce|thanks?|thank you)\s+(?:\w+\s+)?((?:[A-Z][a-z]+\s+){1,2}[A-Z][a-z]+))/i;

  // Check for specific engagement indicators
  const isBreak = /(?:break|pause|stop|rest|intermission|recess)/i.test(shortText);
  const isEnding = /(?:conclud(?:e|ing)|end(?:ing)?|final|wrap(?:ping)?\s+up|close|closing|goodbye|thank\s+you\s+for|we're\s+done)/i.test(shortText);
  const isQA = /(?:question|answer|Q\s*&\s*A|ask)/i.test(shortText);
  const isDemo = /(?:demo|demonstrate|presentation|showing|display)/i.test(shortText);
  const isTechnical = /(?:technical|complex|code|algorithm|detailed|architecture|implementation)/i.test(shortText);
  const isPricing = /(?:price|cost|subscription|payment|invest|package|plan)/i.test(shortText);
  const isNewTopic = /(?:new|next|topic|moving|let's|discuss|shift|transition|section)/i.test(shortText);
  const isKeyInfo = /(?:key|important|critical|essential|main|primary|vital|significant)/i.test(shortText);
  const isInteractive = /(?:interactive|engage|participate|interact|discuss|join|together|collaborate|activity|exercise)/i.test(shortText);

  // If it's a peak, identify the most likely reason
  if (type === 'peak') {
    // Try to extract a speaker name
    const speakerMatch = shortText.match(namePattern);
    if (speakerMatch && speakerMatch[1]) {
      return `Guest speaker: ${speakerMatch[1].split(' ')[0]}`;
    }

    // Check for key phrases about products/features
    for (const pattern of keyPhrasePatterns) {
      const match = shortText.match(pattern);
      if (match && match[1]) {
        // Limit length for UI display
        const topic = match[1].trim();
        if (topic.length > 20) {
          return `${topic.substring(0, 18)}...`;
        }
        return topic.charAt(0).toUpperCase() + topic.slice(1);
      }
    }

    // Check engagement indicators in priority order
    if (isDemo) return "Product demonstration";
    if (isQA) return "Q&A session";
    if (isKeyInfo) return "Key information revealed";
    if (isPricing) return "Pricing discussion";
    if (isInteractive) return "Interactive segment";
    if (isNewTopic) return "New topic introduction";

    // Extract the most frequent meaningful words if no patterns matched
    const words = shortText.split(/\s+/)
      .filter(word => word.length > 4 && !/^(because|however|therefore|though|although|these|those|their|where|which|what|when|about|there|that|have|this)$/i.test(word))
      .map(word => word.toLowerCase());

    // Count word frequencies
    const wordCounts = {};
    words.forEach(word => {
      wordCounts[word] = (wordCounts[word] || 0) + 1;
    });

    // Sort by frequency
    const sortedWords = Object.entries(wordCounts)
      .sort((a, b) => (b[1] as number) - (a[1] as number))
      .map(entry => entry[0]);

    if (sortedWords.length > 0) {
      // Use the most frequent word as a topic
      const topWord = sortedWords[0];
      return `Discussion about ${topWord}`;
    }

    // Fallback options with some variety based on attendee count
    const peakOptions = [
      "Key information revealed",
      "Engaging content section",
      "Interactive demonstration",
      "Visual presentation",
      "Important announcement"
    ];

    return peakOptions[Math.floor(Math.random() * peakOptions.length)];
  }
  // For drop-offs
  else {
    // Check for clear drop-off indicators first
    if (isBreak) return "Break announcement";
    if (isEnding) return "Session conclusion";
    if (isTechnical) return "Technical complexity";

    // Try to extract complex topics
    for (const pattern of keyPhrasePatterns) {
      const match = shortText.match(pattern);
      if (match && match[1] && isTechnical) {
        const complexTopic = match[1].trim();
        if (complexTopic.length > 15) {
          return `Complex: ${complexTopic.substring(0, 12)}...`;
        }
        return `Complex ${complexTopic}`;
      }
    }

    // Extract the most frequent meaningful words
    const words = shortText.split(/\s+/)
      .filter(word => word.length > 4 && !/^(because|however|therefore|though|although|these|those|their|where|which|what|when|about|there|that|have|this)$/i.test(word))
      .map(word => word.toLowerCase());

    // Count word frequencies
    const wordCounts = {};
    words.forEach(word => {
      wordCounts[word] = (wordCounts[word] || 0) + 1;
    });

    // Sort by frequency
    const sortedWords = Object.entries(wordCounts)
      .sort((a, b) => (b[1] as number) - (a[1] as number))
      .map(entry => entry[0]);

    if (sortedWords.length > 0) {
      // Use the most frequent word as a topic that might be causing drops
      const topWord = sortedWords[0];
      const dropPrefixes = ["Lengthy ", "Technical ", "Complex ", "End of "];
      const prefix = dropPrefixes[Math.floor(Math.random() * dropPrefixes.length)];
      return `${prefix}${topWord}`;
    }

    // Fallback options with more variety
    const dropOptions = [
      "Content pacing issue",
      "Topic complexity",
      "Expected drop-off point",
      "Transition period",
      "End of key content"
    ];

    return dropOptions[Math.floor(Math.random() * dropOptions.length)];
  }
};
