local wezterm = require 'wezterm'
local config = wezterm.config_builder()
local mux = wezterm.mux
local act = wezterm.action
-- ============================================
-- 0. Startup Layout (4-Pane Split)
-- ============================================

-- 멀티플렉서 서버 시작 시 4분할 레이아웃 생성
-- (mux-startup: 서버가 처음 시작될 때만 실행)
wezterm.on('mux-startup', function()
  -- 환경변수에서 설정 읽기
  local cwd = os.getenv('WEZTERM_CWD') or wezterm.home_dir
  local shell_cmd = os.getenv('WEZTERM_SHELL_CMD')
  local workers = tonumber(os.getenv('WEZTERM_WORKERS')) or 3
  local scheduler_cols = tonumber(os.getenv('WEZTERM_SCHEDULER_COLS')) or 100
  local worker_cols = tonumber(os.getenv('WEZTERM_WORKER_COLS')) or 120

  -- 레이아웃:
  -- +------------+-----------+
  -- |            |  Worker 1 |
  -- | Scheduler  +-----------+
  -- |    (0)     |  Worker 2 |
  -- |            +-----------+
  -- |            |  Worker 3 |
  -- +------------+-----------+

  -- 첫 번째 윈도우와 탭 생성 (스케줄러 pane)
  local tab, scheduler_pane, window = mux.spawn_window { cwd = cwd }

  -- 오른쪽에 첫 번째 Worker pane 생성
  local first_worker = scheduler_pane:split {
    direction = 'Right',
    cwd = cwd,
  }

  -- 나머지 Worker panes 생성 (첫 Worker 아래로 수직 분할)
  local prev_pane = first_worker
  for i = 2, workers do
    local worker_pane = prev_pane:split {
      direction = 'Bottom',
      cwd = cwd,
    }
    prev_pane = worker_pane
  end

  -- 스케줄러 명령 실행 (pane 0)
  if shell_cmd then
    scheduler_pane:send_text(shell_cmd .. '\n')
  end

  -- 스케줄러 pane에 포커스
  scheduler_pane:activate()
end)

-- 초기 윈도우 크기: 80x25 * 4 panes = 160 cols x 50 rows
config.initial_cols = 162  -- 80*2 + 분할선 여유
config.initial_rows = 52   -- 25*2 + 분할선 여유

-- ============================================
-- 1. Multiplexer (Unix Domain) Configuration
-- ============================================

-- Unix domain for multiplexer functionality (works on Windows too)
config.unix_domains = {
  {
    name = 'unix',
    -- Socket path (default: auto-generated in user's runtime dir)
    -- socket_path = 'C:/Users/sviso/.local/share/wezterm/sock',
  },
}

-- Auto-connect to unix domain on startup (like tmux attach)
-- Comment this out if you prefer manual connection
config.default_gui_startup_args = { 'connect', 'unix' }

-- ============================================
-- 2. Basic Appearance
-- ============================================

-- Color scheme
config.color_scheme = 'Tokyo Night'

-- Font settings
config.font = wezterm.font('JetBrains Mono', { weight = 'Medium' })
config.font_size = 11.0

-- Window settings
config.window_background_opacity = 0.95
config.window_padding = {
  left = 5,
  right = 5,
  top = 5,
  bottom = 5,
}

-- Tab bar
config.use_fancy_tab_bar = false
config.hide_tab_bar_if_only_one_tab = false
config.tab_bar_at_bottom = true

-- ============================================
-- 3. Key Bindings (tmux-like)
-- ============================================

-- Leader key: CTRL+A (like tmux with prefix)
config.leader = { key = 'a', mods = 'CTRL', timeout_milliseconds = 1000 }

config.keys = {
  {
    key = 'Enter',
    mods = 'NONE',
    action = act.SendKey { key = 'Enter', mods = 'NONE' },
  },
  {
    key = '|',
    mods = 'LEADER|SHIFT',
    action = wezterm.action.SplitHorizontal { domain = 'CurrentPaneDomain'},
  },
  {
    key = '-',
    mods = 'LEADER',
    action = wezterm.action.SplitVertical { domain = 'CurrentPaneDomain' },
  },

  -- Pane navigation (Leader + h/j/k/l)
  {
    key = 'h',
    mods = 'LEADER',
    action = wezterm.action.ActivatePaneDirection 'Left',
  },
  {
    key = 'j',
    mods = 'LEADER',
    action = wezterm.action.ActivatePaneDirection 'Down',
  },
  {
    key = 'k',
    mods = 'LEADER',
    action = wezterm.action.ActivatePaneDirection 'Up',
  },
  {
    key = 'l',
    mods = 'LEADER',
    action = wezterm.action.ActivatePaneDirection 'Right',
  },

  -- Pane resize (Leader + H/J/K/L)
  {
    key = 'H',
    mods = 'LEADER|SHIFT',
    action = wezterm.action.AdjustPaneSize { 'Left', 5 },
  },
  {
    key = 'J',
    mods = 'LEADER|SHIFT',
    action = wezterm.action.AdjustPaneSize { 'Down', 5 },
  },
  {
    key = 'K',
    mods = 'LEADER|SHIFT',
    action = wezterm.action.AdjustPaneSize { 'Up', 5 },
  },
  {
    key = 'L',
    mods = 'LEADER|SHIFT',
    action = wezterm.action.AdjustPaneSize { 'Right', 5 },
  },

  -- New tab (Leader + c)
  {
    key = 'c',
    mods = 'LEADER',
    action = wezterm.action.SpawnTab 'CurrentPaneDomain',
  },

  -- Close pane (Leader + x)
  {
    key = 'x',
    mods = 'LEADER',
    action = wezterm.action.CloseCurrentPane { confirm = true },
  },

  -- Zoom pane toggle (Leader + z)
  {
    key = 'z',
    mods = 'LEADER',
    action = wezterm.action.TogglePaneZoomState,
  },

  -- Tab navigation (Leader + number)
  { key = '1', mods = 'LEADER', action = wezterm.action.ActivateTab(0) },
  { key = '2', mods = 'LEADER', action = wezterm.action.ActivateTab(1) },
  { key = '3', mods = 'LEADER', action = wezterm.action.ActivateTab(2) },
  { key = '4', mods = 'LEADER', action = wezterm.action.ActivateTab(3) },
  { key = '5', mods = 'LEADER', action = wezterm.action.ActivateTab(4) },

  -- Next/Previous tab (Leader + n/p)
  { key = 'n', mods = 'LEADER', action = wezterm.action.ActivateTabRelative(1) },
  { key = 'p', mods = 'LEADER', action = wezterm.action.ActivateTabRelative(-1) },

  -- Copy mode (Leader + [)
  {
    key = '[',
    mods = 'LEADER',
    action = wezterm.action.ActivateCopyMode,
  },

  -- Show launcher (Leader + s)
  {
    key = 's',
    mods = 'LEADER',
    action = wezterm.action.ShowLauncherArgs { flags = 'FUZZY|WORKSPACES' },
  },

  -- Rename tab (Leader + ,)
  {
    key = ',',
    mods = 'LEADER',
    action = wezterm.action.PromptInputLine {
      description = 'Enter new tab name:',
      action = wezterm.action_callback(function(window, pane, line)
        if line then
          window:active_tab():set_title(line)
        end
      end),
    },
  },
}

-- ============================================
-- 4. Mouse Bindings
-- ============================================

config.mouse_bindings = {
  -- Right click paste
  {
    event = { Down = { streak = 1, button = 'Right' } },
    mods = 'NONE',
    action = wezterm.action.PasteFrom 'Clipboard',
  },
}

-- ============================================
-- 5. Misc Settings
-- ============================================

-- Scrollback
config.scrollback_lines = 10000

-- Bell
config.audible_bell = 'Disabled'

-- Cursor
config.default_cursor_style = 'BlinkingBar'
config.cursor_blink_rate = 500
config.enable_csi_u_key_encoding = false
-- Platform-specific default shell
if wezterm.target_triple:find('windows') then
  -- Windows: PowerShell with UTF-8 (일반 쉘로 시작, claude는 launcher가 실행)
  config.default_prog = { 'powershell.exe', '-NoLogo' }
else
  -- Linux/macOS: default shell (bash/zsh)
  -- config.default_prog은 설정하지 않으면 기본 로그인 셸 사용
end



return config
