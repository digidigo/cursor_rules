import { NextRequest, NextResponse } from 'next/server';
import { ChatService } from '@/services/chat/chat.service';
import { ChatMessage } from '@/types/chat';

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json();
    const lastMessage = messages[messages.length - 1];

    const chatService = ChatService.getInstance({
      model: process.env.OPENAI_MODEL || 'gpt-4',
      maxContextMessages: 10,
      maxResponseTokens: 500,
      apiKey: process.env.OPENAI_API_KEY!
    });

    const response = await chatService.sendMessage({
      content: lastMessage.content,
      previousMessages: messages.slice(0, -1),
    });

    return NextResponse.json(response);
  } catch (error) {
    console.error('Chat API Error:', error);
    return NextResponse.json(
      { error: 'Failed to process chat request' },
      { status: 500 }
    );
  }
} 