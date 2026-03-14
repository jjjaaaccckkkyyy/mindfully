import { describe, it, expect, vi } from 'vitest';
import { createCompactSessionTool } from '../../../src/tools/builtin/compact-session.js';
import type { ToolContext } from '../../../src/tools/index.js';

describe('compact_session tool', () => {
  it('returns an error when context.compact is not provided', async () => {
    const tool = createCompactSessionTool(undefined);
    const result = JSON.parse(await tool.invoke({})) as {
      success: boolean;
      error: string;
    };
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not available/i);
  });

  it('returns an error when context is provided but compact handler is absent', async () => {
    const context: ToolContext = { workspaceDir: '/tmp' };
    const tool = createCompactSessionTool(context);
    const result = JSON.parse(await tool.invoke({})) as {
      success: boolean;
      error: string;
    };
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not available/i);
  });

  it('calls context.compact() and returns the correct shape', async () => {
    const compactFn = vi.fn().mockResolvedValue({
      summary: 'The user asked to read a file and it was done.',
      messageCount: 6,
    });
    const context: ToolContext = {
      workspaceDir: '/tmp',
      sessionId: 'abc123',
      compact: compactFn,
    };
    const tool = createCompactSessionTool(context);

    const result = JSON.parse(await tool.invoke({})) as {
      success: boolean;
      messageCount: number;
      summaryLength: number;
      summary: string;
      message: string;
    };

    expect(compactFn).toHaveBeenCalledOnce();
    expect(result.success).toBe(true);
    expect(result.messageCount).toBe(6);
    expect(result.summary).toBe('The user asked to read a file and it was done.');
    expect(result.summaryLength).toBe(result.summary.length);
    expect(result.message).toContain('6 messages');
  });

  it('accepts an optional reason field without error', async () => {
    const compactFn = vi.fn().mockResolvedValue({
      summary: 'Brief summary.',
      messageCount: 2,
    });
    const context: ToolContext = { compact: compactFn };
    const tool = createCompactSessionTool(context);

    const result = JSON.parse(await tool.invoke({ reason: 'context getting long' })) as {
      success: boolean;
    };

    expect(compactFn).toHaveBeenCalledOnce();
    expect(result.success).toBe(true);
  });

  it('propagates errors thrown by context.compact()', async () => {
    const context: ToolContext = {
      compact: vi.fn().mockRejectedValue(new Error('API timeout')),
    };
    const tool = createCompactSessionTool(context);

    await expect(tool.invoke({})).rejects.toThrow('API timeout');
  });
});
