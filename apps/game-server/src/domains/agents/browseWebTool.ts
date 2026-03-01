import { tool } from 'ai';
import { z } from 'zod';
import type { WebSocket } from 'ws';
import * as browserUse from '../../ai/browser-use.js';
import { log } from '../../logger.js';
import type { AgentRepository } from './repository.js';
import type { PlayerService } from '../players/service.js';

const POLL_INTERVAL_MS = 3_000;
const MAX_POLL_TIME_MS = 10 * 60 * 1_000; // 10 minutes

interface BrowseWebToolDeps {
  agentId: string;
  agentName: string;
  agentPersonality: string;
  workspaceId: string;
  agentRepo: AgentRepository;
  playerService: PlayerService;
  ws: WebSocket;
}

/**
 * Creates a `browse_web` tool that dynamic agents can call to autonomously
 * browse the web via browser-use Cloud API. The LLM decides when to use it.
 *
 * Sends live browser URL via embed panel and relays step progress via
 * toolExecution events. Returns the browser-use output when done.
 */
export function createBrowseWebTool(deps: BrowseWebToolDeps) {
  const { agentId, agentName, agentPersonality, workspaceId, agentRepo, playerService, ws } = deps;

  function sendBrowserStatus(active: boolean, liveUrl?: string) {
    playerService.send(ws, {
      type: 'agent:browserUseStatus',
      payload: { agentId, agentName, active, ...(liveUrl ? { liveUrl } : {}) },
    });
  }

  return {
    browse_web: tool({
      description:
        'Opens a real browser to search the web and research topics. ' +
        'Use this for web search tasks: researching people, companies, topics, visiting URLs, ' +
        'gathering information, checking profiles, or looking up data. ' +
        'Do NOT use for actions you already have tools for (email, calendar, etc). ' +
        'Provide a clear, detailed description of what to search for or which sites to visit.',
      inputSchema: z.object({
        task: z.string().describe('A detailed description of what to do in the browser. Be specific about what websites to visit, what information to find, or what actions to take.'),
      }),
      execute: async ({ task }: { task: string }) => {
        const taskPrompt = `You are ${agentName}, a ${agentPersonality}. Complete this task using the browser:\n\n${task}`;

        log.info(`[browse_web] ======= BROWSER-USE STARTING =======`);
        log.info(`[browse_web] Agent: ${agentName} | Task: ${task.slice(0, 200)}`);

        try {
          const browserTask = await browserUse.runTask(taskPrompt);
          log.info(`[browse_web] Task created: id=${browserTask.id} status=${browserTask.status} live_url=${browserTask.live_url ?? 'none'}`);
          agentRepo.setBrowserTask(agentId, browserTask.id);

          sendBrowserStatus(true, browserTask.live_url);

          if (browserTask.live_url) {
            playerService.send(ws, {
              type: 'workspace:embedPanel',
              payload: {
                workspaceId,
                embed: {
                  id: `browser-${browserTask.id}`,
                  url: browserTask.live_url,
                  title: `${agentName}'s Browser`,
                  type: 'other',
                  agentId,
                  agentName,
                },
              },
            });
          }

          const output = await pollBrowserTask(browserTask.id, agentId, agentName, agentRepo, playerService, ws);

          log.info(`[browse_web] ======= BROWSER-USE FINISHED =======`);
          log.info(`[browse_web] Agent: ${agentName} | Output: ${(output ?? '').slice(0, 200)}`);
          sendBrowserStatus(false);

          return output;
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error(`[browse_web] ======= BROWSER-USE ERROR ======= Agent: ${agentName} | ${errMsg}`);
          agentRepo.clearBrowserTask(agentId);
          sendBrowserStatus(false);
          return `Error: Browser task failed — ${errMsg}`;
        }
      },
    }),
  };
}

/**
 * Poll a browser-use task until completion, relaying step progress to the frontend.
 */
function pollBrowserTask(
  taskId: string,
  agentId: string,
  agentName: string,
  agentRepo: AgentRepository,
  playerService: PlayerService,
  ws: WebSocket,
): Promise<string> {
  return new Promise((resolve) => {
    const startTime = Date.now();
    let lastStepCount = 0;

    const poll = async () => {
      try {
        const status = await browserUse.getTaskStatus(taskId);
        log.debug(`[browse_web] Poll ${agentName}: status=${status.status} steps=${status.steps?.length ?? 0}`);

        if (status.steps && status.steps.length > lastStepCount) {
          for (let i = lastStepCount; i < status.steps.length; i++) {
            const step = status.steps[i];
            log.info(`[browse_web] ${agentName} step ${step.step_number}: ${step.description?.slice(0, 100)}`);
            playerService.send(ws, {
              type: 'agent:toolExecution',
              payload: {
                agentId,
                toolName: `browser_step_${step.step_number}`,
                status: step.status === 'failed' ? 'failed' : 'completed',
                result: step.description,
              },
            });
          }
          lastStepCount = status.steps.length;
        }

        if (status.status === 'finished') {
          agentRepo.clearBrowserTask(agentId);
          log.info(`[browse_web] ${agentName} task finished successfully`);
          resolve(status.output ?? '(no output)');
          return;
        }

        if (status.status === 'failed' || status.status === 'stopped') {
          agentRepo.clearBrowserTask(agentId);
          const errMsg = `Browser task ${status.status}: ${status.output ?? 'unknown error'}`;
          log.warn(`[browse_web] ${agentName}: ${errMsg}`);
          resolve(`Error: ${errMsg}`);
          return;
        }

        if (Date.now() - startTime > MAX_POLL_TIME_MS) {
          log.warn(`[browse_web] ${agentName} task ${taskId} timed out after ${MAX_POLL_TIME_MS / 1000}s`);
          browserUse.stopTask(taskId).catch(() => {});
          agentRepo.clearBrowserTask(agentId);
          resolve('Error: Browser task timed out after 10 minutes');
          return;
        }

        setTimeout(poll, POLL_INTERVAL_MS);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        log.error(`[browse_web] ${agentName} poll error: ${errMsg}`);
        agentRepo.clearBrowserTask(agentId);
        resolve(`Error: Browser poll failed — ${errMsg}`);
      }
    };

    setTimeout(poll, POLL_INTERVAL_MS);
  });
}
