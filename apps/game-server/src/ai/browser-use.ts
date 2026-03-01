import { env } from '../env.js';
import { log } from '../logger.js';

const BASE_URL = 'https://api.browser-use.com/api/v2';

interface TaskCreatedResponse {
  id: string;
  sessionId: string;
}

interface TaskStatusResponse {
  id: string;
  status: 'created' | 'started' | 'finished' | 'stopped';
  output?: string | null;
  isSuccess?: boolean | null;
  cost?: string | null;
}

interface SessionResponse {
  id: string;
  status: 'active' | 'stopped';
  liveUrl?: string | null;
}

interface TaskStepView {
  number: number;
  memory: string;
  evaluationPreviousGoal: string;
  nextGoal: string;
  url: string;
  actions: string[];
}

interface TaskDetailResponse {
  id: string;
  sessionId: string;
  status: 'created' | 'started' | 'finished' | 'stopped';
  output?: string | null;
  steps: TaskStepView[];
}

export interface BrowserTaskResult {
  taskId: string;
  sessionId: string;
  liveUrl?: string;
}

async function apiRequest<T>(method: string, path: string, body?: unknown): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      'X-Browser-Use-API-Key': env.BROWSER_USE_API_KEY,
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

export async function runTask(task: string): Promise<BrowserTaskResult> {
  log.info(`[browser-use] Creating task: ${task.slice(0, 100)}...`);

  const created = await apiRequest<TaskCreatedResponse>('POST', '/tasks', { task });
  log.info(`[browser-use] Task created: taskId=${created.id} sessionId=${created.sessionId}`);

  let liveUrl: string | undefined;
  try {
    const session = await apiRequest<SessionResponse>('GET', `/sessions/${created.sessionId}`);
    liveUrl = session.liveUrl ?? undefined;
    log.info(`[browser-use] Session live URL: ${liveUrl ?? 'none'}`);
  } catch (err) {
    log.warn(`[browser-use] Failed to fetch session for live URL: ${err instanceof Error ? err.message : err}`);
  }

  return { taskId: created.id, sessionId: created.sessionId, liveUrl };
}

export async function getTaskStatus(taskId: string): Promise<TaskStatusResponse> {
  return apiRequest<TaskStatusResponse>('GET', `/tasks/${taskId}/status`);
}

export async function getTaskDetail(taskId: string): Promise<TaskDetailResponse> {
  return apiRequest<TaskDetailResponse>('GET', `/tasks/${taskId}`);
}

export async function stopTask(taskId: string): Promise<void> {
  await apiRequest<unknown>('PATCH', `/tasks/${taskId}`, { action: 'stop' });
  log.info(`[browser-use] Stopped task ${taskId}`);
}
