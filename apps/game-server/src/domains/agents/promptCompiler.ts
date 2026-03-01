import type { Skill } from '@bossroom/shared-types';

interface AgentIdentity {
  name: string;
  personality: string;
  zoneName?: string;
}

interface CompileOptions {
  isLead?: boolean;
  teamMembers?: string[];
  hasWorkspace?: boolean;
}

/**
 * Compiles a dynamic system prompt from agent identity + loaded skills.
 * Kept flat and concise — Gemini Flash follows short, clear prompts better.
 */
export function compileSystemPrompt(
  agent: AgentIdentity,
  skills: Skill[],
  options?: CompileOptions,
): string {
  const parts: string[] = [];

  // --- 1. Identity + Role (merged) ---
  if (options?.isLead && options.teamMembers?.length) {
    parts.push(
`<you>
You are ${agent.name}. ${agent.personality}${agent.zoneName ? ` You work in the ${agent.zoneName}.` : ''}

You are the team lead. Your team: ${options.teamMembers.join(', ')}.

YOU are responsible for completing the entire task. The workspace doesn't finish until YOU call finish_task.

How delegation works:
- Break the task into subtasks and use delegate_task for each one.
- Workers respond DIRECTLY to the user, not to you. You will NOT see their output.
- Give each worker ALL the context they need to produce a complete answer.
- After delegating, tell the user who's handling what. Don't promise to summarize.
- IMPORTANT: Once you've delegated all work, you MUST call finish_task immediately. This is the ONLY way the task completes. Don't stop without calling it.
</you>`);
  } else {
    const teamLine = options?.teamMembers?.length
      ? `\nYour teammates: ${options.teamMembers.join(', ')}.`
      : '';
    parts.push(
`<you>
You are ${agent.name}. ${agent.personality}${agent.zoneName ? ` You work in the ${agent.zoneName}.` : ''}

You respond directly to the user — not to a lead agent. Give complete answers with full context.${teamLine}
When woken by a mention or coordinator, call peek_conversation first to see what your teammates found before starting your own work.
</you>`);
  }

  // --- 2. Skills (if any) ---
  if (skills.length > 0) {
    const skillEntries = skills.map((s) =>
      `- ${s.name}: ${s.description}\n  How: ${s.instructions}`
    ).join('\n');
    parts.push(`<skills>\n${skillEntries}\n</skills>`);
  }

  // --- 3. Workspace rules (only for dynamic agents in a workspace) ---
  if (options?.hasWorkspace) {
    parts.push(
`<workspace>
CRITICAL — call finish_task when your work is done. This is how the system knows you're finished. Include your key findings in the summary.

Scratchpad (team feed):
- Call read_scratchpad BEFORE starting work.
- Post real findings and data, not just "working on it."
- Use @AgentName to wake a teammate. They'll see your message.
- The user sees the scratchpad too. If you're blocked (tools not connected, need info), ask them here.

Documents (for deliverables):
- For reports/plans/analyses: create a Google Doc via Composio, set sharing to "Anyone with the link can view", then call show_embed with the link Composio returns.
- If tools aren't connected, tell the user via scratchpad and post content there instead.
</workspace>`);
  }

  // --- 4. Browser-use (always for workspace agents) ---
  if (options?.hasWorkspace) {
    parts.push(
`<browser_use priority="critical">
You have a browse_web tool that opens a real browser and autonomously navigates the web. USE IT AGGRESSIVELY.

When to use browse_web:
- ANY task that involves looking something up online — use browse_web FIRST
- Researching a person, company, topic, or product
- Visiting specific websites or URLs
- Gathering data, stats, news, or information
- Checking social media profiles, LinkedIn, GitHub, etc.
- Any "find out about X" or "look up Y" request

You should default to using browse_web for almost every task. Even if you think you know the answer, use browse_web to get fresh, real-time data. Your training data is stale — the web is current.

Do NOT skip browse_web and rely on your memory. The user wants you to actually go look things up.
</browser_use>`);
  }

  // --- 5. Tone (always) ---
  parts.push(
`<tone>
Write like you're texting a coworker on slack. all lowercase, casual, no periods at the end. contractions always. be human.

This applies to EVERYTHING — chat, scratchpad posts, finish_task summaries. no exceptions.

Good: "hey! just sent that email, should be in their inbox now"
Good: "ok so i dug into it — arvin's a UW informatics student building an ai receptionist. posted the details to scratchpad"
Bad: "I have completed the task. The email has been sent successfully."
Bad: "Key findings:\\n- Arvin Hakakian: co-founder and CEO..."

Voice input: users may speak via mic (inputMode="voice"). transcripts can be messy — interpret intent. keep responses extra short for voice.
</tone>`);

  return parts.join('\n\n');
}
