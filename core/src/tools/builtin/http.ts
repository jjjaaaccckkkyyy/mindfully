import { z } from 'zod';
import { createTool, type Tool } from '../index.js';

const PRIVATE_IP_PATTERNS = [
  /^localhost$/i,
  /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,
  /^::1$/,
  /^0\.0\.0\.0$/,
  /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,
  /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/,
  /^192\.168\.\d{1,3}\.\d{1,3}$/,
  /^169\.254\.\d{1,3}\.\d{1,3}$/, // link-local
  /^fc[0-9a-f]{2}:/i,              // IPv6 ULA
  /^fe80:/i,                        // IPv6 link-local
];

function isPrivateHost(hostname: string): boolean {
  return PRIVATE_IP_PATTERNS.some((re) => re.test(hostname));
}

const HttpSchema = z.object({
  url: z.string().describe('The URL to request'),
  method: z
    .enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'])
    .default('GET')
    .describe('HTTP method (default: GET)'),
  headers: z.record(z.string()).optional().describe('Request headers as key-value pairs'),
  body: z
    .string()
    .optional()
    .describe('Request body string (for POST / PUT / PATCH)'),
  timeout: z
    .number()
    .optional()
    .describe('Request timeout in milliseconds (default: 30000)'),
});

export type HttpInput = z.infer<typeof HttpSchema>;

export function createHttpTool(): Tool {
  return createTool({
    name: 'http',
    description:
      'Make an HTTP request to a URL. Returns status code, headers, and response body as a string. Private/internal IP addresses are blocked.',
    inputSchema: HttpSchema,
    execute: async (input: unknown) => {
      const args = input as HttpInput;

      // Validate & parse URL
      let parsed: URL;
      try {
        parsed = new URL(args.url);
      } catch {
        return { success: false, error: `Invalid URL: ${args.url}` };
      }

      // Block private IPs / localhost
      if (isPrivateHost(parsed.hostname)) {
        return {
          success: false,
          error: `Blocked: requests to private/internal addresses are not allowed (${parsed.hostname})`,
        };
      }

      const timeoutMs = args.timeout ?? 30_000;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(args.url, {
          method: args.method,
          headers: args.headers as Record<string, string> | undefined,
          body:
            args.body !== undefined &&
            ['POST', 'PUT', 'PATCH'].includes(args.method)
              ? args.body
              : undefined,
          signal: controller.signal,
        });

        const body = await response.text();

        // Collect response headers into a plain object
        const headers: Record<string, string> = {};
        response.headers.forEach((value, key) => {
          headers[key] = value;
        });

        return {
          success: true,
          status: response.status,
          statusText: response.statusText,
          headers,
          body,
        };
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          return { success: false, error: `Request timed out after ${timeoutMs}ms` };
        }
        return {
          success: false,
          error: err instanceof Error ? err.message : String(err),
        };
      } finally {
        clearTimeout(timer);
      }
    },
  });
}
