"use client";
import React, { useState, useEffect } from "react";
import { Building2, ChevronDown, AlertCircle, ArrowRight } from "lucide-react";
import { Button } from "./ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "./ui/card";
import { Alert, AlertDescription } from "./ui/alert";
import { motion } from "framer-motion";

interface ClientSelectorProps {
  onClientSelect: (clientName: string) => void;
}

const ClientSelector = ({ onClientSelect }: ClientSelectorProps) => {
  const [clients, setClients] = useState<string[]>([]);
  const [selectedClient, setSelectedClient] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/clients");
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to fetch clients");
      }

      if (!data.clients || data.clients.length === 0) {
        setError("No clients found in the database.");
        setClients([]);
        return;
      }

      setClients(data.clients);
    } catch (err: any) {
      setError(`Failed to load clients: ${err.message}`);
      setClients([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelect = (client: string) => {
    setSelectedClient(client);
    setShowDropdown(false);
  };

  const handleContinue = () => {
    if (selectedClient) {
      onClientSelect(selectedClient);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-6">
      <Card className="glass-card shadow-xl dark:shadow-primary/5 border-border/50 overflow-visible">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-purple-500/5 pointer-events-none" />
        <CardHeader>
          <CardTitle className="text-2xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
            Select Client
          </CardTitle>
          <CardDescription className="text-muted-foreground text-base">
            Choose a client to view their Zoom meeting analytics.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {error}
                <Button
                  variant="outline"
                  size="sm"
                  className="ml-2"
                  onClick={fetchClients}
                >
                  Retry
                </Button>
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-3">
            <label className="text-base font-medium flex items-center gap-2 text-foreground">
              <Building2 className="h-4 w-4 text-primary" />
              Client
            </label>

            <div className="relative">
              <Button
                onClick={() => setShowDropdown(!showDropdown)}
                variant="outline"
                className="w-full h-12 justify-between border-2 border-primary/30 hover:border-primary/60 bg-background/50 hover:bg-background/80 transition-all duration-300"
                disabled={isLoading}
              >
                <span className="font-medium truncate">
                  {isLoading
                    ? "Loading clients..."
                    : selectedClient || "Select a client..."}
                </span>
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${showDropdown ? "rotate-180" : ""}`}
                />
              </Button>

              {showDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="absolute top-full left-0 right-0 mt-1 bg-background border border-border rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto"
                >
                  {clients.length === 0 ? (
                    <div className="p-4 text-center text-muted-foreground">
                      No clients found
                    </div>
                  ) : (
                    clients.map((client) => (
                      <button
                        key={client}
                        onClick={() => handleSelect(client)}
                        className={`w-full p-3 text-left hover:bg-primary/10 border-b border-border last:border-b-0 transition-colors ${
                          selectedClient === client
                            ? "bg-primary/10 font-semibold"
                            : ""
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-primary" />
                          <span className="font-medium">{client}</span>
                        </div>
                      </button>
                    ))
                  )}
                </motion.div>
              )}
            </div>
          </div>

          {selectedClient && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 border border-primary/20 rounded-lg bg-primary/5"
            >
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" />
                <span className="font-semibold text-primary">
                  Selected: {selectedClient}
                </span>
              </div>
            </motion.div>
          )}
        </CardContent>
        <CardFooter className="flex justify-end pb-6">
          <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
            <Button
              onClick={handleContinue}
              disabled={!selectedClient}
              className="flex items-center gap-2 gradient-bg border-0 shadow-md shadow-primary/20 px-6 py-6 h-auto text-base font-medium"
            >
              Continue
              <ArrowRight className="h-5 w-5 ml-1" />
            </Button>
          </motion.div>
        </CardFooter>
      </Card>
    </div>
  );
};

export default ClientSelector;
