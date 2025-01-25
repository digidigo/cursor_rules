import OpenAI from 'openai';
import { 
  ChatMessage, 
  ChatServiceConfig, 
  ChatResponse, 
  SendMessageOptions 
} from '@/types/chat';

interface StreamCallbacks {
  onContent: (content: string) => void | Promise<void>;
  onDone: (data: { content: string; usage?: OpenAI.Chat.Completions.ChatCompletion['usage']; cost?: number }) => void | Promise<void>;
  onError: (error: any) => void | Promise<void>;
}

/**
 * Service for handling chat interactions with OpenAI
 */
export class ChatService {
  private static instance: ChatService;
  private openai: OpenAI;
  private config: ChatServiceConfig;
  private readonly inputTokenCost: number = 0.15 / 1_000_000; // $0.15 per 1M tokens
  private readonly cachedInputTokenCost: number = 0.075 / 1_000_000; // $0.075 per 1M tokens
  private readonly outputTokenCost: number = 0.60 / 1_000_000; // $0.60 per 1M tokens

  private constructor(config: ChatServiceConfig) {
    this.config = {
      maxContextMessages: 100,
      stream: true,
      maxResponseTokens: 500,
      ...config,
    };
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  /**
   * Get the singleton instance of ChatService
   */
  public static getInstance(config: ChatServiceConfig): ChatService {
    if (!ChatService.instance) {
      ChatService.instance = new ChatService(config);
    }
    return ChatService.instance;
  }

  /**
   * Send a message and get a response
   */
  public async sendMessage(options: SendMessageOptions): Promise<ReadableStream> {
    try {
      const messages = this.buildMessages(options);
      let responseContent = '';
      
      const stream = await this.openai.chat.completions.create({
        model: this.config.model,
        messages: messages.map(msg => ({
          role: msg.role as 'user' | 'assistant' | 'system',
          content: msg.content,
        })),
        stream: true,
        max_tokens: this.config.maxResponseTokens,
      });

      // Create a readable stream for the response
      return new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of stream) {
              const content = chunk.choices[0]?.delta?.content || '';
              if (content) {
                responseContent += content;
                controller.enqueue(
                  new TextEncoder().encode(
                    `data: ${JSON.stringify({ 
                      content: responseContent,
                      usage: chunk.usage,
                    })}\n\n`
                  )
                );
              }
            }
            controller.close();
          } catch (error) {
            controller.error(error);
          }
        },
      });
    } catch (error) {
      console.error('ChatService Error:', error);
      throw error;
    }
  }

  /**
   * Build the messages array for the API request
   */
  private buildMessages(options: SendMessageOptions): { role: string; content: string }[] {
    const messages = [...(options.previousMessages || [])];
    
    // Add the new message
    messages.push({
      role: 'user',
      content: options.content,
      id: Date.now().toString(),
      timestamp: new Date(),
    });

    // Limit context window if needed
    if (this.config.maxContextMessages) {
      return messages
        .slice(-this.config.maxContextMessages)
        .map(({ role, content }) => ({ role, content }));
    }

    return messages.map(({ role, content }) => ({ role, content }));
  }

  private calculateCost(promptTokens: number, completionTokens: number): number {
    // For simplicity, we'll use the non-cached rate for input tokens
    const inputCost = promptTokens * this.inputTokenCost;
    const outputCost = completionTokens * this.outputTokenCost;
    return Number((inputCost + outputCost).toFixed(6));
  }

  async streamResponse(messages: ChatMessage[], callbacks: StreamCallbacks) {
    try {
      const stream = await this.openai.chat.completions.create({
        model: this.config.model,
        messages: messages.map(msg => ({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content,
        })) as OpenAI.Chat.ChatCompletionMessageParam[],
        stream: true,
        max_tokens: this.config.maxResponseTokens,
      });

      let responseContent = '';

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        responseContent += content;
        
        if (content) {
          await callbacks.onContent(responseContent);
        }
      }

      // Get final completion with usage data
      const completion = await this.openai.chat.completions.create({
        model: this.config.model,
        messages: messages.map(msg => ({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content,
        })) as OpenAI.Chat.ChatCompletionMessageParam[],
        stream: false,
        max_tokens: this.config.maxResponseTokens,
      });

      const cost = completion.usage ? 
        this.calculateCost(completion.usage.prompt_tokens, completion.usage.completion_tokens) : 
        undefined;

      await callbacks.onDone({
        content: responseContent,
        usage: completion.usage,
        cost,
      });
    } catch (error) {
      await callbacks.onError(error);
      throw error;
    }
  }
} 