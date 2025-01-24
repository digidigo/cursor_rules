import { Message } from "./chat-container";
import { cn } from "@/lib/utils";
import { Bot, User, CheckCircle2, Clock } from "lucide-react";

interface ChatMessagesProps {
  messages: Message[];
}

export function ChatMessages({ messages }: ChatMessagesProps) {
  return (
    <div className="space-y-4">
      {messages.map((message) => (
        <div
          key={message.id}
          className={cn(
            "flex gap-3",
            message.role === "user" ? "justify-end" : "justify-start"
          )}
        >
          {message.role === "system" && (
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Bot className="h-5 w-5 text-primary" />
            </div>
          )}
          <div
            className={cn(
              "rounded-2xl px-4 py-2 max-w-[80%] relative group transition-all",
              message.role === "user"
                ? "bg-primary text-primary-foreground rounded-tr-none"
                : "bg-muted rounded-tl-none"
            )}
          >
            <div className="text-sm">{message.content}</div>
            <div className="text-xs mt-1 opacity-70 flex items-center gap-1">
              {message.timestamp.toLocaleTimeString()}
              {message.role === "user" && (
                <span className="ml-1">
                  {message.status === "sending" ? (
                    <Clock className="h-3 w-3 animate-pulse" />
                  ) : (
                    <CheckCircle2 className="h-3 w-3" />
                  )}
                </span>
              )}
            </div>
          </div>
          {message.role === "user" && (
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-5 w-5 text-primary" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
} 