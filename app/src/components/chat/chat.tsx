"use client";

import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage } from './chat-message';
import { ChatInput } from './chat-input';
import { ChatMessage as ChatMessageType } from '@/types/chat';
import { Coins, Cpu } from 'lucide-react';

interface TokenStats {
  total: number;
  cost: number;
}

export function Chat() {
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [stats, setStats] = useState<TokenStats>({ total: 0, cost: 0 });
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const updateStats = (usage: { total_tokens: number }, cost: number) => {
    setStats(prev => ({
      total: prev.total + usage.total_tokens,
      cost: prev.cost + cost
    }));
  };

  const handleSubmit = async (content: string) => {
    if (isLoading) return;

    setIsLoading(true);
    const newMessage: ChatMessageType = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, newMessage]);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, newMessage],
        }),
      });

      if (!response.ok) throw new Error('Failed to send message');

      const data = await response.json();
      
      // Add assistant's response
      const assistantMessage: ChatMessageType = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.content,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Update token stats
      if (data.usage && data.cost) {
        updateStats(data.usage, data.cost);
      }
    } catch (error) {
      console.error('Error:', error);
      setMessages(prev => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: 'Sorry, I encountered an error. Please try again.',
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b">
        <h1 className="text-2xl font-semibold text-foreground">Chat CRM</h1>
        <div className="flex items-center space-x-6 text-sm text-muted-foreground">
          <div className="flex items-center space-x-2">
            <Cpu className="h-4 w-4" />
            <span>{stats.total.toLocaleString()} tokens</span>
          </div>
          <div className="flex items-center space-x-2">
            <Coins className="h-4 w-4" />
            <span>${stats.cost.toFixed(4)}</span>
          </div>
          <div className="pl-6 border-l">
            {messages.length} messages
          </div>
        </div>
      </div>

      {/* Chat Container */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full flex flex-col max-w-4xl mx-auto px-4">
          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto py-4 space-y-6">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-4 py-12 space-y-4">
                <h2 className="text-2xl font-semibold text-foreground">
                  Welcome to Chat CRM
                </h2>
                <p className="text-muted-foreground max-w-md">
                  Ask me anything about your projects, users, invoices, or bills. 
                  Try the example queries below to get started.
                </p>
              </div>
            ) : (
              messages.map((message) => (
                <ChatMessage key={message.id} message={message} />
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="py-4 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <ChatInput onSubmit={handleSubmit} disabled={isLoading} />
          </div>
        </div>
      </div>
    </div>
  );
} 
