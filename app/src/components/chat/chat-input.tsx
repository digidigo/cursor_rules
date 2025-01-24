"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SendHorizontal, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  onSendMessage: (message: string) => void;
}

export function ChatInput({ onSendMessage }: ChatInputProps) {
  const [message, setMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  const handleSend = () => {
    const trimmedMessage = message.trim();
    if (trimmedMessage) {
      onSendMessage(trimmedMessage);
      setMessage("");
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="relative">
      <div className="absolute left-4 top-1/2 -translate-y-1/2">
        <Sparkles className="h-4 w-4 text-muted-foreground" />
      </div>
      <Input
        value={message}
        onChange={(e) => {
          setMessage(e.target.value);
          setIsTyping(e.target.value.length > 0);
        }}
        onKeyDown={handleKeyDown}
        placeholder="Ask about your finances..."
        className="pl-10 pr-16"
      />
      <Button
        onClick={handleSend}
        disabled={!message.trim()}
        size="icon"
        variant="ghost"
        className={cn(
          "absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8",
          isTyping ? "opacity-100" : "opacity-0",
          "transition-opacity duration-200"
        )}
      >
        <SendHorizontal className="h-4 w-4" />
      </Button>
    </div>
  );
} 