import { PrismaClient, Prisma } from '@prisma/client';
import { logger } from '@/lib/logger';
import { readFileSync } from 'fs';
import { join } from 'path';

interface SchemaTable {
  name: string;
  sql: string;
}

interface SQLExecuteOptions {
  sql: string;
  values?: Record<string, any>;
  params?: any[];
}

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

  private serializeResult(result: any): any {
    return JSON.parse(JSON.stringify(result, (_, value) => 
      typeof value === 'bigint' ? value.toString() : value
    ));
  }

  private processSQL(sql: string, values: Record<string, any> = {}): { sql: string; params: any[] } {
    const params: any[] = [];
    
    // Replace named parameters with ? and collect values in order
    const processedSQL = sql.replace(/\?/g, (match, offset) => {
      const param = Object.values(values)[params.length];
      if (param !== undefined) {
        params.push(param);
        return '?';
      }
      return match;
    });

    return { sql: processedSQL, params };
  }

  public async execute(options: SQLExecuteOptions): Promise<any> {
    try {
      // If values are provided, process the SQL to use them
      const { sql, params } = options.values ? 
        this.processSQL(options.sql, options.values) : 
        { sql: options.sql, params: options.params || [] };

      logger.debug('Executing SQL', { sql, params });

      const result = await this.prisma.$queryRaw(
        Prisma.sql([sql, ...params])
      );
      return this.serializeResult(result);
    } catch (error) {
      logger.error('SQL execution failed', error);
      throw error;
    }
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

  public async getSchema(): Promise<SchemaTable[]> {
    try {
      // Read the schema file
      const schemaPath = join(process.cwd(), 'prisma', 'schema.prisma');
      const schemaContent = readFileSync(schemaPath, 'utf-8');

      // Parse the schema content to extract model definitions
      const models = schemaContent
        .split('\n\n')
        .filter(block => block.trim().startsWith('model'))
        .map(modelBlock => {
          const [modelLine, ...fieldLines] = modelBlock.split('\n');
          const name = modelLine.split(' ')[1];
          
          // Convert Prisma schema to SQL-like format
          const fields = fieldLines
            .filter(line => line.trim() && !line.trim().startsWith('}'))
            .map(line => {
              const [fieldName, type, ...attributes] = line.trim().split(/\s+/);
              const sqlType = this.prismaTypeToSQLite(type);
              const constraints = this.parseAttributes(attributes);
              return `${fieldName} ${sqlType}${constraints}`;
            });

          return {
            name,
            sql: `CREATE TABLE ${name} (\n  ${fields.join(',\n  ')}\n)`
          };
        });

      return models;
    } catch (error) {
      logger.error('Failed to read schema file', error);
      throw new Error('Failed to read database schema');
    }
  }

  public async disconnect() {
    await this.prisma.$disconnect();
  }
} 