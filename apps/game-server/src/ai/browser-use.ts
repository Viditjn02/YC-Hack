import { env } from '../env.js';
import { log } from '../logger.js';

const BASE_URL = 'https://api.browser-use.com/api/v1';

interface BrowserTaskResponse {
  id: string;
  status: 'created' | 'running' | 'paused' | 'finished' | 'failed' | 'stopped';
  live_url: string;
  output?: string;
  steps?: Array<{
    step_number: number;
    description: string;
    status: string;
    timestamp: string;
  }>;
}

interface RunTaskOptions {
  save_browser_data?: boolean;
}

async function apiRequest<T>(method: string, path: string, body?: unknown): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      'Authorization': `Bearer ${env.BROWSER_USE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '(no body)');
    throw new Error(`browser-use API ${method} ${path} failed: ${res.status} ${text}`);
  }

  return res.json() as Promise<T>;
}

export async function runTask(task: string, options?: RunTaskOptions): Promise<BrowserTaskResponse> {
  log.info(`[browser-use] Starting task: ${task.slice(0, 100)}...`);
  return apiRequest<BrowserTaskResponse>('POST', '/run-task', {
    task,
    ...options,
  });
}

export async function getTaskStatus(taskId: string): Promise<BrowserTaskResponse> {
  return apiRequest<BrowserTaskResponse>('GET', `/task/${taskId}/status`);
}

export async function stopTask(taskId: string): Promise<void> {
  await apiRequest<unknown>('PUT', `/stop-task/${taskId}`);
  log.info(`[browser-use] Stopped task ${taskId}`);
}

export async function pauseTask(taskId: string): Promise<void> {
  await apiRequest<unknown>('PUT', `/pause-task/${taskId}`);
  log.info(`[browser-use] Paused task ${taskId}`);
}

export async function resumeTask(taskId: string): Promise<void> {
  await apiRequest<unknown>('PUT', `/resume-task/${taskId}`);
  log.info(`[browser-use] Resumed task ${taskId}`);
}
