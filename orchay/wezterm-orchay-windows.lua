-- =============================================================================
-- Orchay Launcher for WezTerm (Windows 전용)
-- =============================================================================
-- 이 파일은 orchay launcher가 Windows에서 자동으로 사용합니다.
-- ~/.wezterm.lua 없이 독립적으로 동작합니다.
--
-- 수동 사용:
--   wezterm --config-file wezterm-orchay-windows.lua start
-- =============================================================================

local wezterm = require 'wezterm'
local config = wezterm.config_builder()
local mux = wezterm.mux

-- =============================================================================
-- 기본 설정 (필요시 수정)
-- =============================================================================
config.default_prog = { 'powershell.exe', '-NoLogo' }  -- Windows
-- config.default_prog = { '/bin/bash' }  -- Linux/macOS

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
-- Orchay gui-startup 이벤트
-- =============================================================================

-- gui-startup 이벤트: wezterm start 실행 시 발생
-- mux-startup과 달리 CLI 소켓 연결 없이 내부 API로 레이아웃 생성
-- 참고: https://wezterm.org/config/lua/gui-events/gui-startup.html
wezterm.on('gui-startup', function(cmd)
  -- 설정 파일 경로: ~/.config/wezterm/orchay-startup.json
  local home = wezterm.home_dir
  local startup_file = home .. '/.config/wezterm/orchay-startup.json'

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

  -- launcher 설정 파싱 (orchay.yaml에서 전달됨)
  local width = tonumber(content:match('"width"%s*:%s*(%d+)')) or 1920
  local height = tonumber(content:match('"height"%s*:%s*(%d+)')) or 1080
  local max_rows = tonumber(content:match('"max_rows"%s*:%s*(%d+)')) or 3
  local scheduler_ratio = tonumber(content:match('"scheduler_ratio"%s*:%s*([%d%.]+)')) or 0.45

  -- 설정이 유효하지 않으면 일반 시작
  if not cwd or workers == 0 then
    return
  end

  -- Windows 백슬래시 이스케이프 처리 (cwd와 scheduler_cmd 모두)
  cwd = cwd:gsub('\\\\', '\\')
  if scheduler_cmd then
    scheduler_cmd = scheduler_cmd:gsub('\\\\', '\\')
  end

  -- 파일 삭제 (일회용)
  os.remove(startup_file)

  -- 레이아웃 생성
  local tab, scheduler_pane, window = mux.spawn_window { cwd = cwd }

  -- 창 크기 설정 (orchay.yaml의 width, height 적용)
  window:gui_window():set_inner_size(width, height)

  -- Worker pane 비율 계산 (1 - scheduler_ratio)
  local worker_ratio = 1 - scheduler_ratio

  -- ==========================================================================
  -- Worker 분배 계산 (균형 분배)
  -- ==========================================================================
  -- 목표 레이아웃:
  -- Workers 1-3: 1열          Workers 4-6: 2열
  -- +--------+------+         +--------+------+------+
  -- |        | W1   |         |        | W1   | W4   |
  -- | Sched  +------+         | Sched  +------+------+
  -- |        | W2   |         |        | W2   | W5   |
  -- |        +------+         |        +------+------+
  -- |        | W3   |         |        | W3   | W6   |
  -- +--------+------+         +--------+------+------+
  --
  -- 분배 규칙:
  -- - 4 workers: [2, 2] (균등)
  -- - 5 workers: [3, 2] (첫 열에 1개 더)
  -- - 6 workers: [3, 3] (균등)

  local columns = math.ceil(workers / max_rows)

  -- 균형 분배: 각 열에 가능한 균등하게 배분
  local workers_per_column = {}
  local base_per_col = math.floor(workers / columns)
  local extra = workers % columns

  for col = 1, columns do
    -- 앞쪽 열부터 extra 개만큼 1씩 추가
    if col <= extra then
      table.insert(workers_per_column, base_per_col + 1)
    else
      table.insert(workers_per_column, base_per_col)
    end
  end

  -- ==========================================================================
  -- Pane 분할 (단순화된 버전)
  -- ==========================================================================
  -- WezTerm split('Right', size=0.5):
  --   - 원본 pane이 왼쪽에 남고 (50%)
  --   - 새 pane이 오른쪽에 생성 (50%)
  --
  -- WezTerm split('Bottom', size=0.5):
  --   - 원본 pane이 위쪽에 남고 (50%)
  --   - 새 pane이 아래쪽에 생성 (50%)

  local worker_panes = {}

  -- 1단계: Worker 영역 생성 (scheduler 오른쪽)
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

    -- 세로 분할: 위에서 아래로
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
    -- 2열: 먼저 좌우 분할, 그 다음 각 열 세로 분할
    -- 2열일 때 size=0.5면 원본(왼쪽)이 50%, 새것(오른쪽)이 50%
    local col2_area = worker_area:split {
      direction = 'Right',
      size = 0.5,
      cwd = cwd,
    }
    local col1_area = worker_area  -- 원본이 col1 (왼쪽)

    local col_areas = { col1_area, col2_area }

    -- 각 열에서 세로 분할
    for col = 1, 2 do
      local col_pane = col_areas[col]
      local rows = workers_per_column[col]
      local col_panes = { col_pane }

      -- 세로 분할: 위에서 아래로
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

  -- 1.5초 후에 명령 전송 (셸 초기화 대기)
  -- Windows PowerShell에서는 \r이 엔터키로 인식됨
  wezterm.time.call_after(1.5, function()
    -- Worker panes에 claude 명령 전송
    for _, pane in ipairs(worker_panes) do
      pane:send_text('claude --dangerously-skip-permissions\r')
    end

    -- 스케줄러 명령 실행 (있으면)
    if scheduler_cmd then
      scheduler_pane:send_text(scheduler_cmd .. '\r')
    end
  end)
end)

-- =============================================================================
-- 설정 반환
-- =============================================================================
return config
