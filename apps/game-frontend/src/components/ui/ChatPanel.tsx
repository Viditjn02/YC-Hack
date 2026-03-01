/** Slide-in right panel for chatting with an agent: messages, streaming, suggested prompts, input. */
'use client';

import { useState, useEffect, useRef } from 'react';
import { useWorldStore } from '@/stores/worldStore';
import { useChatStore } from '@/stores/chatStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { Markdown } from '@/components/ui/Markdown';
import { ThinkingIndicator } from '@/components/ui/ThinkingIndicator';
import { AgentAvatar } from '@/components/ui/AgentAvatar';
import { AgentStatusBadge } from '@/components/ui/AgentStatusBadge';
import { useVoiceStore } from '@/stores/voiceStore';
import { toDynamicAgentData } from '@/data/agents';
import { useAuthStore } from '@/stores/authStore';
import { useSettingsStore, type PurchaseMode } from '@/stores/settingsStore';

/** Tab button with keyboard shortcut tooltip on hover. */
function TabWithKbd({ shortcut, onClick, active, className, children }: {
  shortcut?: string;
  onClick: () => void;
  active: boolean;
  className: string;
  children: React.ReactNode;
}) {
  const [showKbd, setShowKbd] = useState(false);
  return (
    <div className="relative shrink-0" onMouseEnter={() => setShowKbd(true)} onMouseLeave={() => setShowKbd(false)}>
      <button
        onClick={onClick}
        className={`group flex items-center gap-1.5 pl-2 pr-2.5 py-1 rounded-md text-[11px] font-medium whitespace-nowrap transition-all ${className}`}
      >
        {children}
      </button>
      {shortcut && showKbd && (
        <div className="absolute left-1/2 -translate-x-1/2 -bottom-7 z-20 pointer-events-none
          px-1.5 py-0.5 rounded bg-gray-800 border border-white/10 shadow-lg
          text-[10px] text-white/70 font-mono whitespace-nowrap">
          {shortcut}
        </div>
      )}
    </div>
  );
}

function TaskTabs() {
  const workspaceTabs = useChatStore((s) => s.workspaceTabs);
  const activeWorkspaceId = useChatStore((s) => s.activeWorkspaceId);
  const switchWorkspace = useChatStore((s) => s.switchWorkspace);
  const newConversation = useChatStore((s) => s.newConversation);
  const archiveWorkspace = useChatStore((s) => s.archiveWorkspace);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [confirmingClose, setConfirmingClose] = useState<string | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  function updateScrollState() {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 1);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }

  useEffect(() => {
    updateScrollState();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', updateScrollState, { passive: true });
    const ro = new ResizeObserver(updateScrollState);
    ro.observe(el);
    return () => { el.removeEventListener('scroll', updateScrollState); ro.disconnect(); };
  }, [workspaceTabs.length]);

  function scroll(dir: 'left' | 'right') {
    scrollRef.current?.scrollBy({ left: dir === 'left' ? -120 : 120, behavior: 'smooth' });
  }

  function handleCloseTab(e: React.MouseEvent, workspaceId: string) {
    e.stopPropagation();
    if (confirmingClose === workspaceId) {
      archiveWorkspace(workspaceId);
      setConfirmingClose(null);
    } else {
      setConfirmingClose(workspaceId);
      setTimeout(() => setConfirmingClose((cur) => cur === workspaceId ? null : cur), 3000);
    }
  }

  function truncate(text: string, maxLen = 20): string {
    return text.length > maxLen ? text.slice(0, maxLen) + '\u2026' : text;
  }

  return (
    <div className="relative flex items-center border-b border-white/10">
      {/* Left fade + arrow */}
      {canScrollLeft && (
        <button
          onClick={() => scroll('left')}
          className="absolute left-0 z-10 h-full w-7 flex items-center justify-center
            bg-gradient-to-r from-gray-950/95 via-gray-950/80 to-transparent
            text-white/50 hover:text-white/80 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
            <path fillRule="evenodd" d="M9.78 4.22a.75.75 0 0 1 0 1.06L7.06 8l2.72 2.72a.75.75 0 1 1-1.06 1.06L5.47 8.53a.75.75 0 0 1 0-1.06l3.25-3.25a.75.75 0 0 1 1.06 0Z" clipRule="evenodd" />
          </svg>
        </button>
      )}

      {/* Scrollable tabs */}
      <div
        ref={scrollRef}
        className="flex items-center gap-1 px-2 py-1.5 overflow-x-auto scroll-smooth
          [&::-webkit-scrollbar]:h-0 [&::-webkit-scrollbar]:w-0 [-ms-overflow-style:none] [scrollbar-width:none]"
      >
        {/* New conversation tab */}
        <TabWithKbd shortcut="Ctrl+`" onClick={newConversation}
          active={activeWorkspaceId === null}
          className={activeWorkspaceId === null
            ? 'bg-indigo-500/20 text-indigo-300 ring-1 ring-indigo-500/30'
            : 'text-white/40 hover:bg-white/5 hover:text-white/60'
          }
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
            <path d="M8.75 3.75a.75.75 0 0 0-1.5 0v3.5h-3.5a.75.75 0 0 0 0 1.5h3.5v3.5a.75.75 0 0 0 1.5 0v-3.5h3.5a.75.75 0 0 0 0-1.5h-3.5v-3.5Z" />
          </svg>
          New
        </TabWithKbd>

        {workspaceTabs.map((tab, idx) => (
          <TabWithKbd key={tab.id} shortcut={idx < 9 ? `Ctrl+${idx + 1}` : undefined}
            onClick={() => switchWorkspace(tab.id)}
            active={activeWorkspaceId === tab.id}
            className={activeWorkspaceId === tab.id
              ? 'bg-white/12 text-white ring-1 ring-white/10'
              : 'text-white/40 hover:bg-white/5 hover:text-white/60'
            }
          >
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
              tab.status === 'completed' ? 'bg-emerald-400' : 'bg-blue-400 animate-pulse'
            }`} />
            <span>{truncate(tab.taskSummary)}</span>
            <span
              onClick={(e) => handleCloseTab(e, tab.id)}
              className={`ml-0.5 w-4 h-4 flex items-center justify-center rounded transition-all text-[10px] leading-none
                ${confirmingClose === tab.id
                  ? 'text-red-400 bg-red-400/20 opacity-100'
                  : 'text-white/20 hover:text-white/60 hover:bg-white/10 opacity-0 group-hover:opacity-100'
                }`}
              title={confirmingClose === tab.id ? 'Click again to archive' : 'Archive workspace'}
            >
              &times;
            </span>
          </TabWithKbd>
        ))}
      </div>

      {/* Right fade + arrow */}
      {canScrollRight && (
        <button
          onClick={() => scroll('right')}
          className="absolute right-0 z-10 h-full w-7 flex items-center justify-center
            bg-gradient-to-l from-gray-950/95 via-gray-950/80 to-transparent
            text-white/50 hover:text-white/80 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
            <path fillRule="evenodd" d="M6.22 4.22a.75.75 0 0 1 1.06 0l3.25 3.25a.75.75 0 0 1 0 1.06l-3.25 3.25a.75.75 0 0 1-1.06-1.06L8.94 8 6.22 5.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
          </svg>
        </button>
      )}
    </div>
  );
}

/** Purchase mode toggle bar shown when chatting with the Shopkeeper. */
function ShopModeBar() {
  const purchaseMode = useSettingsStore((s) => s.purchaseMode);
  const purchaseBudget = useSettingsStore((s) => s.purchaseBudget);
  const setPurchaseMode = useSettingsStore((s) => s.setPurchaseMode);
  const setPurchaseBudget = useSettingsStore((s) => s.setPurchaseBudget);
  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetInput, setBudgetInput] = useState(String(purchaseBudget));

  function handleModeSwitch(mode: PurchaseMode) {
    setPurchaseMode(mode);
  }

  function commitBudget() {
    const val = parseInt(budgetInput, 10);
    if (!isNaN(val) && val >= 0) setPurchaseBudget(val);
    else setBudgetInput(String(purchaseBudget));
    setEditingBudget(false);
  }

  return (
    <div className="px-4 py-2 border-b border-white/10 flex items-center gap-2 text-xs">
      <span className="text-white/50 mr-1">🛒</span>
      <button
        onClick={() => handleModeSwitch('approval')}
        className={`px-2 py-0.5 rounded-md transition-colors ${
          purchaseMode === 'approval'
            ? 'bg-purple-600/60 text-white'
            : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/60'
        }`}
      >
        Approval {purchaseMode === 'approval' && '✓'}
      </button>
      <button
        onClick={() => handleModeSwitch('autonomous')}
        className={`px-2 py-0.5 rounded-md transition-colors ${
          purchaseMode === 'autonomous'
            ? 'bg-purple-600/60 text-white'
            : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/60'
        }`}
      >
        Auto {purchaseMode === 'autonomous' && '✓'}
      </button>
      <span className="text-white/20 mx-1">|</span>
      <span className="text-white/50">Budget:</span>
      {editingBudget ? (
        <input
          autoFocus
          type="number"
          value={budgetInput}
          onChange={(e) => setBudgetInput(e.target.value)}
          onBlur={commitBudget}
          onKeyDown={(e) => { if (e.key === 'Enter') commitBudget(); }}
          className="w-16 px-1 py-0.5 rounded bg-white/10 text-white text-xs border border-white/20 focus:outline-none focus:border-purple-400"
        />
      ) : (
        <button
          onClick={() => { setBudgetInput(String(purchaseBudget)); setEditingBudget(true); }}
          className="text-white/70 hover:text-white transition-colors"
        >
          ${purchaseBudget}
        </button>
      )}
    </div>
  );
}

export function ChatPanel() {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const chatPanelOpen = useChatStore((s) => s.chatPanelOpen);
  const activeAgent = useChatStore((s) => s.activeAgent);
  const agents = useWorldStore((s) => s.agents);
  const chatMessages = useChatStore((s) => s.chatMessages);
  const streamingText = useChatStore((s) => s.streamingText);
  const closeChat = useChatStore((s) => s.closeChat);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const isTTSPlaying = useVoiceStore((s) => s.isTTSPlaying);
  const stopTTS = useVoiceStore((s) => s.stopTTS);
  const isLoadingWorkspace = useChatStore((s) => s.isLoadingWorkspace);
  const purchaseMode = useSettingsStore((s) => s.purchaseMode);
  const purchaseBudget = useSettingsStore((s) => s.purchaseBudget);

  const authUser = useAuthStore((s) => s.user);
  const dynamicAgents = useWorkspaceStore((s) => s.dynamicAgents);
  const worldAgent = agents.find((a) => a.id === activeAgent);
  const dynAgent = dynamicAgents.find((a) => a.agentId === activeAgent);
  const agent = worldAgent ?? (dynAgent ? toDynamicAgentData(dynAgent) : null);

  const messages = activeAgent ? (chatMessages[activeAgent] ?? []) : [];
  const currentStream = activeAgent ? (streamingText[activeAgent] ?? '') : '';

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, currentStream]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && chatPanelOpen) {
        useChatStore.setState({ chatPanelOpen: false });
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [chatPanelOpen]);

  const isShopkeeper = activeAgent === 'shopkeeper';

  function handleSend() {
    if (!input.trim() || !activeAgent || isLoadingWorkspace) return;
    if (isShopkeeper) {
      sendMessage(activeAgent, input.trim(), 'text', { purchaseMode, purchaseBudget });
    } else {
      sendMessage(activeAgent, input.trim());
    }
    setInput('');
  }

  return (
    <div
      className={`fixed top-0 right-0 h-full w-96 z-50
        bg-gray-950/95 backdrop-blur-md border-l border-white/10
        flex flex-col transition-transform duration-300 ease-out
        ${chatPanelOpen ? 'translate-x-0' : 'translate-x-full'}`}
    >
      {agent && (
        <>
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-white/10">
            <div className="flex items-center gap-3">
              <AgentAvatar name={agent.name} color={agent.color} />
              <div>
                <h2 className="text-white font-semibold text-sm">
                  {agent.name}
                </h2>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <AgentStatusBadge status={agent.status} />
              {isTTSPlaying && (
                <button
                  onClick={stopTTS}
                  className="text-white/50 hover:text-red-400 p-1 transition-colors"
                  title="Stop speaking"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
                    <rect x="3" y="3" width="10" height="10" rx="1" />
                  </svg>
                </button>
              )}
              <button
                onClick={() => closeChat()}
                className="text-white/50 hover:text-white text-xl leading-none p-1"
              >
                &times;
              </button>
            </div>
          </div>

          {/* Task tabs */}
          <TaskTabs />

          {/* Shopping mode bar (shopkeeper only) */}
          {isShopkeeper && <ShopModeBar />}

          {/* Agent info */}
          <div className="px-4 py-3 border-b border-white/5">
            <p className="text-white/60 text-xs">{agent.description}</p>
            <p className="text-white/40 text-xs italic mt-1">
              &ldquo;{agent.personality}&rdquo;
            </p>
          </div>

          {/* Loading workspace spinner */}
          {isLoadingWorkspace && (
            <div className="flex-1 flex flex-col items-center justify-center gap-3">
              <div className="flex gap-1">
                <span className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce [animation-delay:0ms]" />
                <span className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce [animation-delay:150ms]" />
                <span className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce [animation-delay:300ms]" />
              </div>
              <p className="text-white/40 text-xs">Loading workspace...</p>
            </div>
          )}

          {/* Messages */}
          {!isLoadingWorkspace && (
            <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-3 min-w-0 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/15 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-white/25">
              {(() => {
                const hasUserMessage = messages.some((m) => m.role === 'user');
                const isBusy = agent.status === 'working' || agent.status === 'thinking';
                return !hasUserMessage && !currentStream ? (
                  <div className="flex flex-col h-full">
                    {isBusy && messages.length === 0 && (
                      <div className="flex flex-col items-center justify-center gap-3 py-8">
                        <div className="flex gap-1">
                          <span className="w-2 h-2 rounded-full bg-blue-400 animate-bounce [animation-delay:0ms]" />
                          <span className="w-2 h-2 rounded-full bg-blue-400 animate-bounce [animation-delay:150ms]" />
                          <span className="w-2 h-2 rounded-full bg-blue-400 animate-bounce [animation-delay:300ms]" />
                        </div>
                        <p className="text-white/40 text-xs">
                          {agent.name} is working on it...
                        </p>
                      </div>
                    )}
                    {/* Show any existing messages (e.g. welcome message from history) */}
                    {messages.filter((m) => m.role !== 'tool').map((msg, i) => (
                      <div
                        key={i}
                        className="max-w-prose mr-auto px-3 py-2 rounded-lg text-sm bg-white/10 text-white/80 break-words"
                      >
                        <Markdown content={msg.role === 'agent' ? msg.content : ''} />
                      </div>
                    ))}
                    {/* Spacer pushes prompts to bottom */}
                    <div className="flex-1" />
                    {/* Suggested prompts pinned to bottom */}
                    {!isBusy && agent.suggestedPrompts.length > 0 && (
                      <div className="space-y-2 pb-1">
                        {agent.suggestedPrompts.map((template) => {
                          const prompt = template
                            .replace(/\{name\}/g, authUser?.displayName ?? 'me')
                            .replace(/\{email\}/g, authUser?.email ?? 'me');
                          return (
                            <button
                              key={template}
                              onClick={() => {
                                if (activeAgent) sendMessage(activeAgent, prompt);
                              }}
                              className="block w-full text-left px-3 py-2 rounded-lg cursor-pointer
                                bg-white/5 hover:bg-white/10 border border-white/10
                                text-white/70 text-xs transition-colors"
                            >
                              {prompt}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : null;
              })()}
              {messages.some((m) => m.role === 'user') && messages.map((msg, i) =>
                msg.role === 'tool' ? (
                  <ToolChip key={i} toolName={msg.toolName} status={msg.status} />
                ) : msg.role === 'products' ? (
                  <div key={i} className="text-white/40 text-xs text-center py-1">
                    Products shown in canvas
                  </div>
                ) : (
                  <div
                    key={i}
                    className={`max-w-prose px-3 py-2 rounded-lg text-sm break-words ${
                      msg.role === 'user'
                        ? 'ml-auto bg-indigo-600/60 text-white whitespace-pre-wrap'
                        : 'mr-auto bg-white/10 text-white/80'
                    }`}
                  >
                    {msg.role === 'agent' ? (
                      <Markdown content={msg.content} />
                    ) : (
                      msg.content
                    )}
                  </div>
                ),
              )}

              {/* Streaming text */}
              {currentStream && (
                <div className="max-w-prose mr-auto px-3 py-2 rounded-lg text-sm bg-white/10 text-white/80 break-words">
                  <Markdown content={currentStream} />
                  <span className="inline-block w-1.5 h-4 ml-0.5 bg-white/60 animate-pulse" />
                </div>
              )}

              {/* Thinking indicator */}
              {agent.status === 'thinking' && !currentStream && (
                <div className="max-w-prose mr-auto px-3 py-2 rounded-lg text-sm bg-white/10 text-white/40">
                  <ThinkingIndicator />
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}

          {/* Input */}
          <div className="p-3 border-t border-white/10">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.stopPropagation();
                    handleSend();
                  }
                }}
                placeholder={isLoadingWorkspace ? 'Loading workspace...' : `Message ${agent.name}...`}
                disabled={isLoadingWorkspace}
                className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10
                  text-white text-sm placeholder:text-white/30
                  focus:outline-none focus:border-white/30
                  disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <button
                onClick={handleSend}
                disabled={agent.status === 'thinking' || agent.status === 'working' || isLoadingWorkspace}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500
                  disabled:opacity-50 disabled:cursor-not-allowed
                  text-white text-sm font-medium transition-colors"
              >
                Send
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function formatToolName(raw: string): string {
  const parts = raw.split('_');
  const meaningful = parts.length > 1 ? parts.slice(1) : parts;
  return meaningful
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

function ToolChip({ toolName, status }: { toolName: string; status: 'started' | 'completed' | 'failed' }) {
  const label = status === 'started'
    ? `Running ${formatToolName(toolName)}...`
    : status === 'completed'
      ? `${formatToolName(toolName)}`
      : `Failed: ${formatToolName(toolName)}`;

  return (
    <p className={`text-[11px] leading-relaxed ${
      status === 'failed' ? 'text-red-400/70' : 'text-white/50'
    }`}>
      {label}
    </p>
  );
}
