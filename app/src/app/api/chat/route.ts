import { NextResponse } from 'next/server';
import { ChatService } from '@/services/chat/chat.service';
import { ChatMessage } from '@/types/chat';

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    const chatService = ChatService.getInstance({
      model: 'gpt-4-0125-preview',
      maxResponseTokens: 500,
      apiKey: process.env.OPENAI_API_KEY!,
    });

    const encoder = new TextEncoder();
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();

    let responseContent = '';
    let usage = null;
    let cost = null;

    chatService.streamResponse(messages as ChatMessage[], {
      onContent: async (content: string) => {
        responseContent = content;
        await writer.write(
          encoder.encode(`data: ${JSON.stringify({ content })}\n\n`)
        );
      },
      onDone: async (data: { content: string; usage?: any; cost?: number }) => {
        if (data.usage) {
          usage = data.usage;
          cost = data.cost;
          await writer.write(
            encoder.encode(
              `data: ${JSON.stringify({ content: responseContent, usage, cost })}\n\n`
            )
          );
        }
        await writer.close();
      },
      onError: async (error: Error) => {
        console.error('Stream error:', error);
        await writer.abort(error);
      },
    });

    return new NextResponse(stream.readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        Connection: 'keep-alive',
        'Cache-Control': 'no-cache, no-transform',
      },
    });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Failed to process chat request' },
      { status: 500 }
    );
  }
} 