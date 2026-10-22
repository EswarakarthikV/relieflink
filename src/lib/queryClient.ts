import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0,
      gcTime: 5 * 60_000,
      retry: 2,
      refetchOnWindowFocus: true,
      refetchOnMount: 'always',
    },
    mutations: {
      retry: 1,
    },
  },
})
