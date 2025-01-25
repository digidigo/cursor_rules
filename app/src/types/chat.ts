/**
 * Represents a chat message in the conversation
 */
export interface ChatMessage {
  /** The role of who sent the message (user or assistant) */
  role: 'user' | 'assistant' | 'system';
  /** The content of the message */
  content: string;
  /** Unique identifier for the message */
  id: string;
  /** Timestamp when the message was created */
  timestamp: Date;
  /** Token usage for this message */
  tokens?: TokenUsage;
  /** Cost in USD for this message */
  cost?: number;
}

/**
 * Configuration options for the chat service
 */
export interface ChatServiceConfig {
  /** OpenAI API key */
  apiKey: string;
  /** Model to use for chat completion */
  model: string;
  /** Maximum number of messages to keep in context */
  maxContextMessages?: number;
  /** Whether to stream the response */
  stream?: boolean;
  /** Maximum tokens in response (default: 500) */
  maxResponseTokens?: number;
  /** Cost per 1k tokens for input (prompt) */
  inputTokenCost?: number;
  /** Cost per 1k tokens for output (completion) */
  outputTokenCost?: number;
  /** Cached cost per 1k tokens for input (prompt) */
  cachedInputTokenCost?: number;
}

/**
 * Response from the chat service
 */
export interface ChatResponse {
  /** The message content */
  content: string;
  /** Whether the response is complete */
  isComplete: boolean;
  /** Any error that occurred */
  error?: Error;
  /** Token usage for this response */
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  /** Cost in USD for this response */
  cost?: number;
}

/**
 * Options for sending a chat message
 */
export interface SendMessageOptions {
  /** The message content to send */
  content: string;
  /** Previous messages for context */
  previousMessages?: ChatMessage[];
  /** Whether to stream the response */
  stream?: boolean;
}

export interface TokenUsage {
  prompt: number;
  completion: number;
  total: number;
  cost?: number;
} 