import {
  isServer,
  QueryClient,
  QueryCache,
  MutationCache,
  defaultShouldDehydrateQuery,
} from '@tanstack/react-query';
import { log } from '../lib/logger';

function makeQueryClient() {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        log.error(`[query] ${query.queryKey.join('/')} failed:`, error);
      },
    }),
    mutationCache: new MutationCache({
      onError: (error, _variables, _context, mutation) => {
        const key = mutation.options.mutationKey?.join('/') ?? 'unknown';
        log.error(`[mutation] ${key} failed:`, error);
      },
    }),
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        retry: 1,
      },
      dehydrate: {
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) || query.state.status === 'pending',
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

export function getQueryClient() {
  if (isServer) return makeQueryClient();
  if (!browserQueryClient) browserQueryClient = makeQueryClient();
  return browserQueryClient;
}
