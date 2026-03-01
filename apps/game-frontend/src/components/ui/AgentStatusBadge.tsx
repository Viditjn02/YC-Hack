'use client';

import type { AgentStatus } from '@bossroom/shared-types';
import { statusColors, statusLabels } from '@/data/agents';

interface AgentStatusBadgeProps {
  status: AgentStatus;
}

export function AgentStatusBadge({ status }: AgentStatusBadgeProps) {
  if (status === 'idle') return null;

  return (
    <span
      className="px-2 py-0.5 rounded-full text-[10px] font-medium text-white capitalize"
      style={{ backgroundColor: statusColors[status] + '80' }}
    >
      {statusLabels[status]}
    </span>
  );
}
