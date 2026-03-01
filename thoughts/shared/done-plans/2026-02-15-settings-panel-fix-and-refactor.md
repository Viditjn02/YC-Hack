# Settings Panel: Fix Close Bug, Extract Avatar/Music, Add Voice Selection

**Date:** 2026-02-15
**Status:** Draft

## Problems

### 1. Bug: Panel can't be closed by clicking outside
The `SettingsPanel` backdrop (`fixed inset-0 z-50`) is rendered **inside** the HUD's stacking context (`fixed z-40`). Two issues:

1. **Event bubbling:** The backdrop is a DOM child of the trigger div (`HUD.tsx:47`) which has `onClick={toggleSettingsPanel}`. Clicking the backdrop fires `closeSettingsPanel`, then the event bubbles up to the trigger and fires `toggleSettingsPanel`, immediately re-opening the panel.

2. **Stacking context trapping:** The HUD container creates a stacking context at `z-40`. The backdrop's `z-50` is scoped to that context, making its effective z-level limited to the z-40 layer. Root-level sibling overlays (ChatPanel, InteractionPrompt, etc.) at root-level `z-40`/`z-50` sit **above** the trapped backdrop and intercept clicks.

### 2. UX: Avatar/Music don't belong in user profile
The profile chip should just show who you are and let you sign out. Avatar selection and music controls are game settings.

### 3. Feature: No voice selection
TTS voice is a hardcoded global env var (`INWORLD_VOICE_ID=Dominus`). Users should be able to pick their character's voice.

---

## Plan

### Task 1: Simplify HUD to identity-only

**`apps/game-frontend/src/components/ui/HUD.tsx`:**
- Remove `SettingsPanel` import and rendering
- Remove `settingsPanelOpen` and `toggleSettingsPanel` subscriptions
- Remove `cursor-pointer` and `onClick` from the user-info div
- Result: just photo, name, sign-out button — no interactivity beyond sign-out

### Task 2: Create GameToolbar with avatar, music, and voice tabs

**Create `apps/game-frontend/src/components/ui/GameToolbar.tsx`:**
- Fixed bottom-left toolbar replacing the current `MusicToggle`
- Row of small icon buttons: avatar, music, voice
- Clicking a button opens a popover panel above the toolbar
- Only one popover open at a time (local `useState<'avatar' | 'music' | 'voice' | null>(null)`)
- Popover has its own `fixed inset-0` backdrop for click-outside-to-close (rendered at root level in Game.tsx, so no stacking context issues)
- Positioned `fixed bottom-4 left-4 z-40 pointer-events-auto`

**Avatar tab** (reuse existing grid from SettingsPanel):
- 4-column grid of avatar options from `AVATARS` data
- Selected state from `useSettingsStore`
- Calls `selectAvatar()` on click

**Music tab** (reuse existing controls from SettingsPanel):
- Play/pause toggle
- Track selector grid
- Volume slider
- State from `useMusicStore`

**Voice tab** (new):
- Grid of voice options (Dominus, Pixie, Snik, Loretta)
- Selected state from `useSettingsStore` (new `voiceId` field)
- Calls new `selectVoice()` action
- Sends `player:updateSettings` with `voiceId` to persist server-side

### Task 3: Add voice selection to settings store + shared types

**`libs/shared-types/src/lib/settings.ts`:**
- Add `voiceId` to `userSettingsSchema`:
  ```ts
  export const VOICE_OPTIONS = ['Dominus', 'Pixie', 'Snik', 'Loretta'] as const;
  export const userSettingsSchema = z.object({
    avatarId: z.string().optional(),
    voiceId: z.string().optional(),
  });
  ```

**`apps/game-frontend/src/stores/settingsStore.ts`:**
- Add `voiceId: string` state (default `'Dominus'`)
- Add `selectVoice(id: string)` action that updates state and sends `player:updateSettings` with `{ voiceId: id }`
- Add `setVoiceFromServer(voiceId: string)` to hydrate from server
- Remove `settingsPanelOpen`, `toggleSettingsPanel`, `closeSettingsPanel` (no longer needed)

**`libs/shared-types/src/lib/websocket.ts`:**
- Expand `player:updateSettings` payload to accept either field:
  ```ts
  z.object({
    type: z.literal('player:updateSettings'),
    payload: z.object({
      avatarId: z.string().optional(),
      voiceId: z.string().optional(),
    }),
  })
  ```

### Task 4: Wire voice selection through server

**`apps/game-server/src/handlers/playerSettings.ts`:**
- Accept optional `voiceId` in payload alongside `avatarId`
- If `voiceId` is present, persist it via `userRepo.updateSettings(uid, { voiceId })`
- No broadcast needed (voice choice is private to the user)

**`apps/game-server/src/ai/tts.ts`:**
- Change `synthesizeSpeech(text: string)` to `synthesizeSpeech(text: string, voiceId?: string)`
- Use `voiceId ?? env.INWORLD_VOICE_ID` as the voice in the API call (env var becomes the fallback default)

**`apps/game-server/src/domains/agents/service.ts`:**
- In the TTS trigger block (~line 486), look up the user's `voiceId` setting from their DB record
- Pass it to `synthesizeSpeech(fullResponse, userVoiceId)`
- The user's settings are already loaded during `player:join` — retrieve via `userRepo.getSettings(uid)` or similar

### Task 5: Hydrate voice setting on join

**`apps/game-server/src/handlers/playerJoin.ts`** (or wherever `player:join` is handled):
- The user's `settings.voiceId` is already persisted in the `users` table jsonb `settings` column
- Ensure it's included when the server sends initial state to the client after join

**`apps/game-frontend/src/lib/messageHandler.ts`:**
- On `world:state` or `player:joined`, hydrate `useSettingsStore` with the user's saved `voiceId` (same pattern as avatar hydration)

### Task 6: Update Game.tsx + cleanup

**`apps/game-frontend/src/components/game/Game.tsx`:**
- Remove inline `MusicToggle` component (~lines 24-47)
- Import and render `<GameToolbar />` where `<MusicToggle />` was
- Do NOT render `<SettingsPanel />` (deleted)

**`apps/game-frontend/src/components/ui/SettingsPanel.tsx`:**
- Delete this file — contents absorbed into `GameToolbar.tsx`

---

## File Changes Summary

| File | Action |
|------|--------|
| `components/ui/GameToolbar.tsx` | **Create** — bottom-left toolbar with avatar + music + voice popovers |
| `components/ui/HUD.tsx` | **Edit** — remove all settings panel logic, identity-only |
| `components/ui/SettingsPanel.tsx` | **Delete** — absorbed into GameToolbar |
| `components/game/Game.tsx` | **Edit** — remove MusicToggle, add GameToolbar |
| `stores/settingsStore.ts` | **Edit** — add voiceId state, remove panel open/close state |
| `libs/shared-types/src/lib/settings.ts` | **Edit** — add voiceId + VOICE_OPTIONS |
| `libs/shared-types/src/lib/websocket.ts` | **Edit** — expand player:updateSettings payload |
| `apps/game-server/src/ai/tts.ts` | **Edit** — accept voiceId param |
| `apps/game-server/src/domains/agents/service.ts` | **Edit** — look up user voiceId, pass to synthesizeSpeech |
| `apps/game-server/src/handlers/playerSettings.ts` | **Edit** — handle voiceId persistence |
| `apps/game-frontend/src/lib/messageHandler.ts` | **Edit** — hydrate voiceId on join |

## Voice Options

Confirmed available via Inworld TTS API:
- **Dominus** (current default) — deep, commanding
- **Pixie** — lighter, energetic

User-requested (not in public docs, may only exist in Inworld playground — will fail gracefully if invalid):
- **Snik**
- **Loretta**

If Snik/Loretta fail at runtime, the API returns an error and TTS is skipped (fail-soft). We can swap in confirmed alternatives later (e.g., Hades, Ashley, Dennis).

## Implementation Notes

- GameToolbar popovers use local `useState` — no global store needed for open/close
- Each popover renders its own `fixed inset-0` backdrop at the root level (not nested in a stacking context) — fixes the original close bug
- Voice selection is per-user, persisted in the `users.settings` jsonb column alongside `avatarId`
- The `INWORLD_VOICE_ID` env var becomes the server-wide default fallback, not the only option
- No DB migration needed — `settings` is a jsonb column, adding a new key is schema-compatible
