import { cn } from "@/lib/utils";
import { ChatMessage as ChatMessageType } from "@/types/chat";
import { format } from "date-fns";

interface ChatMessageProps {
  message: ChatMessageType;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <div
      className={cn(
        "flex w-full",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      <div
        className={cn(
          "flex flex-col max-w-[80%] space-y-2 p-4 rounded-lg",
          isUser 
            ? "bg-primary text-primary-foreground" 
            : "bg-muted"
        )}
      >
        <div className="text-sm whitespace-pre-wrap">{message.content}</div>
        <div 
          className={cn(
            "text-xs",
            isUser 
              ? "text-primary-foreground/70" 
              : "text-muted-foreground"
          )}
        >
          {format(new Date(message.timestamp), "HH:mm")}
        </div>
      </div>
    </div>
  );
} 