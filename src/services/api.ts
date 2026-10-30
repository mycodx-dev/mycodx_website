import type { Member } from '../types/api'
import { members } from '../data/members'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'

// Members API
export async function fetchMembers(): Promise<Member[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/members`)
    if (!response.ok) throw new Error('Failed to fetch members')
    return await response.json()
  } catch (error) {
    console.error('Error fetching members:', error)
    return getMockMembers()
  }
}

function getMockMembers(): Member[] {
  return members
}
