"use client";
import React from "react";
import { Button } from "@/components/ui/button";

interface ScenarioSelectorProps {
  scenarios: Array<{ name: string; id: string }>;
  selectedScenario: string;
  onSelectScenario: (scenarioId: string) => void;
}

const ScenarioSelector: React.FC<ScenarioSelectorProps> = ({
  scenarios,
  selectedScenario,
  onSelectScenario
}) => {
  return (
    <div className="flex gap-2 flex-wrap">
      {scenarios.map((scenario) => (
        <Button
          key={scenario.id}
          variant={
            selectedScenario === scenario.id ? "default" : "outline"
          }
          onClick={() => onSelectScenario(scenario.id)}
        >
          {scenario.name}
        </Button>
      ))}
    </div>
  );
};

export default ScenarioSelector;