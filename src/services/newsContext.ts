import { createContext, useContext } from 'react'
import type { NewsContent } from '../../shared/news'
export interface NewsState { items:NewsContent[]; loading:boolean; error:boolean; hasMore:boolean; loadingMore:boolean; retry:()=>void; more:()=>void }
export const NewsContext=createContext<NewsState|null>(null)
export function useNews(){const state=useContext(NewsContext);if(!state)throw new Error('NewsProvider required');return state}
