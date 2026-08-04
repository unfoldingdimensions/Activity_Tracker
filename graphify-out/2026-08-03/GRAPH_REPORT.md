# Graph Report - .  (2026-08-03)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 655 nodes · 1335 edges · 51 communities (31 shown, 20 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 4 edges (avg confidence: 0.82)
- Token cost: 1,614 input · 554 output

## Community Hubs (Navigation)
- Chart Components
- Usage Tracking Hooks
- Development Dependencies
- Input Monitoring Service
- Backend Command Handlers
- Database Operations
- Frontend Dependencies
- App TypeScript Configuration
- User Stats and Icons
- Node TypeScript Configuration
- System Icon Extraction
- Tauri App Configuration
- Settings and Filters
- Windows System API
- App Entry and Layout
- Chart Error Handling
- Toast Notification System
- Dashboard Unit Tests
- Tauri Permissions
- Settings and Tracking Hooks
- Startup Loading Screen
- Theme Management
- UI Button Component
- React Error Boundary
- Page Transition Animations
- Project Documentation
- TypeScript Project References
- HTML Entry Point
- High Resolution Icons
- Large Windows Logos
- Date Filter Documentation
- Memory Optimization Documentation
- Vite Assets
- React Assets
- Small App Icon
- Medium Square Logo
- Standard Square Logo
- Retina Square Logo
- Tiny Square Logo
- Small Square Logo
- Compact Square Logo
- Large Square Logo
- Store Listing Logo

## God Nodes (most connected - your core abstractions)
1. `Tracker` - 28 edges
2. `AppState` - 23 edges
3. `isTauri()` - 23 edges
4. `GlassCard()` - 20 edges
5. `compilerOptions` - 20 edges
6. `compilerOptions` - 18 edges
7. `useDashboardData()` - 16 edges
8. `useAppUsage()` - 14 edges
9. `useInputHistory()` - 13 edges
10. `useUserStats()` - 11 edges

## Surprising Connections (you probably didn't know these)
- `AppState` --references--> `Tracker`  [EXTRACTED]
  src-tauri/src/commands.rs → src-tauri/src/tracker.rs
- `useUserStats()` --calls--> `getUserStats()`  [EXTRACTED]
  src/hooks/queries/useGamification.ts → src/api/tauri.ts
- `InputHistoryModal()` --calls--> `useInputHistory()`  [EXTRACTED]
  src/components/InputHistoryModal.tsx → src/hooks/queries/useSystem.ts
- `Layout()` --calls--> `formatAppName()`  [EXTRACTED]
  src/components/Layout.tsx → src/utils/formatters.ts
- `Achievements()` --calls--> `useUnlockedAchievements()`  [EXTRACTED]
  src/components/gamification/Achievements.tsx → src/hooks/queries/useGamification.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Application Branding Assets** — src_tauri_icons_128x128, src_tauri_icons_128x128_2x, src_tauri_icons_32x32, src_tauri_icons_square107x107logo, src_tauri_icons_square142x142logo, src_tauri_icons_square150x150logo, src_tauri_icons_square284x284logo, src_tauri_icons_square30x30logo, src_tauri_icons_square310x310logo, src_tauri_icons_square44x44logo, src_tauri_icons_square71x71logo, src_tauri_icons_square89x89logo, src_tauri_icons_storelogo [EXTRACTED 1.00]

## Communities (51 total, 20 thin omitted)

### Community 0 - "Chart Components"
Cohesion: 0.05
Nodes (59): ChartGradients(), ChartTooltip(), AppUsageChart, AppUsageChartProps, AppUsageDataPoint, FocusFlowChart, FocusFlowChartProps, FocusFlowDataPoint (+51 more)

### Community 1 - "Usage Tracking Hooks"
Cohesion: 0.07
Nodes (66): ActiveWindow, AppUsageEntry, DailyStats, getActiveWindow(), getAppUsage(), getAppUsageRange(), getDailyStats(), getIdleSeconds() (+58 more)

### Community 2 - "Development Dependencies"
Cohesion: 0.04
Nodes (45): eslint, @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh, globals, jsdom, msw, devDependencies (+37 more)

### Community 3 - "Input Monitoring Service"
Cohesion: 0.08
Nodes (20): Error, InputCounts, InputMonitor, Arc, Mutex, Self, ActiveWindow, Arc (+12 more)

### Community 4 - "Backend Command Handlers"
Cohesion: 0.13
Nodes (41): AppHandle, AppUsageEntry, InputHistoryBucket, AppState, AppUsageEntry, clear_data(), get_active_window(), get_activity_timeline() (+33 more)

### Community 5 - "Database Operations"
Cohesion: 0.13
Nodes (41): add_xp(), cleanup_old_input_activity(), cleanup_old_snapshots(), cleanup_old_window_events(), clear_database(), DailyStats, get_activity_timeline(), get_app_usage() (+33 more)

### Community 6 - "Frontend Dependencies"
Cohesion: 0.06
Nodes (35): clsx, framer-motion, lucide-react, dependencies, clsx, framer-motion, lucide-react, react (+27 more)

### Community 7 - "App TypeScript Configuration"
Cohesion: 0.07
Nodes (26): DOM, DOM.Iterable, ES2022, src, vite/client, compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly (+18 more)

### Community 8 - "User Stats and Icons"
Cohesion: 0.16
Nodes (17): StreakCounter(), navItems, AppIcon, AppIconProps, iconCache, DailyGoal, GoalSetter(), useUserStats() (+9 more)

### Community 9 - "Node TypeScript Configuration"
Cohesion: 0.09
Nodes (22): ES2023, node, vite.config.ts, compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module (+14 more)

### Community 10 - "System Icon Extraction"
Cohesion: 0.19
Nodes (16): HashMap, HICON, Path, extract_icon_to_png(), get_app_icon_base64(), hicon_to_png(), IconSystem, LruCache (+8 more)

### Community 11 - "Tauri App Configuration"
Cohesion: 0.09
Nodes (21): icons/128x128@2x.png, icons/128x128.png, icons/32x32.png, icons/icon.ico, app, security, windows, build (+13 more)

### Community 12 - "Settings and Filters"
Cohesion: 0.16
Nodes (10): RANGES, TimeRange, TimeRangeFilter(), TimeRangeFilterProps, SettingsContext, SettingsContextType, UserSettings, DEFAULT_SETTINGS (+2 more)

### Community 13 - "Windows System API"
Cohesion: 0.36
Nodes (9): ActiveWindow, get_active_window(), get_idle_seconds(), get_process_name(), get_timestamp(), get_today(), is_system_idle(), Option (+1 more)

### Community 14 - "App Entry and Layout"
Cohesion: 0.25
Nodes (5): queryClient, RefreshHandler(), ToastProvider(), formatTimelineForChart(), ActivityPage()

### Community 15 - "Chart Error Handling"
Cohesion: 0.39
Nodes (6): ChartErrorBoundary(), ChartErrorFallback(), ChartErrorFallbackProps, isNetworkError(), QueryErrorFallback(), QueryErrorFallbackProps

### Community 16 - "Toast Notification System"
Cohesion: 0.22
Nodes (6): Toast, TOAST_COLORS, TOAST_ICONS, ToastContext, ToastContextValue, ToastType

### Community 17 - "Dashboard Unit Tests"
Cohesion: 0.36
Nodes (6): Dashboard(), defaultRes, mocks, createTestQueryClient(), createWrapper(), renderWithClient()

### Community 18 - "Tauri Permissions"
Cohesion: 0.25
Nodes (7): core:default, main, description, identifier, permissions, $schema, windows

### Community 19 - "Settings and Tracking Hooks"
Cohesion: 0.46
Nodes (7): clearData(), startTracking(), stopTracking(), useToast(), useTheme(), useSettings(), Settings()

### Community 20 - "Startup Loading Screen"
Cohesion: 0.29
Nodes (5): LoadingScreen(), LoadingScreenProps, StartupContext, StartupContextType, StartupProvider()

### Community 21 - "Theme Management"
Cohesion: 0.36
Nodes (5): Theme, ThemeContext, ThemeContextType, Theme, ThemeProvider()

### Community 22 - "UI Button Component"
Cohesion: 0.29
Nodes (6): Button(), ButtonProps, ButtonSize, ButtonVariant, sizeStyles, variantStyles

## Knowledge Gaps
- **190 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+185 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **20 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Tracker` connect `Input Monitoring Service` to `Backend Command Handlers`?**
  _High betweenness centrality (0.025) - this node is a cross-community bridge._
- **Why does `devDependencies` connect `Development Dependencies` to `Frontend Dependencies`?**
  _High betweenness centrality (0.012) - this node is a cross-community bridge._
- **Why does `GlassCard()` connect `Chart Components` to `User Stats and Icons`, `Usage Tracking Hooks`, `Settings and Tracking Hooks`, `Chart Error Handling`?**
  _High betweenness centrality (0.011) - this node is a cross-community bridge._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _190 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Chart Components` be split into smaller, more focused modules?**
  _Cohesion score 0.05274725274725275 - nodes in this community are weakly interconnected._
- **Should `Usage Tracking Hooks` be split into smaller, more focused modules?**
  _Cohesion score 0.06687565308254964 - nodes in this community are weakly interconnected._
- **Should `Development Dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.044444444444444446 - nodes in this community are weakly interconnected._