"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SendHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  onSubmit: (message: string) => void;
  disabled?: boolean;
}

export function ChatInput({ onSubmit, disabled }: ChatInputProps) {
  const [input, setInput] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      onSubmit(input);
      setInput("");
    }
  };

  const handleExampleClick = (example: string) => {
    onSubmit(example);
  };

  return (
    <div className="w-full space-y-4">
      <form onSubmit={handleSubmit} className="relative">
        <Input
          type="text"
          placeholder="Type your message..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={disabled}
          className="w-full pr-20 focus-visible:ring-1 text-base py-6"
        />
        <Button 
          type="submit" 
          size="icon"
          disabled={disabled || !input.trim()}
          className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8"
        >
          <SendHorizontal className="h-5 w-5" />
        </Button>
      </form>
      
      <div className="flex flex-wrap gap-2 justify-center px-4">
        <Button 
          variant="secondary" 
          size="sm"
          onClick={() => handleExampleClick("What can you do?")}
          disabled={disabled}
          className="text-xs"
        >
          What can you do?
        </Button>
        <Button 
          variant="secondary" 
          size="sm"
          onClick={() => handleExampleClick("How many users do we have?")}
          disabled={disabled}
          className="text-xs"
        >
          User Count
        </Button>
        <Button 
          variant="secondary" 
          size="sm"
          onClick={() => handleExampleClick("Add a user for John Smith")}
          disabled={disabled}
          className="text-xs"
        >
          Add User
        </Button>
      </div>
    </div>
  );
} 