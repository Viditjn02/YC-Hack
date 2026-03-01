import { tool } from 'ai';
import { z } from 'zod';
import type { WebSocket } from 'ws';
import * as browserUse from '../../ai/browser-use.js';
import { log } from '../../logger.js';
import type { AgentRepository } from './repository.js';
import type { PlayerService } from '../players/service.js';

const POLL_INTERVAL_MS = 2_000;
// const QUICK_TIMEOUT_MS = 10_000;

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
 * browse the web via browser-use Cloud API v2.
 *
 * Sends live browser URL via embed panel and polls task status.
 * Returns the browser-use output when done.
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
        'Provide a clear, detailed description of what to search for or which sites to visit.',
      inputSchema: z.object({
        task: z.string().describe('A detailed description of what to do in the browser. Be specific about what websites to visit, what information to find, or what actions to take.'),
      }),
      execute: async ({ task }: { task: string }) => {
        const taskPrompt = `You are ${agentName}, a ${agentPersonality}. Complete this task using the browser:\n\n${task}`;

        log.info(`[browse_web] ======= BROWSER-USE STARTING =======`);
        log.info(`[browse_web] Agent: ${agentName} | Task: ${task.slice(0, 200)}`);

        try {
          const result = await browserUse.runTask(taskPrompt);
          agentRepo.setBrowserTask(agentId, result.taskId);

          sendBrowserStatus(true, result.liveUrl);

          // If liveUrl wasn't ready yet, keep trying in the background
          if (!result.liveUrl && result.sessionId) {
            browserUse.fetchLiveUrl(result.sessionId, 8, 2000).then((url) => {
              if (url) {
                sendBrowserStatus(true, url);
                playerService.send(ws, {
                  type: 'workspace:embedPanel',
                  payload: {
                    workspaceId,
                    embed: {
                      id: `browser-${result.taskId}`,
                      url,
                      title: `${agentName}'s Browser`,
                      type: 'other',
                      agentId,
                      agentName,
                    },
                  },
                });
              }
            });
          }

          if (result.liveUrl) {
            playerService.send(ws, {
              type: 'workspace:embedPanel',
              payload: {
                workspaceId,
                embed: {
                  id: `browser-${result.taskId}`,
                  url: result.liveUrl,
                  title: `${agentName}'s Browser`,
                  type: 'other',
                  agentId,
                  agentName,
                },
              },
            });
          }

          const output = await pollBrowserTask(result.taskId, agentId, agentName, agentRepo);

          log.info(`[browse_web] ======= BROWSER-USE FINISHED =======`);
          log.info(`[browse_web] Agent: ${agentName} | Output: ${(output ?? '').slice(0, 200)}`);
          sendBrowserStatus(false);

          return output;
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error(`[browse_web] ======= BROWSER-USE ERROR ======= Agent: ${agentName} | ${errMsg}`);
          agentRepo.clearBrowserTask(agentId);
          sendBrowserStatus(false);
          return `Error: Browser task failed — ${errMsg}. Use your Composio search tools (COMPOSIO_SEARCH_TOOLS) as a fallback to complete this research task.`;
        }
      },
    }),
  };
}

/**
 * Poll a browser-use task with a 10s timeout.
 * If not finished in time, stop the task and tell the LLM to use Composio fallback.
 */
function pollBrowserTask(
  taskId: string,
  agentId: string,
  agentName: string,
  agentRepo: AgentRepository,
): Promise<string> {
  return new Promise((resolve) => {
    const startTime = Date.now();

    const poll = async () => {
      try {
        const status = await browserUse.getTaskStatus(taskId);
        const elapsed = Math.round((Date.now() - startTime) / 1000);
        log.debug(`[browse_web] Poll ${agentName}: status=${status.status} elapsed=${elapsed}s`);

        if (status.status === 'finished') {
          agentRepo.clearBrowserTask(agentId);
          log.info(`[browse_web] ${agentName} task finished in ${elapsed}s (success=${status.isSuccess})`);
          resolve(status.output ?? '(no output)');
          return;
        }

        if (status.status === 'stopped') {
          agentRepo.clearBrowserTask(agentId);
          log.warn(`[browse_web] ${agentName}: task stopped after ${elapsed}s`);
          resolve(`Error: Browser task stopped. Use your Composio search tools (COMPOSIO_SEARCH_TOOLS) as a fallback.`);
          return;
        }

        // if (Date.now() - startTime > QUICK_TIMEOUT_MS) {
        //   log.warn(`[browse_web] ${agentName} task ${taskId} timed out after ${QUICK_TIMEOUT_MS / 1000}s — stopping`);
        //   browserUse.stopTask(taskId).catch(() => {});
        //   agentRepo.clearBrowserTask(agentId);
        //   resolve(`Browser task is taking too long (>${QUICK_TIMEOUT_MS / 1000}s). Use your Composio search tools (COMPOSIO_SEARCH_TOOLS, COMPOSIO_MULTI_EXECUTE_TOOL) as a fallback to complete this research task instead.`);
        //   return;
        // }

        setTimeout(poll, POLL_INTERVAL_MS);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        log.error(`[browse_web] ${agentName} poll error: ${errMsg}`);
        agentRepo.clearBrowserTask(agentId);
        resolve(`Error: Browser poll failed — ${errMsg}. Use your Composio search tools as a fallback.`);
      }
    };

    setTimeout(poll, POLL_INTERVAL_MS);
  });
}
