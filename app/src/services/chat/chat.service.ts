import OpenAI from 'openai';
import { 
  ChatMessage, 
  ChatServiceConfig, 
  ChatResponse, 
  SendMessageOptions 
} from '@/types/chat';
import { SQL_PROMPTS } from './prompts/sql-prompts';
import { PrismaClient, Prisma } from '@prisma/client';
import { logger } from '@/lib/logger';
import { v4 as uuidv4 } from 'uuid';
import { readFileSync } from 'fs';
import { join } from 'path';
import { SQLService } from '../sql/sql.service';

interface StreamCallbacks {
  onContent: (content: string) => void | Promise<void>;
  onDone: (data: { content: string; usage?: OpenAI.Chat.Completions.ChatCompletion['usage']; cost?: number }) => void | Promise<void>;
  onError: (error: any) => void | Promise<void>;
}

interface SQLResponse {
  type: 'operation' | 'schema';
  response: {
    primary_table: string;
    secondary_table: string | null;
    operation: string;
    status: string;
    summary: string;
    sql: string;
    values?: any[];
  };
}

interface SchemaTable {
  name: string;
  sql: string;
}

/**
 * Service for handling chat interactions with OpenAI
 */
export class ChatService {
  private static instance: ChatService;
  private openai: OpenAI;
  private config: ChatServiceConfig;
  private sqlService: SQLService;
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

    if (!this.config.model) {
      throw new Error('OpenAI model must be specified in config');
    }

    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.sqlService = SQLService.getInstance();
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
  public async sendMessage(options: SendMessageOptions): Promise<ChatResponse> {
    try {
      const messages = this.buildMessages(options);
      return await this.generateResponse(messages);
    } catch (error) {
      console.error('ChatService Error:', error);
      throw error;
    }
  }

  /**
   * Build the messages array for the API request
   */
  private buildMessages(options: SendMessageOptions): ChatMessage[] {
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
      return messages.slice(-this.config.maxContextMessages);
    }

    return messages;
  }

  private calculateCost(promptTokens: number, completionTokens: number): number {
    // For simplicity, we'll use the non-cached rate for input tokens
    const inputCost = promptTokens * this.inputTokenCost;
    const outputCost = completionTokens * this.outputTokenCost;
    return Number((inputCost + outputCost).toFixed(6));
  }

  private serializeResult(result: any): any {
    return JSON.parse(JSON.stringify(result, (_, value) => 
      typeof value === 'bigint' ? value.toString() : value
    ));
  }

  private async executeSQL(sql: string, values: any[] = []): Promise<any> {
    return this.sqlService.execute({
      sql,
      values: values.reduce((acc, val, idx) => ({ ...acc, [`param${idx}`]: val }), {})
    });
  }

  private processSQL(sql: string, userMessage: string): { sql: string; params: any[] } {
    // Extract values from user message
    const values = this.extractValuesFromMessage(userMessage);
    const params: any[] = [];
    
    // Replace :param with ? and collect parameters in order
    const processedSQL = sql.replace(/:([\w]+)/g, (match, param) => {
      if (values[param]) {
        params.push(values[param]);
        return '?';
      }
      return match;
    });

    return { sql: processedSQL, params };
  }

  private extractValuesFromMessage(message: string): Record<string, any> {
    const values: Record<string, any> = {
      id: uuidv4(),
      createdAt: "strftime('%Y-%m-%d %H:%M:%f', 'now')",
      updatedAt: "strftime('%Y-%m-%d %H:%M:%f', 'now')"
    };

    // Extract email if present
    const emailMatch = message.match(/\b[\w\.-]+@[\w\.-]+\.\w+\b/);
    if (emailMatch) {
      values.email = emailMatch[0];
    }

    // Extract name if present (assuming name is between quotes or is a word sequence)
    const nameMatch = message.match(/"([^"]+)"|'([^']+)'|\b([A-Z][a-z]+ [A-Z][a-z]+)\b/);
    if (nameMatch) {
      values.name = nameMatch[1] || nameMatch[2] || nameMatch[3];
    }

    return values;
  }

  private getUserFriendlyError(error: any): string {
    if (error.message.includes('Invalid `prisma.$queryRaw()` invocation')) {
      return 'Sorry, I couldn\'t process that database operation. Please check your input and try again.';
    }
    if (error.message.includes('No response received from OpenAI')) {
      return 'I\'m having trouble understanding your request. Could you rephrase it?';
    }
    if (error.message.includes('Invalid SQL response format')) {
      return 'I couldn\'t generate a valid database query. Please try again with a clearer request.';
    }
    return 'An error occurred while processing your request. Please try again.';
  }

  /**
   * Generate a SQL query from natural language
   */
  public async generateSQLQuery(request: string): Promise<SQLResponse> {
    try {
      console.log('\n=== SQL Query Generation Start ===');
      console.log('Request:', request);

      // Get database schema
      const prisma = new PrismaClient();
      const schema = await prisma.$queryRaw`
        SELECT name, sql FROM sqlite_master 
        WHERE type='table' AND name NOT LIKE 'sqlite_%'
        ORDER BY name;
      `;

      console.log('\nDatabase Schema:');
      console.log(JSON.stringify(schema, null, 2));

      const messages = [
        { role: 'system', content: SQL_PROMPTS.SYSTEM_PROMPT },
        { 
          role: 'user', 
          content: SQL_PROMPTS.QUERY_PROMPT
            .replace('{schema}', JSON.stringify(schema, null, 2))
            .replace('{request}', request)
        }
      ];

      console.log('\nPrompt Sent to OpenAI:');
      console.log(JSON.stringify(messages, null, 2));

      const completion = await this.openai.chat.completions.create({
        model: this.config.model,
        messages: messages as any,
        stream: false,
        max_tokens: this.config.maxResponseTokens,
      });

      const response = completion.choices[0]?.message?.content || '';
      
      console.log('\nRaw OpenAI Response:');
      console.log(response);

      try {
        const sqlResponse = JSON.parse(response) as SQLResponse;
        console.log('\nParsed SQL Response:');
        console.log(JSON.stringify(sqlResponse, null, 2));
        return sqlResponse;
      } catch (error) {
        console.error('\nFailed to parse response:', error);
        return {
          type: 'operation',
          response: {
            primary_table: '',
            secondary_table: null,
            operation: 'select',
            status: 'error',
            summary: 'Failed to parse response',
            sql: ''
          }
        };
      }
    } catch (error) {
      console.error('\nGeneration Error:', error);
      return {
        type: 'operation',
        response: {
          primary_table: '',
          secondary_table: null,
          operation: 'select',
          status: 'error',
          summary: error instanceof Error ? error.message : 'Unknown error occurred',
          sql: ''
        }
      };
    } finally {
      console.log('\n=== SQL Query Generation End ===\n');
    }
  }

  /**
   * Generate a natural language summary of the SQL result
   */
  public async generateSummary(result: any, sqlResponse: SQLResponse['response']): Promise<string> {
    try {
      console.log('\n=== Summary Generation Start ===');
      console.log('SQL:', sqlResponse.sql);
      console.log('Result:', JSON.stringify(result, null, 2));

      const messages = [
        { role: 'system', content: 'You are a database expert. Explain query results in clear, natural language.' },
        { 
          role: 'user', 
          content: SQL_PROMPTS.SUMMARY_PROMPT
            .replace('{sql}', sqlResponse.sql)
            .replace('{result}', JSON.stringify(result, null, 2))
        }
      ];

      console.log('\nPrompt Sent to OpenAI:');
      console.log(JSON.stringify(messages, null, 2));

      const completion = await this.openai.chat.completions.create({
        model: this.config.model,
        messages: messages as any,
        stream: false,
        max_tokens: this.config.maxResponseTokens,
      });

      const summary = completion.choices[0]?.message?.content || 'No summary available';
      console.log('\nGenerated Summary:');
      console.log(summary);
      return summary;
    } catch (error) {
      console.error('\nSummary Generation Error:', error);
      return 'Failed to generate summary';
    } finally {
      console.log('\n=== Summary Generation End ===\n');
    }
  }

  private async getDatabaseSchema(): Promise<any> {
    return this.sqlService.getSchema();
  }

  private prismaTypeToSQLite(prismaType: string): string {
    const typeMap: Record<string, string> = {
      'String': 'TEXT',
      'Int': 'INTEGER',
      'Float': 'REAL',
      'Boolean': 'INTEGER',
      'DateTime': 'TEXT',
      'BigInt': 'INTEGER',
      'Decimal': 'REAL',
      'Json': 'TEXT',
      'Bytes': 'BLOB'
    };

    return typeMap[prismaType] || 'TEXT';
  }

  private parseAttributes(attributes: string[]): string {
    const constraints: string[] = [];

    attributes.forEach(attr => {
      if (attr === '@id') constraints.push('PRIMARY KEY');
      if (attr === '@unique') constraints.push('UNIQUE');
      if (attr === '@default(cuid())') constraints.push('DEFAULT (uuid())');
      if (attr === '@default(now())') constraints.push("DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now'))");
      if (attr === '@updatedAt') constraints.push("DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now'))");
    });

    return constraints.length ? ` ${constraints.join(' ')}` : '';
  }

  private formatSchemaForPrompt(schema: SchemaTable[]): string {
    return JSON.stringify(schema, null, 2)
      .replace(/\\n/g, '\n')
      .replace(/\\"/g, '"');
  }

  private parseSQLResponse(rawResponse: string): SQLResponse {
    const response = JSON.parse(rawResponse);
    return response as SQLResponse;
  }

  private async generateResponse(messages: ChatMessage[]): Promise<ChatResponse> {
    try {
      logger.info('Starting response generation', { messages });
      const schema = await this.getDatabaseSchema();
      
      // Build system prompt with properly formatted schema
      const systemPrompt = SQL_PROMPTS.SYSTEM_PROMPT.replace('{schema}', this.formatSchemaForPrompt(schema));
      const prompt = [
        { role: 'system' as const, content: systemPrompt },
        { role: 'user' as const, content: messages[messages.length - 1].content }
      ];

      // Log the prompt being sent to OpenAI
      logger.info('Sending prompt to OpenAI', {
        model: this.config.model,
        messages: prompt,
        temperature: 0
      });

      // Get initial response from LLM
      const response = await this.openai.chat.completions.create({
        model: this.config.model,
        messages: prompt,
        temperature: 0,
      });

      // Log the raw response from OpenAI
      logger.info('Received response from OpenAI', {
        usage: response.usage,
        content: JSON.parse(response.choices[0]?.message?.content || '{}')
      });

      const rawResponse = response.choices[0]?.message?.content;
      if (!rawResponse) {
        throw new Error('No response received from OpenAI');
      }

      const sqlResponse = this.parseSQLResponse(rawResponse);
      logger.debug('Parsed SQL response', { sqlResponse });

      // For schema queries, return immediately
      if (sqlResponse.type === 'schema' || !sqlResponse.response.sql) {
        return {
          content: sqlResponse.response.summary,
          usage: response.usage,
          cost: this.calculateCost(response.usage?.prompt_tokens || 0, response.usage?.completion_tokens || 0),
          isComplete: true
        };
      }

      // For operation queries, execute SQL and summarize
      try {
        const result = await this.executeSQL(sqlResponse.response.sql, sqlResponse.response.values || []);

        // Log the summary prompt
        const summaryPrompt = [
          { role: 'system' as const, content: 'You are a database expert. Explain query results in clear, natural language.' },
          { 
            role: 'user' as const, 
            content: SQL_PROMPTS.SUMMARY_PROMPT
              .replace('{sql}', sqlResponse.response.sql)
              .replace('{result}', JSON.stringify(result, (_, value) => 
                typeof value === 'bigint' ? value.toString() : value
              , 2))
          }
        ];

        logger.info('Sending summary prompt to OpenAI', {
          model: this.config.model,
          messages: summaryPrompt,
          temperature: 0
        });

        // Generate summary
        const summaryResponse = await this.openai.chat.completions.create({
          model: this.config.model,
          messages: summaryPrompt,
          temperature: 0,
        });

        // Log the summary response
        logger.info('Received summary response from OpenAI', {
          usage: summaryResponse.usage,
          content: summaryResponse.choices[0]?.message?.content
        });

        const summary = summaryResponse.choices[0]?.message?.content || 'No summary available';

        // Calculate total usage and cost
        const totalUsage = {
          prompt_tokens: (response.usage?.prompt_tokens || 0) + (summaryResponse.usage?.prompt_tokens || 0),
          completion_tokens: (response.usage?.completion_tokens || 0) + (summaryResponse.usage?.completion_tokens || 0),
          total_tokens: (response.usage?.total_tokens || 0) + (summaryResponse.usage?.total_tokens || 0)
        };

        const totalCost = this.calculateCost(totalUsage.prompt_tokens, totalUsage.completion_tokens);

        return {
          content: `${sqlResponse.response.summary}\n\nResult: ${summary}`,
          usage: totalUsage,
          cost: totalCost,
          isComplete: true
        };
      } catch (error) {
        logger.error('SQL execution failed', error);
        return {
          content: `I understand what you want to do, but I encountered an error: ${this.getUserFriendlyError(error)}`,
          usage: response.usage,
          cost: this.calculateCost(response.usage?.prompt_tokens || 0, response.usage?.completion_tokens || 0),
          isComplete: true
        };
      }
    } catch (error: unknown) {
      logger.error('Failed to process response', error);
      return {
        content: this.getUserFriendlyError(error),
        usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
        cost: 0,
        isComplete: true
      };
    }
  }
} 