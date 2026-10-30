import { create } from 'zustand'
import type { Member } from '../types/api'
import { fetchMembers as fetchMembersAPI } from '../services/api'

interface DataState {
  members: Member[]
  membersLoading: boolean
  membersError: string | null
  fetchMembers: () => Promise<void>
}

export const useDataStore = create<DataState>((set) => ({
  members: [],
  membersLoading: false,
  membersError: null,
  fetchMembers: async () => {
    set({ membersLoading: true, membersError: null })
    try {
      const data = await fetchMembersAPI()
      set({ members: data, membersLoading: false })
    } catch (error) {
      set({
        membersError: error instanceof Error ? error.message : 'Failed to fetch members',
        membersLoading: false,
      })
    }
  },
}))
