'use client';

import { useWorldStore } from '@/stores/worldStore';
import { useChatStore } from '@/stores/chatStore';
import { statusColors } from '@/data/agents';

export function ImagineAgentRoster() {
  const agents = useWorldStore((s) => s.agents);
  const activeAgent = useChatStore((s) => s.activeAgent);
  const workspaceTabs = useChatStore((s) => s.workspaceTabs);
  const activeWorkspaceId = useChatStore((s) => s.activeWorkspaceId);
  const openChat = useChatStore((s) => s.openChat);
  const switchWorkspace = useChatStore((s) => s.switchWorkspace);
  const newConversation = useChatStore((s) => s.newConversation);

  // Get agents for the active workspace, or show default agents
  const workspaceAgentIds = activeWorkspaceId
    ? workspaceTabs.find((t) => t.id === activeWorkspaceId)?.agentIds ?? []
    : [];

  const visibleAgents =
    workspaceAgentIds.length > 0
      ? agents.filter((a) => workspaceAgentIds.includes(a.id))
      : agents;

  return (
    <div className="flex items-center gap-1 px-6 pt-2 pb-1 overflow-x-auto">
      {/* New conversation tab */}
      <button
        onClick={newConversation}
        className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-colors cursor-pointer ${
          !activeWorkspaceId && activeAgent === 'receptionist'
            ? 'bg-[#89b4fa]/20 text-[#89b4fa] border border-[#89b4fa]/30'
            : 'bg-white/[0.06] text-white/50 border border-white/[0.06] hover:bg-white/10'
        }`}
      >
        + New
      </button>

      {/* Workspace tabs */}
      {workspaceTabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => switchWorkspace(tab.id)}
          className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-colors cursor-pointer ${
            activeWorkspaceId === tab.id
              ? 'bg-[#89b4fa]/20 text-[#89b4fa] border border-[#89b4fa]/30'
              : 'bg-white/[0.06] text-white/50 border border-white/[0.06] hover:bg-white/10'
          }`}
        >
          {tab.taskSummary.length > 24
            ? tab.taskSummary.slice(0, 24) + '...'
            : tab.taskSummary}
        </button>
      ))}

      {/* Divider */}
      {visibleAgents.length > 0 && (
        <div className="w-px h-4 bg-white/10 mx-1 shrink-0" />
      )}

      {/* Agent pills */}
      {visibleAgents.map((agent) => (
        <button
          key={agent.id}
          onClick={() => openChat(agent.id)}
          className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-colors cursor-pointer ${
            activeAgent === agent.id
              ? 'bg-white/15 text-white border border-white/20'
              : 'bg-white/[0.06] text-white/60 border border-white/[0.06] hover:bg-white/10'
          }`}
        >
          <div
            className="w-1.5 h-1.5 rounded-full shrink-0"
            style={{ backgroundColor: statusColors[agent.status] }}
          />
          {agent.name}
        </button>
      ))}
    </div>
  );
}
