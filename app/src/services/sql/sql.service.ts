import { PrismaClient } from '@prisma/client';
import { SQLQueryResponse } from '../chat/prompts/sql-prompts';

export class SQLService {
  private static instance: SQLService;
  private prisma: PrismaClient;

  private constructor() {
    this.prisma = new PrismaClient();
  }

  public static getInstance(): SQLService {
    if (!SQLService.instance) {
      SQLService.instance = new SQLService();
    }
    return SQLService.instance;
  }

  /**
   * Execute a SQL query based on the structured response
   */
  public async executeQuery(queryResponse: SQLQueryResponse, params: Record<string, any> = {}) {
    try {
      // Validate the query response
      if (queryResponse.status === 'error') {
        throw new Error('Invalid query response');
      }

      // Replace parameters in the SQL query
      let sql = queryResponse.sql;
      Object.entries(params).forEach(([key, value]) => {
        sql = sql.replace(`:${key}`, typeof value === 'string' ? `'${value}'` : value);
      });

      // Execute the query using Prisma's $queryRaw
      const result = await this.prisma.$queryRaw`${sql}`;

      return {
        success: true,
        data: result,
        operation: queryResponse.operation,
        summary: queryResponse.summary
      };
    } catch (error) {
      console.error('SQL Execution Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        operation: queryResponse.operation,
        summary: 'Failed to execute query'
      };
    }
  }

  /**
   * Close the Prisma connection
   */
  public async disconnect() {
    await this.prisma.$disconnect();
  }
} 