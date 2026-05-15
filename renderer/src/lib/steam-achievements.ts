/**
 * Steam Emulator Achievement Integration
 *
 * Supports Goldberg, SSE, and similar Steam emulators that store achievements
 * in local files. These emulators typically read achievements from:
 * - settings/achievements.ini (Goldberg)
 * - CREDITS/CREDITS64.DLL overrides achievements
 *
 * The overlay can hook into game processes and:
 * 1. Intercept Steam API calls to read achievement state
 * 2. Write achievements to the emulator's local storage
 * 3. Display notifications when achievements unlock
 */

export type SteamAchievement = {
  id: string            // AppID_AchievementID format
  appid: string         // Steam App ID
  name: string          // Achievement name
  displayName: string   // Localized display name
  description: string   // Achievement description
  icon: string          // Icon URL or path
  achieved: boolean     // Whether unlocked
  unlockTime: number    // Unix timestamp when unlocked
  hidden: boolean       // Whether hidden until unlock
}

export type SteamAchievementWatcher = {
  appid: string
  pid: number
  steamPath?: string    // Path to steamemu folder
  achievements: SteamAchievement[]
  progressCallback?: (unlocked: SteamAchievement[]) => void
}

// Goldberg achievements.ini format parser
export function parseGoldbergAchievements(iniContent: string): SteamAchievement[] {
  const achievements: SteamAchievement[] = []
  const lines = iniContent.split('\n')

  for (const line of lines) {
    // Format: achievement_id=achieved:unlocked_time
    const match = line.match(/^(\d+)=(\d+):(\d+)$/)
    if (match) {
      achievements.push({
        id: `achv_${match[1]}`,
        appid: 'current',
        name: `Achievement ${match[1]}`,
        displayName: `Achievement ${match[1]}`,
        description: '',
        icon: '',
        achieved: match[2] === '1',
        unlockTime: parseInt(match[3], 10),
        hidden: false,
      })
    }
  }

  return achievements
}

// SSE achievements format (key-value pairs)
export function parseSSEAchievements(content: string): SteamAchievement[] {
  const achievements: SteamAchievement[] = []
  try {
    const data = JSON.parse(content)
    if (Array.isArray(data.achievements)) {
      for (const ach of data.achievements) {
        achievements.push({
          id: ach.id || `achv_${ach.idx}`,
          appid: data.appid || 'current',
          name: ach.name || `Achievement ${ach.idx}`,
          displayName: ach.displayName || ach.name || `Achievement ${ach.idx}`,
          description: ach.description || '',
          icon: ach.icon || '',
          achieved: ach.achieved || false,
          unlockTime: ach.unlockTime || 0,
          hidden: ach.hidden || false,
        })
      }
    }
  } catch {
    // Not JSON format, try key=value
    const lines = content.split('\n')
    for (const line of lines) {
      const [key, value] = line.split('=')
      if (key && value !== undefined) {
        achievements.push({
          id: key,
          appid: 'current',
          name: key,
          displayName: key,
          description: '',
          icon: '',
          achieved: value === '1',
          unlockTime: 0,
          hidden: false,
        })
      }
    }
  }
  return achievements
}

// Write achievements back to Goldberg format
export function writeGoldbergAchievements(achievements: SteamAchievement[]): string {
  const lines = achievements.map(ach => {
    const idx = ach.id.replace('achv_', '')
    return `${idx}=${ach.achieved ? 1 : 0}:${ach.unlockTime || 0}`
  })
  return lines.join('\n')
}

// Steam API hooks for achievement tracking
// These would be called from the injected DLL
export const STEAM_API_HOOKS = {
  // Called when SteamAPI_Init succeeds
  onSteamInit(appid: string) {
    // Signal that we can watch achievements
  },

  // Called when SteamUserStats()->SetAchievement is invoked
  onSetAchievement(name: string, achieved: boolean) {
    // Track achievement progress
  },

  // Called when SteamUserStats()->StoreStats is invoked (saves achievements)
  onStoreStats() {
    // Persist achievement state
  },

  // Called when SteamUserStats()->IndicateAchievementProgress is invoked
  onProgress(name: string, current: number, max: number) {
    // Track progress achievements
  },
}

// Default Steam achievement definitions (populated from Steam API or local cache)
export const DEFAULT_ACHIEVEMENTS: Record<string, SteamAchievement[]> = {}