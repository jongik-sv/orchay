-- =============================================================================
-- Orchay Launcher for WezTerm (Cross-Platform)
-- =============================================================================
-- 이 파일은 orchay launcher가 자동으로 사용합니다.
-- Windows, Linux, macOS에서 동일하게 동작합니다.
--
-- 수동 사용:
--   wezterm --config-file wezterm-orchay.lua start
-- =============================================================================

local wezterm = require 'wezterm'
local config = wezterm.config_builder()
local mux = wezterm.mux

-- =============================================================================
-- 플랫폼 감지
-- =============================================================================
local is_windows = wezterm.target_triple:find('windows') ~= nil
local is_macos = wezterm.target_triple:find('darwin') ~= nil
local is_linux = wezterm.target_triple:find('linux') ~= nil

-- =============================================================================
-- 플랫폼별 기본 셸 설정
-- =============================================================================
if is_windows then
  config.default_prog = { 'powershell.exe', '-NoLogo' }
elseif is_macos then
  -- macOS: 기본 로그인 셸 사용 (zsh)
  config.default_prog = nil
else
  -- Linux: 기본 로그인 셸 사용 (bash/zsh)
  config.default_prog = nil
end

-- =============================================================================
-- 기본 설정
-- =============================================================================
config.font = wezterm.font('JetBrains Mono', { weight = 'Medium' })
config.font_size = 11.0
config.color_scheme = 'Tokyo Night'

config.window_background_opacity = 0.95
config.window_padding = { left = 5, right = 5, top = 5, bottom = 5 }

config.use_fancy_tab_bar = false
config.hide_tab_bar_if_only_one_tab = true
config.tab_bar_at_bottom = true

config.scrollback_lines = 10000
config.audible_bell = 'Disabled'
config.default_cursor_style = 'BlinkingBar'

-- =============================================================================
-- 설정 디렉토리 경로 (플랫폼별)
-- =============================================================================
local function get_config_dir()
  local home = wezterm.home_dir
  if is_windows then
    return home .. '/.config/wezterm'  -- Windows도 .config 사용 (일관성)
  elseif is_macos then
    return home .. '/Library/Application Support/wezterm'
  else
    return home .. '/.config/wezterm'
  end
end

-- =============================================================================
-- Orchay gui-startup 이벤트
-- =============================================================================

-- gui-startup 이벤트: wezterm start 실행 시 발생
-- mux-startup과 달리 CLI 소켓 연결 없이 내부 API로 레이아웃 생성
-- 참고: https://wezterm.org/config/lua/gui-events/gui-startup.html
wezterm.on('gui-startup', function(cmd)
  -- 설정 파일 경로
  local config_dir = get_config_dir()
  local startup_file = config_dir .. '/orchay-startup.json'

  -- 설정 파일 읽기
  local file = io.open(startup_file, 'r')
  if not file then
    -- 설정 파일 없으면 일반 시작 (레이아웃 생성 안함)
    return
  end

  local content = file:read('*a')
  file:close()

  -- JSON 파싱 (간단한 패턴 매칭)
  local cwd = content:match('"cwd"%s*:%s*"([^"]+)"')
  local workers_str = content:match('"workers"%s*:%s*(%d+)')
  local workers = tonumber(workers_str) or 0
  local scheduler_cmd = content:match('"scheduler_cmd"%s*:%s*"([^"]+)"')

  -- launcher 설정 파싱
  local width = tonumber(content:match('"width"%s*:%s*(%d+)')) or 1920
  local height = tonumber(content:match('"height"%s*:%s*(%d+)')) or 1080
  local max_rows = tonumber(content:match('"max_rows"%s*:%s*(%d+)')) or 3
  local scheduler_ratio = tonumber(content:match('"scheduler_ratio"%s*:%s*([%d%.]+)')) or 0.45

  -- 설정이 유효하지 않으면 일반 시작
  if not cwd or workers == 0 then
    return
  end

  -- 경로 이스케이프 처리 (Windows 백슬래시)
  if is_windows then
    cwd = cwd:gsub('\\\\', '\\')
    if scheduler_cmd then
      scheduler_cmd = scheduler_cmd:gsub('\\\\', '\\')
    end
  end

  -- 파일 삭제 (일회용)
  os.remove(startup_file)

  -- 레이아웃 생성
  local tab, scheduler_pane, window = mux.spawn_window { cwd = cwd }

  -- 창 크기 설정
  window:gui_window():set_inner_size(width, height)

  -- Worker pane 비율 계산
  local worker_ratio = 1 - scheduler_ratio

  -- ==========================================================================
  -- Worker 분배 계산 (균형 분배)
  -- ==========================================================================
  local columns = math.ceil(workers / max_rows)

  -- 균형 분배: 각 열에 균등하게 배분
  local workers_per_column = {}
  local base_per_col = math.floor(workers / columns)
  local extra = workers % columns

  for col = 1, columns do
    if col <= extra then
      table.insert(workers_per_column, base_per_col + 1)
    else
      table.insert(workers_per_column, base_per_col)
    end
  end

  -- ==========================================================================
  -- Pane 분할
  -- ==========================================================================
  local worker_panes = {}

  -- 1단계: Worker 영역 생성
  local worker_area = scheduler_pane:split {
    direction = 'Right',
    size = worker_ratio,
    cwd = cwd,
  }

  -- 2단계: 열과 행 분할
  if columns == 1 then
    -- 1열: 세로로만 분할
    local col_panes = { worker_area }
    local rows = workers_per_column[1]

    for row = 1, rows - 1 do
      local remaining_rows = rows - row
      local size = remaining_rows / (remaining_rows + 1)
      local bottom_pane = col_panes[row]:split {
        direction = 'Bottom',
        size = size,
        cwd = cwd,
      }
      table.insert(col_panes, bottom_pane)
    end

    for _, pane in ipairs(col_panes) do
      table.insert(worker_panes, pane)
    end

  else
    -- 다중 열: 오른쪽부터 순차적으로 분할
    local col_areas = {}
    local remaining_area = worker_area

    for col = columns, 2, -1 do
      local base_size = 1 / col
      -- Windows/macOS/Linux 모두 약간의 보정 적용
      local adjusted_size = math.min(base_size + 0.02, 0.6)
      local new_col = remaining_area:split {
        direction = 'Right',
        size = adjusted_size,
        cwd = cwd,
      }
      table.insert(col_areas, 1, new_col)
    end
    table.insert(col_areas, 1, remaining_area)

    -- 각 열에서 세로 분할
    for col = 1, columns do
      local col_pane = col_areas[col]
      local rows = workers_per_column[col]
      local col_panes = { col_pane }

      for row = 1, rows - 1 do
        local remaining_rows = rows - row
        local size = remaining_rows / (remaining_rows + 1)
        local bottom_pane = col_panes[row]:split {
          direction = 'Bottom',
          size = size,
          cwd = cwd,
        }
        table.insert(col_panes, bottom_pane)
      end

      for _, pane in ipairs(col_panes) do
        table.insert(worker_panes, pane)
      end
    end
  end

  -- 스케줄러 pane에 포커스
  scheduler_pane:activate()

  -- 셸 초기화 대기 후 명령 전송
  -- 플랫폼별 엔터키 처리
  local enter_key = is_windows and '\r' or '\n'
  local init_delay = is_windows and 1.5 or 1.0  -- Windows는 조금 더 대기

  wezterm.time.call_after(init_delay, function()
    -- Worker panes에 claude 명령 전송
    for _, pane in ipairs(worker_panes) do
      pane:send_text('claude --dangerously-skip-permissions' .. enter_key)
    end

    -- 스케줄러 명령 실행
    if scheduler_cmd then
      scheduler_pane:send_text(scheduler_cmd .. enter_key)
    end
  end)
end)

-- =============================================================================
-- 설정 반환
-- =============================================================================
return config
