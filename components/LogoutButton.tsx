"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LogoutButtonProps {
  clientName: string;
}

export function LogoutButton({ clientName }: LogoutButtonProps) {
  const router = useRouter();

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground hidden sm:inline">
        {clientName}
      </span>
      <Button
        variant="ghost"
        size="icon"
        onClick={handleLogout}
        className="rounded-full bg-background/30 backdrop-blur-sm hover:bg-background/50"
        title="Sign out"
      >
        <LogOut className="h-[1.2rem] w-[1.2rem]" />
        <span className="sr-only">Sign out</span>
      </Button>
    </div>
  );
}
