import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useWorldStore } from '@/stores/worldStore';
import { useAgentBehaviorStore } from '@/stores/agentBehaviorStore';
import { INTERACTION } from '@/data/gameConfig';
import type { AgentData } from '@/data/agents';
import type { Vector3 } from 'three';

export function useNearestAgent(
  agents: AgentData[],
  bodyRef: React.RefObject<{ group: { translation(): Vector3 } | null } | null>,
) {
  const prevNearest = useRef<string | null>(null);

  useFrame(() => {
    const body = bodyRef.current?.group;
    if (!body) return;

    const pos = body.translation();
    const runtimes = useAgentBehaviorStore.getState().runtimes;
    let closest: string | null = null;
    let closestDist = Infinity;

    for (const agent of agents) {
      const runtime = runtimes[agent.id];
      const ax = runtime ? runtime.currentPosition[0] : agent.position[0];
      const az = runtime ? runtime.currentPosition[2] : agent.position[2];
      const dx = pos.x - ax;
      const dz = pos.z - az;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < INTERACTION.proximityRadius && dist < closestDist) {
        closest = agent.id;
        closestDist = dist;
      }
    }

    if (closest !== prevNearest.current) {
      prevNearest.current = closest;
      useWorldStore.getState().setNearestAgent(closest);
    }
  });
}
