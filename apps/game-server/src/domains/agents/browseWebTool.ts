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

  return {
    browse_web: tool({
      description:
        'YOUR PRIMARY RESEARCH TOOL. Opens a real browser to autonomously navigate the web. ' +
        'Use this FIRST for ANY task involving research, looking things up, finding information, ' +
        'visiting websites, checking profiles, or gathering data. ' +
        'Provide a clear, detailed task description. The browser will navigate sites, click links, ' +
        'fill forms, and extract information. Returns the result when done. ' +
        'ALWAYS prefer this over relying on your training data — the web has current information.',
      inputSchema: z.object({
        task: z.string().describe('A detailed description of what to do in the browser. Be specific about what websites to visit, what information to find, or what actions to take.'),
      }),
      execute: async ({ task }: { task: string }) => {
        const taskPrompt = `You are ${agentName}, a ${agentPersonality}. Complete this task using the browser:\n\n${task}`;

        log.info(`[browse_web] ======= BROWSER-USE STARTING =======`);
        log.info(`[browse_web] Agent: ${agentName} | Task: ${task.slice(0, 200)}`);

        // Launch browser-use task
        const browserTask = await browserUse.runTask(taskPrompt);
        agentRepo.setBrowserTask(agentId, browserTask.id);

        // Notify frontend that browser-use is active
        playerService.send(ws, {
          type: 'agent:browserUseStatus',
          payload: {
            agentId,
            agentName,
            active: true,
            liveUrl: browserTask.live_url,
          },
        });

        // Send live browser URL via embed panel
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

        // Poll until completion
        const output = await pollBrowserTask(browserTask.id, agentId, agentName, agentRepo, playerService, ws);

        log.info(`[browse_web] ======= BROWSER-USE FINISHED =======`);
        log.info(`[browse_web] Agent: ${agentName} | Output: ${(output ?? '').slice(0, 200)}`);

        // Notify frontend that browser-use has ended
        playerService.send(ws, {
          type: 'agent:browserUseStatus',
          payload: {
            agentId,
            agentName,
            active: false,
          },
        });

        return output;
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
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    let lastStepCount = 0;

    const poll = async () => {
      try {
        const status = await browserUse.getTaskStatus(taskId);

        // Relay new steps as tool execution events
        if (status.steps && status.steps.length > lastStepCount) {
          for (let i = lastStepCount; i < status.steps.length; i++) {
            const step = status.steps[i];
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
          log.info(`[browse_web] ${agentName} task finished`);
          resolve(status.output ?? '(no output)');
          return;
        }

        if (status.status === 'failed' || status.status === 'stopped') {
          agentRepo.clearBrowserTask(agentId);
          const errMsg = `Browser task ${status.status}: ${status.output ?? 'unknown error'}`;
          log.warn(`[browse_web] ${agentName}: ${errMsg}`);
          resolve(`Error: ${errMsg}`); // resolve with error text so LLM can handle it
          return;
        }

        // Timeout check
        if (Date.now() - startTime > MAX_POLL_TIME_MS) {
          log.warn(`[browse_web] ${agentName} task ${taskId} timed out after ${MAX_POLL_TIME_MS / 1000}s`);
          browserUse.stopTask(taskId).catch(() => {});
          agentRepo.clearBrowserTask(agentId);
          resolve('Error: Browser task timed out after 10 minutes');
          return;
        }

        setTimeout(poll, POLL_INTERVAL_MS);
      } catch (err) {
        agentRepo.clearBrowserTask(agentId);
        reject(err);
      }
    };

    setTimeout(poll, POLL_INTERVAL_MS);
  });
}
