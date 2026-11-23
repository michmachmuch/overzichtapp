import { createContext, useContext, useEffect, useReducer, type Dispatch, type ReactNode } from 'react'
import { emptyState, reducer, type Action } from './reducer'
import type { AppState } from './types'

const STORAGE_KEY = 'overzichtapp:v1'

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyState
    const parsed = JSON.parse(raw) as AppState
    if (parsed?.version !== 1 || !Array.isArray(parsed.projects)) return emptyState
    return parsed
  } catch {
    return emptyState
  }
}

export function isValidState(value: unknown): value is AppState {
  const v = value as AppState
  return !!v && v.version === 1 && Array.isArray(v.projects)
}

const StateContext = createContext<AppState>(emptyState)
const DispatchContext = createContext<Dispatch<Action>>(() => {})

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadState)
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      /* storage full or blocked: keep working in memory */
    }
  }, [state])
  return (
    <StateContext.Provider value={state}>
      <DispatchContext.Provider value={dispatch}>{children}</DispatchContext.Provider>
    </StateContext.Provider>
  )
}

export const useAppState = () => useContext(StateContext)
export const useDispatch = () => useContext(DispatchContext)
