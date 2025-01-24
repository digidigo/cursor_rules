"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { ChatInput } from "./chat-input";
import { ChatMessages } from "./chat-messages";
import { Bot, User } from "lucide-react";

export interface Message {
  id: string;
  content: string;
  role: "user" | "system";
  timestamp: Date;
  status?: "sending" | "sent" | "error";
}

export function ChatContainer() {
  const [messages, setMessages] = useState<Message[]>([]);

  const handleSendMessage = async (content: string) => {
    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      content,
      role: "user",
      timestamp: new Date(),
      status: "sending",
    };
    setMessages((prev) => [...prev, userMessage]);

    // Update status to sent after a brief delay
    setTimeout(() => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === userMessage.id ? { ...msg, status: "sent" } : msg
        )
      );
    }, 300);

    // Simulate system response after delay
    setTimeout(() => {
      const systemMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: "This is a simulated response. Financial AI integration coming soon!",
        role: "system",
        timestamp: new Date(),
        status: "sent",
      };
      setMessages((prev) => [...prev, systemMessage]);
    }, 1000);
  };

  return (
    <Card className="w-full max-w-4xl mx-auto backdrop-blur-sm bg-card/80 shadow-xl border-t border-l border-white/20">
      <div className="h-[600px] flex flex-col">
        <div className="border-b p-4 flex items-center gap-2 bg-muted/50">
          <Bot className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">Financial Assistant</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-4 scroll-smooth" style={{ scrollBehavior: 'smooth' }}>
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
              <Bot className="h-12 w-12 mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">Welcome to Financial Assistant</p>
              <p className="text-sm">Ask me anything about your finances!</p>
            </div>
          ) : (
            <ChatMessages messages={messages} />
          )}
        </div>
        <div className="border-t p-4 bg-background/50 backdrop-blur-sm">
          <ChatInput onSendMessage={handleSendMessage} />
        </div>
      </div>
    </Card>
  );
} 