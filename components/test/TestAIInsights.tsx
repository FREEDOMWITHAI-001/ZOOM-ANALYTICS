"use client";
import React, { useEffect, useState } from 'react';
import { testShortInsightGeneration } from '@/utils/ai-analysis-test-utility';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface TestResult {
  type: 'peak' | 'drop';
  timePoint: string;
  caption: string;
  insight: string;
}

const TestAIInsights = () => {
  const [results, setResults] = useState<TestResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  const runTests = () => {
    setIsLoading(true);
    
    // Use setTimeout to prevent UI blocking
    setTimeout(() => {
      try {
        // Create a mock console.log to capture output
        const originalLog = console.log;
        const capturedLogs: string[] = [];
        
        console.log = (...args) => {
          capturedLogs.push(args.join(' '));
          originalLog(...args);
        };
        
        // Run the test function
        testShortInsightGeneration();
        
        // Restore original console.log
        console.log = originalLog;
        
        // Parse the captured logs to extract test results
        const testResults: TestResult[] = [];
        let currentTest: Partial<TestResult> = {};
        
        capturedLogs.forEach(log => {
          if (log.includes('Test Case')) {
            // Start of a new test case
            currentTest = {};
            if (log.includes('(peak)')) currentTest.type = 'peak';
            if (log.includes('(drop)')) currentTest.type = 'drop';
          } else if (log.includes('- Time:')) {
            currentTest.timePoint = log.replace('- Time:', '').trim();
          } else if (log.includes('- Caption:')) {
            currentTest.caption = log.replace('- Caption:', '').trim();
          } else if (log.includes('- Generated Insight:')) {
            currentTest.insight = log
              .replace('- Generated Insight:', '')
              .replace(/"/g, '')
              .trim();
            
            // End of test case, add to results if complete
            if (
              currentTest.type && 
              currentTest.timePoint && 
              currentTest.caption && 
              currentTest.insight
            ) {
              testResults.push(currentTest as TestResult);
              currentTest = {};
            }
          }
        });
        
        setResults(testResults);
      } catch (error) {
        console.error('Error running tests:', error);
      } finally {
        setIsLoading(false);
      }
    }, 100);
  };
  
  useEffect(() => {
    // Run tests automatically on component mount
    runTests();
  }, []);
  
  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">AI Short Insight Tests</h1>
        <Button 
          onClick={runTests} 
          disabled={isLoading}
          className="flex items-center gap-2"
        >
          {isLoading ? 'Running Tests...' : 'Run Tests Again'}
        </Button>
      </div>
      
      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
          <span className="ml-2">Testing insight generation...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Peak Insights</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {results
                  .filter(result => result.type === 'peak')
                  .map((result, index) => (
                    <div key={index} className="p-3 rounded-md bg-muted/50">
                      <p className="text-sm font-medium">Time: {result.timePoint}</p>
                      <p className="text-xs text-muted-foreground my-1 line-clamp-2">
                        Caption: {result.caption}
                      </p>
                      <p className="text-sm mt-2 font-bold text-primary">
                        Insight: {result.insight}
                      </p>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Drop Insights</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {results
                  .filter(result => result.type === 'drop')
                  .map((result, index) => (
                    <div key={index} className="p-3 rounded-md bg-muted/50">
                      <p className="text-sm font-medium">Time: {result.timePoint}</p>
                      <p className="text-xs text-muted-foreground my-1 line-clamp-2">
                        Caption: {result.caption}
                      </p>
                      <p className="text-sm mt-2 font-bold text-destructive">
                        Insight: {result.insight}
                      </p>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default TestAIInsights; 