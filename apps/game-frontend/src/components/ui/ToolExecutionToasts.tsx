/** Floating notifications for agent tool executions (email sent, ticket created, etc.) */
'use client';

import { useToolStore } from '@/stores/toolStore';
import { useWorldStore } from '@/stores/worldStore';

function formatToolName(raw: string): string {
  // "GMAIL_SEND_EMAIL" -> "Send Email"
  const parts = raw.split('_');
  return parts
    .slice(1)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

export function ToolExecutionToasts() {
  const toolExecutions = useToolStore((s) => s.toolExecutions);
  const agents = useWorldStore((s) => s.agents);

  if (toolExecutions.length === 0) return null;

  return (
    <div className="fixed top-20 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toolExecutions.map((exec) => {
        const agent = agents.find((a) => a.id === exec.agentId);
        return (
          <div
            key={exec.id}
            className="bg-gray-900/95 backdrop-blur-sm border border-white/10 rounded-xl px-4 py-3 min-w-[280px]
              animate-[fadeIn_0.3s_ease-out]"
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                  exec.status === 'started'
                    ? 'bg-yellow-400 animate-pulse'
                    : exec.status === 'completed'
                      ? 'bg-green-400'
                      : 'bg-red-400'
                }`}
              />
              <div>
                <p className="text-xs font-medium text-white">
                  {agent?.name ?? 'Agent'}{' '}
                  {exec.status === 'started'
                    ? 'is executing'
                    : exec.status === 'completed'
                      ? 'completed'
                      : 'failed'}
                </p>
                <p className="text-[10px] text-white/50 mt-0.5">
                  {formatToolName(exec.toolName)}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
