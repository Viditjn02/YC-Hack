# Game Frontend

## Architecture Overview

BossBot uses two data fetching strategies:

| Concern | Transport | State Manager | Example |
|---|---|---|---|
| Real-time game state | WebSocket | Zustand | Player positions, agent chat, streaming responses |
| CRUD on persistent entities | REST (HTTP) | TanStack Query | Lobbies, player profiles, match history, leaderboards |

**Rule of thumb:** If the server pushes data unprompted, use WebSocket + Zustand. If the client requests data on demand, use TanStack Query.

## TanStack Query Setup

The QueryClient is configured in `src/app/get-query-client.ts` using a singleton factory pattern required by Next.js App Router:

- **Server:** A new `QueryClient` is created per request to prevent cross-user data leaks
- **Browser:** A single `QueryClient` is reused across navigations to preserve cache

### Default Options

| Option | Value | Why |
|---|---|---|
| `staleTime` | 60 s | Prevents refetch-on-mount confusion; most REST data doesn't change every second |
| `retry` | 1 | Fail fast — the default 3 retries with exponential backoff adds 10 s+ delay |
| `refetchOnWindowFocus` | `true` (default) | Silently freshens data when user returns to tab |
| `gcTime` | 5 min (default) | Garbage-collects unused cache entries; rarely needs changing |

## Query Key Factory Pattern

Every domain gets a query key factory file at `src/queries/<domain>.queries.ts`. The factory uses `queryOptions()` from TanStack Query v5 to co-locate the key, fetcher, and options.

### Example: Lobbies Domain

```typescript
// src/queries/lobbies.queries.ts
import { queryOptions } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';

// Types — import from @bossroom/shared-types when available
interface Lobby {
  id: string;
  name: string;
  playerCount: number;
}

export const lobbyQueries = {
  all: () =>
    queryOptions({
      queryKey: ['lobbies'],
      queryFn: () => apiFetch<Lobby[]>('/api/lobbies'),
    }),

  detail: (id: string) =>
    queryOptions({
      queryKey: ['lobbies', id],
      queryFn: () => apiFetch<Lobby>(`/api/lobbies/${id}`),
    }),

  byPlayer: (playerId: string) =>
    queryOptions({
      queryKey: ['lobbies', 'by-player', playerId],
      queryFn: () => apiFetch<Lobby[]>(`/api/lobbies?playerId=${playerId}`),
    }),
};
```

### Using in a Component

```typescript
'use client';

import { useQuery } from '@tanstack/react-query';
import { lobbyQueries } from '@/queries/lobbies.queries';

export function LobbyList() {
  const { data, isPending, error } = useQuery(lobbyQueries.all());

  if (isPending) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <ul>
      {data.map((lobby) => (
        <li key={lobby.id}>{lobby.name}</li>
      ))}
    </ul>
  );
}
```

### Adding a New Domain

1. Create `src/queries/<domain>.queries.ts`
2. Define a factory object with methods returning `queryOptions({...})`
3. Use `apiFetch` from `@/lib/api` as the `queryFn`
4. Import and use in components with `useQuery(domainQueries.method())`

## Mutations

Use `useMutation` with `onSuccess` invalidation through factory keys:

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { lobbyQueries } from '@/queries/lobbies.queries';

export function useCreateLobby() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (name: string) =>
      apiFetch<Lobby>('/api/lobbies', {
        method: 'POST',
        body: JSON.stringify({ name }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lobbies'] });
    },
  });
}
```

**Note:** Mutation keys are optional and rarely needed. Only add them when you need to share mutation state across components (e.g., showing a global "saving" indicator).

## Auth & Cache

On logout, all query cache is cleared to prevent stale user data from leaking to the next session:

```typescript
// In authStore.ts signOut action:
await fbSignOut(firebaseAuth);
getQueryClient().removeQueries();
```

The `apiFetch` wrapper in `src/lib/api.ts` automatically attaches the Firebase ID token to every request. When `NEXT_PUBLIC_API_URL` is not set, requests use relative paths (suitable for Next.js API routes).

## Anti-Patterns

| Don't | Why |
|---|---|
| `new QueryClient()` in render | Breaks SSR, leaks data between users on server |
| `useState` for query data | Duplicates cache, causes stale data |
| Raw string query keys in components | No autocomplete, refactoring nightmare |
| `const { data, ...rest } = useQuery(...)` | Breaks React render optimizations |
| User ID in every query key | Clear cache on logout instead |
| Mutation key factories | Mutation keys are rarely needed |
| `onSuccess`/`onError` on `useQuery` | Removed in v5 — use QueryCache callbacks |
