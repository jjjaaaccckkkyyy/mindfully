import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

export interface MarkdownStoreConfig {
  baseDir?: string;
}

export class MarkdownStore {
  private baseDir: string;

  constructor(config: MarkdownStoreConfig = {}) {
    this.baseDir = config.baseDir || path.join(os.homedir(), '.mindful', 'memories');
  }

  private getMemoryPath(userId: string, agentId?: string): string {
    const userDir = path.join(this.baseDir, userId);
    return agentId ? path.join(userDir, agentId) : userDir;
  }

  private getMemoryFile(userId: string, agentId?: string, filename = 'memory.md'): string {
    return path.join(this.getMemoryPath(userId, agentId), filename);
  }

  async save(userId: string, content: string, agentId?: string, filename = 'memory.md'): Promise<void> {
    const filePath = this.getMemoryFile(userId, agentId, filename);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content, 'utf-8');
  }

  async load(userId: string, agentId?: string, filename = 'memory.md'): Promise<string> {
    const filePath = this.getMemoryFile(userId, agentId, filename);
    try {
      return await fs.readFile(filePath, 'utf-8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return '';
      }
      throw error;
    }
  }

  async append(userId: string, content: string, agentId?: string, filename = 'memory.md'): Promise<void> {
    const existing = await this.load(userId, agentId, filename);
    const newContent = existing ? `${existing}\n\n${content}` : content;
    await this.save(userId, newContent, agentId, filename);
  }

  async list(userId: string, agentId?: string): Promise<string[]> {
    const dirPath = this.getMemoryPath(userId, agentId);
    try {
      const files = await fs.readdir(dirPath);
      return files.filter((f) => f.endsWith('.md'));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  async delete(userId: string, agentId?: string, filename = 'memory.md'): Promise<void> {
    const filePath = this.getMemoryFile(userId, agentId, filename);
    try {
      await fs.unlink(filePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  async getDailyLogPath(userId: string, agentId: string, date?: Date): Promise<string> {
    const d = date || new Date();
    const dateStr = d.toISOString().split('T')[0];
    return this.getMemoryFile(userId, agentId, `log-${dateStr}.md`);
  }

  async appendToDailyLog(userId: string, agentId: string, content: string, date?: Date): Promise<void> {
    const filePath = await this.getDailyLogPath(userId, agentId, date);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    const timestamp = new Date().toISOString();
    await this.append(userId, `## ${timestamp}\n\n${content}`, agentId, path.basename(filePath));
  }
}
