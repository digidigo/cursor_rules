'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, DollarSign } from 'lucide-react';
import { ChatMessage } from '@/types/chat';

export function ChatInterface() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [usage, setUsage] = useState({ prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 });
  const [totalCost, setTotalCost] = useState(0);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom helper
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Scroll on new messages or content updates
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Keep input focused
  useEffect(() => {
    inputRef.current?.focus();
  }, [isLoading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: input.trim(),
      id: Date.now().toString(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    scrollToBottom();

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage],
        }),
      });

      if (!response.ok) throw new Error('Failed to send message');

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantMessage: ChatMessage = {
        role: 'assistant',
        content: '',
        id: (Date.now() + 1).toString(),
        timestamp: new Date(),
      };

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                assistantMessage.content = data.content;
                
                if (data.usage) {
                  setUsage(data.usage);
                  assistantMessage.tokens = {
                    prompt: data.usage.prompt_tokens,
                    completion: data.usage.completion_tokens,
                    total: data.usage.total_tokens,
                    cost: data.cost,
                  };
                  if (data.cost) {
                    setTotalCost(prev => Number((prev + data.cost).toFixed(6)));
                  }
                }
                
                setMessages(prev => {
                  const newMessages = [...prev];
                  const lastMessage = newMessages[newMessages.length - 1];
                  
                  if (lastMessage?.role === 'assistant' && lastMessage.id === assistantMessage.id) {
                    lastMessage.content = assistantMessage.content;
                    lastMessage.tokens = assistantMessage.tokens;
                    return [...newMessages];
                  } else {
                    return [...newMessages, { ...assistantMessage }];
                  }
                });
                
                // Scroll while streaming
                scrollToBottom();
              } catch (e) {
                console.error('Error parsing SSE message:', e);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: 'Sorry, there was an error processing your message.',
          id: Date.now().toString(),
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
      scrollToBottom();
    }
  };

  return (
    <div className="flex flex-col h-[600px] w-full max-w-2xl mx-auto border rounded-lg shadow-sm">
      <div className="flex justify-between items-center p-4 border-b">
        <h2 className="text-lg font-semibold">Chat Assistant</h2>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Tokens: {usage.total_tokens}</span>
          <span>|</span>
          <span>Input: {usage.prompt_tokens}</span>
          <span>|</span>
          <span>Output: {usage.completion_tokens}</span>
          <span>|</span>
          <div className="flex items-center gap-1">
            <DollarSign className="h-4 w-4" />
            <span>{totalCost.toFixed(6)}</span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full p-4">
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                <div
                  className={`max-w-[80%] rounded-lg p-3 ${
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{message.content}</p>
                  <div className="flex justify-between items-center text-xs opacity-70 mt-1">
                    <span>{message.timestamp.toLocaleTimeString()}</span>
                    {message.tokens && (
                      <div className="flex items-center gap-2">
                        <span>{message.tokens.total} tokens</span>
                        {message.tokens.cost && (
                          <span className="flex items-center gap-1">
                            <DollarSign className="h-3 w-3" />
                            {message.tokens.cost.toFixed(6)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-center">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>
      </div>

      <form onSubmit={handleSubmit} className="p-4 border-t flex gap-2">
        <Input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your message..."
          disabled={isLoading}
          className="flex-1"
          autoFocus
        />
        <Button type="submit" disabled={isLoading}>
          Send
        </Button>
      </form>
    </div>
  );
} 