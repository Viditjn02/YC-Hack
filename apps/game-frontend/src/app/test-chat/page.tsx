'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useWorldStore } from '@/stores/worldStore';
import { useChatStore } from '@/stores/chatStore';
import { useAuthStore } from '@/stores/authStore';
import { initWebSocket } from '@/lib/messageHandler';
import { gameSocket } from '@/lib/websocket';
import {
  agents as agentList,
  statusColors,
  statusLabels,
  zoneColors,
} from '@/data/agents';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Markdown } from '@/components/ui/Markdown';
import { ThinkingIndicator } from '@/components/ui/ThinkingIndicator';
import { AgentAvatar } from '@/components/ui/AgentAvatar';
import { Send, LogOut, Wifi, WifiOff, Bot, ChevronRight } from 'lucide-react';

function AgentColumn({ agentId }: { agentId: string }) {
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const agents = useWorldStore((s) => s.agents);
  const chatMessages = useChatStore((s) => s.chatMessages);
  const streamingText = useChatStore((s) => s.streamingText);
  const activeAgent = useChatStore((s) => s.activeAgent);
  const openChat = useChatStore((s) => s.openChat);
  const sendMessage = useChatStore((s) => s.sendMessage);

  const agent = agents.find((a) => a.id === agentId)!;
  const agentData = agentList.find((a) => a.id === agentId)!;
  const messages = chatMessages[agentId] ?? [];
  const currentStream = streamingText[agentId] ?? '';
  const isActive = activeAgent === agentId;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, currentStream]);

  const handleSend = useCallback(() => {
    if (!input.trim()) return;
    if (!isActive) openChat(agentId);
    sendMessage(agentId, input.trim());
    setInput('');
  }, [input, isActive, agentId, openChat, sendMessage]);

  const handlePromptClick = useCallback(
    (prompt: string) => {
      if (!isActive) openChat(agentId);
      sendMessage(agentId, prompt);
    },
    [isActive, agentId, openChat, sendMessage],
  );

  return (
    <div className="flex flex-col h-full border border-border rounded-xl bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-border shrink-0">
        <AgentAvatar name={agent.name} color={agent.color} className="w-10 h-10 text-sm" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-foreground font-semibold text-sm truncate">
              {agent.name}
            </h3>
            {agent.status !== 'idle' && (
              <Badge
                variant="secondary"
                className="text-[10px] px-1.5 py-0"
                style={{
                  backgroundColor: statusColors[agent.status] + '30',
                  color: statusColors[agent.status],
                }}
              >
                {statusLabels[agent.status]}
              </Badge>
            )}
          </div>
          <p
            className="text-xs font-medium"
            style={{ color: zoneColors[agent.zone] ?? '#888' }}
          >
            {agent.zone}
          </p>
        </div>
        {!isActive && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => openChat(agentId)}
            className="text-muted-foreground text-xs"
          >
            Connect
          </Button>
        )}
        {isActive && (
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: statusColors[agent.status] }}
          />
        )}
      </div>

      {/* Description */}
      <div className="px-4 py-2 border-b border-border/50 shrink-0">
        <p className="text-muted-foreground text-xs">{agent.description}</p>
        <p className="text-muted-foreground/60 text-xs italic mt-0.5">
          &ldquo;{agent.personality}&rdquo;
        </p>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 min-h-0 min-w-0">
        <div className="p-4 space-y-3 overflow-hidden">
          {messages.length === 0 && !currentStream && (
            <div className="space-y-2">
              <p className="text-muted-foreground/50 text-xs text-center mb-3">
                Start a conversation
              </p>
              {agentData.suggestedPrompts.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => handlePromptClick(prompt)}
                  className="block w-full text-left px-3 py-2 rounded-lg
                    bg-secondary/50 hover:bg-secondary border border-border
                    text-muted-foreground text-xs transition-colors cursor-pointer"
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}

          {messages.map((msg, i) =>
            msg.role === 'tool' ? (
              <ToolDebugRow key={i} toolName={msg.toolName} status={msg.status} result={msg.result} />
            ) : msg.role === 'products' ? (
              <div key={i} className="text-white/50 text-xs mr-auto">
                [{msg.products.length} product cards]
              </div>
            ) : (
              <div
                key={i}
                className={`max-w-prose px-3 py-2 rounded-lg text-sm break-words ${
                  msg.role === 'user'
                    ? 'ml-auto bg-indigo-600/60 text-white whitespace-pre-wrap'
                    : 'mr-auto bg-secondary text-foreground/80'
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
            <div className="max-w-prose mr-auto px-3 py-2 rounded-lg text-sm bg-secondary text-foreground/80 break-words">
              <Markdown content={currentStream} />
              <span className="inline-block w-1.5 h-4 ml-0.5 bg-foreground/60 animate-pulse" />
            </div>
          )}

          {/* Thinking indicator */}
          {agent.status === 'thinking' && !currentStream && (
            <div className="max-w-prose mr-auto px-3 py-2 rounded-lg text-sm bg-secondary text-muted-foreground">
              <ThinkingIndicator />
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-3 border-t border-border shrink-0">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={`Message ${agent.name}...`}
            className="bg-secondary/50 border-border text-foreground placeholder:text-muted-foreground/50"
          />
          <Button
            onClick={handleSend}
            disabled={
              !input.trim() ||
              agent.status === 'thinking' ||
              agent.status === 'working'
            }
            size="icon"
            className="shrink-0 bg-indigo-600 hover:bg-indigo-500 text-white"
          >
            <Send className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function ToolDebugRow({ toolName, status, result }: {
  toolName: string;
  status: 'started' | 'completed' | 'failed';
  result?: string;
}) {
  const [open, setOpen] = useState(false);
  const label = status === 'started'
    ? `Running ${formatToolName(toolName)}...`
    : status === 'completed'
      ? formatToolName(toolName)
      : `Failed: ${formatToolName(toolName)}`;

  return (
    <div className="min-w-0">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1 text-[11px] leading-relaxed ${
          status === 'failed' ? 'text-red-400/70' : 'text-muted-foreground/60'
        } hover:text-muted-foreground transition-colors`}
      >
        <ChevronRight className={`size-3 shrink-0 transition-transform ${open ? 'rotate-90' : ''}`} />
        {label}
      </button>
      {open && (
        <pre className="mt-1 ml-4 p-2 rounded bg-black/30 text-[10px] text-muted-foreground/50 font-mono whitespace-pre-wrap break-words">
          {JSON.stringify({ toolName, status, result }, null, 2)}
        </pre>
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

export default function TestChatPage() {
  const user = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);
  const signIn = useAuthStore((s) => s.signIn);
  const signOut = useAuthStore((s) => s.signOut);
  const getToken = useAuthStore((s) => s.getToken);
  const connected = useWorldStore((s) => s.connected);
  const worldReset = useWorldStore((s) => s.reset);
  const chatReset = useChatStore((s) => s.reset);

  // Connect to WebSocket once authenticated
  useEffect(() => {
    if (!user) return;

    let cancelled = false;
    (async () => {
      try {
        const token = await getToken();
        if (cancelled) return;
        initWebSocket(user.displayName ?? user.email, token, getToken, user.uid);
      } catch {
        // auth error — user will see "not connected"
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, getToken]);

  const handleSignOut = useCallback(async () => {
    gameSocket.disconnect();
    worldReset();
    chatReset();
    await signOut();
  }, [worldReset, chatReset, signOut]);

  // Loading state
  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[#0a0a1a] overflow-auto">
        <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  // Not authenticated
  if (!user) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[#0a0a1a] overflow-auto">
        <div className="text-center space-y-6">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-foreground">
              BossRoom Test Chat
            </h1>
            <p className="text-muted-foreground">
              Sign in to test AI agent conversations
            </p>
          </div>
          <Button
            onClick={signIn}
            size="lg"
            className="bg-indigo-600 hover:bg-indigo-500 text-white"
          >
            Sign in with Google
          </Button>
        </div>
      </div>
    );
  }

  // Authenticated — show chat
  return (
    <div className="fixed inset-0 flex flex-col bg-[#0a0a1a] overflow-hidden">
      {/* Top bar */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <Bot className="size-5 text-indigo-400" />
          <h1 className="text-foreground font-semibold text-lg">
            BossRoom Test Chat
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm">
            {connected ? (
              <>
                <Wifi className="size-4 text-emerald-400" />
                <span className="text-emerald-400">Connected</span>
              </>
            ) : (
              <>
                <WifiOff className="size-4 text-red-400" />
                <span className="text-red-400">Disconnected</span>
              </>
            )}
          </div>
          <span className="text-muted-foreground text-sm">
            {user.displayName ?? user.email}
          </span>
          <Button variant="ghost" size="sm" onClick={handleSignOut}>
            <LogOut className="size-4" />
            Logout
          </Button>
        </div>
      </header>

      {/* 3-column chat */}
      <main className="flex-1 grid grid-cols-3 gap-4 p-4 min-h-0">
        {agentList.map((agent) => (
          <AgentColumn key={agent.id} agentId={agent.id} />
        ))}
      </main>
    </div>
  );
}
