import { create } from 'zustand';

// Tracks API requests that have been pending long enough that the server is probably waking up from a cold
// start (free hosting sleeps when idle). apiClient.ts adds a request id once it has been waiting for a few
// seconds and removes it when the request finishes; <ServerWakingBanner /> shows while any id is present.
interface ServerStatusState {
  slowRequestIds: number[];
  addSlow: (id: number) => void;
  removeSlow: (id: number) => void;
}

export const useServerStatusStore = create<ServerStatusState>((set) => ({
  slowRequestIds: [],
  addSlow: (id) => set((s) => (s.slowRequestIds.includes(id) ? s : { slowRequestIds: [...s.slowRequestIds, id] })),
  removeSlow: (id) => set((s) => (s.slowRequestIds.includes(id) ? { slowRequestIds: s.slowRequestIds.filter((x) => x !== id) } : s))
}));
