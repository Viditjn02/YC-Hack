/** Floating bottom-right workspace tab bar — always visible so users know their workspaces & shortcuts. */
'use client';

import { useEffect, useState } from 'react';
import { useChatStore } from '@/stores/chatStore';

/** Detect macOS/iOS for ⌘ vs Ctrl display. */
function useModKey() {
  const [mod, setMod] = useState('Ctrl');
  useEffect(() => {
    if (/(Mac|iPhone|iPad|iPod)/i.test(navigator.platform)) setMod('⌘');
  }, []);
  return mod;
}

export function WorkspaceBar() {
  const workspaceTabs = useChatStore((s) => s.workspaceTabs);
  const activeWorkspaceId = useChatStore((s) => s.activeWorkspaceId);
  const switchWorkspace = useChatStore((s) => s.switchWorkspace);
  const newConversation = useChatStore((s) => s.newConversation);
  const chatPanelOpen = useChatStore((s) => s.chatPanelOpen);
  const mod = useModKey();

  // Nothing to show if no workspaces exist
  if (workspaceTabs.length === 0) return null;

  // Hide when chat panel is open (tabs already visible inside it)
  if (chatPanelOpen) return null;

  function handleTabClick(workspaceId: string | null) {
    if (workspaceId === null) {
      newConversation();
      useChatStore.setState({ chatPanelOpen: true, activeAgent: 'receptionist' });
    } else {
      switchWorkspace(workspaceId);
      // Just open the panel — workspace:snapshot will set the active agent
      useChatStore.setState({ chatPanelOpen: true });
    }
  }

  function truncate(text: string, maxLen = 18): string {
    return text.length > maxLen ? text.slice(0, maxLen) + '\u2026' : text;
  }

  return (
    <div className="fixed bottom-4 right-4 z-40 pointer-events-none">
      <div className="pointer-events-auto flex flex-col items-end gap-1">
        {/* Workspace tabs */}
        {workspaceTabs.map((tab, idx) => (
          <button
            key={tab.id}
            onClick={() => handleTabClick(tab.id)}
            className={`group flex items-center gap-2 pl-2.5 pr-2 py-1.5 rounded-lg text-xs
              transition-all duration-150 backdrop-blur-sm border
              ${activeWorkspaceId === tab.id
                ? 'bg-white/12 border-white/15 text-white shadow-lg shadow-black/20'
                : 'bg-black/40 border-white/8 text-white/50 hover:bg-black/50 hover:text-white/70 hover:border-white/12'
              }`}
          >
            {/* Status dot */}
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
              tab.status === 'completed' ? 'bg-emerald-400' : 'bg-blue-400 animate-pulse'
            }`} />

            {/* Task summary */}
            <span className="truncate max-w-[10rem] sm:max-w-[14rem]">
              {truncate(tab.taskSummary)}
            </span>

            {/* Keyboard shortcut badge */}
            {idx < 9 && (
              <kbd className="ml-0.5 shrink-0 px-1 py-0.5 rounded bg-white/8 border border-white/10
                text-[10px] font-mono text-white/40 group-hover:text-white/60 transition-colors leading-none">
                {mod}{idx + 1}
              </kbd>
            )}
          </button>
        ))}

        {/* New conversation shortcut */}
        <button
          onClick={() => handleTabClick(null)}
          className={`group flex items-center gap-2 pl-2.5 pr-2 py-1.5 rounded-lg text-xs
            transition-all duration-150 backdrop-blur-sm border
            ${activeWorkspaceId === null
              ? 'bg-indigo-500/15 border-indigo-400/20 text-indigo-300'
              : 'bg-black/40 border-white/8 text-white/40 hover:bg-black/50 hover:text-white/60 hover:border-white/12'
            }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3 shrink-0">
            <path d="M8.75 3.75a.75.75 0 0 0-1.5 0v3.5h-3.5a.75.75 0 0 0 0 1.5h3.5v3.5a.75.75 0 0 0 1.5 0v-3.5h3.5a.75.75 0 0 0 0-1.5h-3.5v-3.5Z" />
          </svg>
          <span>New task</span>
          <kbd className="ml-0.5 shrink-0 px-1 py-0.5 rounded bg-white/8 border border-white/10
            text-[10px] font-mono text-white/40 group-hover:text-white/60 transition-colors leading-none">
            {mod}`
          </kbd>
        </button>
      </div>
    </div>
  );
}
