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

  -- 열 수 계산 (max_rows 기준)
  local columns = math.ceil(workers / max_rows)
  local workers_per_column = {}
  local remaining_workers = workers
  for col = 1, columns do
    local in_this_col = math.min(remaining_workers, max_rows)
    table.insert(workers_per_column, in_this_col)
    remaining_workers = remaining_workers - in_this_col
  end

  -- Worker pane 목록 저장 (나중에 명령 전송용)
  local worker_panes = {}

  -- 첫 번째 열의 첫 번째 Worker pane 생성 (오른쪽에)
  local first_worker = scheduler_pane:split {
    direction = 'Right',
    size = worker_ratio,  -- orchay.yaml 설정 적용
    cwd = cwd,
  }
  table.insert(worker_panes, first_worker)

  -- 첫 번째 열 내 나머지 Workers (세로 분할)
  local prev_pane = first_worker
  for row = 2, workers_per_column[1] do
    local remaining = workers_per_column[1] - row + 1
    local size = remaining / (remaining + 1)
    local worker_pane = prev_pane:split {
      direction = 'Bottom',
      size = size,
      cwd = cwd,
    }
    table.insert(worker_panes, worker_pane)
    prev_pane = worker_pane
  end

  -- 추가 열 생성 (workers > max_rows인 경우)
  if columns > 1 then
    local col_first_pane = first_worker
    for col = 2, columns do
      -- 열 분할 비율 계산
      local col_remaining = columns - col + 1
      local col_size = col_remaining / (col_remaining + 1)

      -- 새 열의 첫 번째 pane (오른쪽에)
      local new_col_pane = col_first_pane:split {
        direction = 'Right',
        size = col_size,
        cwd = cwd,
      }
      table.insert(worker_panes, new_col_pane)

      -- 열 내 나머지 Workers (세로 분할)
      prev_pane = new_col_pane
      for row = 2, workers_per_column[col] do
        local remaining = workers_per_column[col] - row + 1
        local size = remaining / (remaining + 1)
        local worker_pane = prev_pane:split {
          direction = 'Bottom',
          size = size,
          cwd = cwd,
        }
        table.insert(worker_panes, worker_pane)
        prev_pane = worker_pane
      end

      col_first_pane = new_col_pane
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
