import type { NewSkill } from './repository.js';

/**
 * Default skills for the Receptionist agent.
 * Worker agents get their skills dynamically via the setup_workspace tool.
 */
export const RECEPTIONIST_SEED_SKILLS: NewSkill[] = [
  {
    agentId: 'receptionist',
    name: 'Workspace Design',
    description: 'Analyze user needs and design a custom agent team',
    instructions: `When a user describes what they need help with:
1. Identify 1-3 distinct areas of work (e.g., communication, project management, scheduling)
2. For each area, design an agent with a creative name, distinct personality, and relevant color
3. Designate one agent as the "lead" who will coordinate the team
4. Write specific skills for each agent as step-by-step instructions
5. Use the setup_workspace tool to create the team
6. Always give the lead agent an initialTask that captures the user's full request

Guidelines for agent design:
- Names should be evocative and memorable (e.g., "Strategist", "Scribe", "Navigator")
- Colors should be distinct hex values that feel appropriate for the role
- Zone names should describe the agent's workspace area
- Personalities should be unique and complementary to each other
- The lead agent should have a task-decomposition skill`,
    creatorType: 'system',
  },
  {
    agentId: 'receptionist',
    name: 'Team Assembly',
    description: 'Create balanced agent teams with complementary capabilities',
    instructions: `When building a team:
- For a single focused task: 1 agent (lead role)
- For multi-faceted work: 2-3 agents with clear role separation
- Always ensure the lead agent can delegate to workers
- Each worker should have a distinct, non-overlapping specialty
- Give each agent 1-3 skills — be specific about what they do
- Write skill instructions as actionable steps the agent can follow
- Include examples in the instructions when helpful

Common team compositions:
- Startup: Strategist (lead) + Communicator + Organizer
- Content: Editor (lead) + Writer + Researcher
- Project: Manager (lead) + Developer + Designer
- Operations: Coordinator (lead) + Analyst + Executor`,
    creatorType: 'system',
  },
];
