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
-- DEFAULTS: 모든 설정 가능한 값을 한 곳에 모음
-- =============================================================================
local DEFAULTS = {
  -- Shell
  default_prog = { 'powershell.exe', '-NoLogo' },

  -- Appearance
  font_family = 'JetBrains Mono',
  font_weight = 'Medium',
  font_size = 11.0,
  color_scheme = 'Tokyo Night',
  window_opacity = 0.95,
  window_padding = { left = 5, right = 5, top = 5, bottom = 5 },
  scrollback_lines = 10000,

  -- Tab bar
  use_fancy_tab_bar = false,
  hide_tab_bar_if_only_one_tab = true,
  tab_bar_at_bottom = true,
  audible_bell = 'Disabled',
  cursor_style = 'BlinkingBar',

  -- Layout
  window_width = 1920,
  window_height = 1080,
  max_rows = 3,
  scheduler_ratio = 0.45,

  -- Commands
  worker_startup_cmd = 'claude --dangerously-skip-permissions',

  -- Timing
  init_delay = 1.5,  -- Windows: 셸 초기화 대기 시간 (초)

  -- Column sizing (magic numbers documented)
  -- WezTerm의 split()이 size 파라미터를 약간 작게 적용하는 문제 보정
  column_size_correction = 0.02,
  max_column_ratio = 0.6,

  -- ===== CPU 최적화 설정 =====
  -- 화면 갱신
  max_fps = 30,                    -- 기본 60 → 30fps (CPU 절약)
  animation_fps = 1,               -- 애니메이션 최소화

  -- 커서 최적화
  cursor_blink_rate = 0,           -- 깜빡임 비활성화 (0 = 끔)

  -- 시각 효과 최적화
  enable_scroll_bar = false,       -- 스크롤바 비활성화
  visual_bell_fade_in = 0,         -- 비주얼 벨 비활성화
  visual_bell_fade_out = 0,

  -- 렌더링 최적화
  front_end = 'OpenGL',            -- WebGpu 대신 OpenGL (더 안정적)

  -- 출력 병합 (CPU 절약)
  mux_output_parser_coalesce_delay_ms = 10,  -- 기본 3ms → 10ms
}

-- =============================================================================
-- WezTerm 기본 설정 (DEFAULTS 사용)
-- =============================================================================
config.default_prog = DEFAULTS.default_prog
config.font = wezterm.font(DEFAULTS.font_family, { weight = DEFAULTS.font_weight })
config.font_size = DEFAULTS.font_size
config.color_scheme = DEFAULTS.color_scheme
config.window_background_opacity = DEFAULTS.window_opacity
config.window_padding = DEFAULTS.window_padding
config.use_fancy_tab_bar = DEFAULTS.use_fancy_tab_bar
config.hide_tab_bar_if_only_one_tab = DEFAULTS.hide_tab_bar_if_only_one_tab
config.tab_bar_at_bottom = DEFAULTS.tab_bar_at_bottom
config.scrollback_lines = DEFAULTS.scrollback_lines
config.audible_bell = DEFAULTS.audible_bell
config.default_cursor_style = DEFAULTS.cursor_style

-- ===== CPU 최적화 설정 적용 =====
config.max_fps = DEFAULTS.max_fps
config.animation_fps = DEFAULTS.animation_fps
config.cursor_blink_rate = DEFAULTS.cursor_blink_rate
config.enable_scroll_bar = DEFAULTS.enable_scroll_bar
config.front_end = DEFAULTS.front_end

config.visual_bell = {
  fade_in_duration_ms = DEFAULTS.visual_bell_fade_in,
  fade_out_duration_ms = DEFAULTS.visual_bell_fade_out,
}

-- =============================================================================
-- 유틸리티 함수
-- =============================================================================

--- 파일을 안전하게 읽기
-- @param path 파일 경로
-- @return content, error_message (실패 시 content는 nil)
local function safe_read_file(path)
  local file, err = io.open(path, 'r')
  if not file then
    return nil, 'Cannot open file: ' .. (err or 'unknown')
  end

  local content = file:read('*a')
  file:close()

  if not content or content == '' then
    return nil, 'Empty file'
  end

  return content, nil
end

--- JSON 문자열 값 파싱 (escape 처리 포함)
-- @param json_str 전체 JSON 문자열
-- @param key 찾을 키
-- @return 값 또는 nil
local function parse_json_string(json_str, key)
  -- 키 위치 찾기
  local key_pattern = '"' .. key .. '"%s*:%s*"'
  local start_pos = json_str:find(key_pattern)
  if not start_pos then
    return nil
  end

  -- 값의 시작 따옴표 위치 찾기
  local value_start = json_str:find('"', start_pos + #key + 3)
  if not value_start then
    return nil
  end

  -- 문자별로 파싱하여 escape 처리
  local result = {}
  local i = value_start + 1
  local len = #json_str

  while i <= len do
    local char = json_str:sub(i, i)

    if char == '\\' and i < len then
      local next_char = json_str:sub(i + 1, i + 1)
      if next_char == '"' then
        table.insert(result, '"')
        i = i + 2
      elseif next_char == '\\' then
        table.insert(result, '\\')
        i = i + 2
      elseif next_char == 'n' then
        table.insert(result, '\n')
        i = i + 2
      elseif next_char == 'r' then
        table.insert(result, '\r')
        i = i + 2
      elseif next_char == 't' then
        table.insert(result, '\t')
        i = i + 2
      else
        table.insert(result, char)
        i = i + 1
      end
    elseif char == '"' then
      -- 문자열 끝
      return table.concat(result)
    else
      table.insert(result, char)
      i = i + 1
    end
  end

  return nil  -- 닫히지 않은 문자열
end

--- JSON 숫자 값 파싱
-- @param json_str 전체 JSON 문자열
-- @param key 찾을 키
-- @return 숫자 또는 nil
local function parse_json_number(json_str, key)
  local pattern = '"' .. key .. '"%s*:%s*([%-]?[%d%.]+)'
  local value_str = json_str:match(pattern)
  return value_str and tonumber(value_str)
end

--- pane_startup 객체 파싱
-- @param json_str 전체 JSON 문자열
-- @return {[worker_num] = cmd} 테이블
local function parse_pane_startup(json_str)
  local result = {}
  local obj_str = json_str:match('"pane_startup"%s*:%s*({.-})') or '{}'

  for k, v in string.gmatch(obj_str, '"(%d+)"%s*:%s*"([^"]*)"') do
    result[tonumber(k)] = v
  end

  return result
end

--- Worker 분배 계산
-- @param workers 총 Worker 수
-- @param max_rows 열당 최대 Worker 수
-- @return workers_per_column 테이블, columns 수
local function calculate_worker_distribution(workers, max_rows)
  local columns = math.ceil(workers / max_rows)
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

  return workers_per_column, columns
end

--- 열 내에서 행 분할
-- @param col_pane 분할할 열 pane
-- @param rows 생성할 행 수
-- @param cwd 작업 디렉토리
-- @return pane 테이블
local function split_rows_in_column(col_pane, rows, cwd)
  local panes = { col_pane }

  for row = 1, rows - 1 do
    local remaining = rows - row
    local size = remaining / (remaining + 1)
    local bottom = panes[row]:split {
      direction = 'Bottom',
      size = size,
      cwd = cwd,
    }
    if bottom then
      table.insert(panes, bottom)
    end
  end

  return panes
end

--- Worker pane 전체 생성
-- @param scheduler_pane 스케줄러 pane
-- @param startup_config 시작 설정
-- @return worker_panes 테이블
local function create_worker_panes(scheduler_pane, startup_config)
  local workers_per_column, columns = calculate_worker_distribution(
    startup_config.workers,
    startup_config.max_rows
  )

  local worker_ratio = 1 - startup_config.scheduler_ratio
  local worker_panes = {}

  -- 1단계: Worker 영역 생성
  local worker_area = scheduler_pane:split {
    direction = 'Right',
    size = worker_ratio,
    cwd = startup_config.cwd,
  }

  if not worker_area then
    wezterm.log_error('[orchay] Failed to create worker area')
    return {}
  end

  -- 2단계: 열/행 분할
  if columns == 1 then
    local panes = split_rows_in_column(worker_area, workers_per_column[1], startup_config.cwd)
    for _, pane in ipairs(panes) do
      table.insert(worker_panes, pane)
    end
  else
    -- 다중 열
    local col_areas = {}
    local remaining_area = worker_area

    for col = columns, 2, -1 do
      local base_size = 1 / col
      local adjusted_size = math.min(
        base_size + DEFAULTS.column_size_correction,
        DEFAULTS.max_column_ratio
      )
      local new_col = remaining_area:split {
        direction = 'Right',
        size = adjusted_size,
        cwd = startup_config.cwd,
      }
      if new_col then
        table.insert(col_areas, 1, new_col)
      end
    end
    table.insert(col_areas, 1, remaining_area)

    -- 각 열에서 행 분할
    for col = 1, columns do
      if col <= #col_areas then
        local panes = split_rows_in_column(
          col_areas[col],
          workers_per_column[col],
          startup_config.cwd
        )
        for _, pane in ipairs(panes) do
          table.insert(worker_panes, pane)
        end
      end
    end
  end

  return worker_panes
end

-- =============================================================================
-- gui-startup 이벤트 핸들러 (단순화됨)
-- =============================================================================
wezterm.on('gui-startup', function(cmd)
  -- 1. 설정 파일 읽기
  local home = wezterm.home_dir
  local startup_file = home .. '/.config/wezterm/orchay-startup.json'

  local content, read_err = safe_read_file(startup_file)
  if not content then
    -- 설정 파일 없으면 일반 시작
    return
  end

  -- 2. JSON 파싱
  local startup_config = {
    cwd = parse_json_string(content, 'cwd'),
    workers = parse_json_number(content, 'workers') or 0,
    scheduler_cmd = parse_json_string(content, 'scheduler_cmd'),
    width = parse_json_number(content, 'width') or DEFAULTS.window_width,
    height = parse_json_number(content, 'height') or DEFAULTS.window_height,
    max_rows = parse_json_number(content, 'max_rows') or DEFAULTS.max_rows,
    scheduler_ratio = parse_json_number(content, 'scheduler_ratio') or DEFAULTS.scheduler_ratio,
    worker_startup_cmd = parse_json_string(content, 'worker_startup_cmd') or DEFAULTS.worker_startup_cmd,
    pane_startup = parse_pane_startup(content),
  }

  -- 3. 유효성 검증
  if not startup_config.cwd or startup_config.workers < 1 then
    return
  end

  -- 4. Windows 백슬래시 처리
  startup_config.cwd = startup_config.cwd:gsub('\\\\', '\\')
  if startup_config.scheduler_cmd then
    startup_config.scheduler_cmd = startup_config.scheduler_cmd:gsub('\\\\', '\\')
  end

  -- 5. 설정 파일 삭제 (일회용)
  os.remove(startup_file)

  -- 6. 창 및 레이아웃 생성
  local tab, scheduler_pane, window = mux.spawn_window { cwd = startup_config.cwd }
  window:gui_window():set_inner_size(startup_config.width, startup_config.height)

  -- 7. Worker pane 생성
  local worker_panes = create_worker_panes(scheduler_pane, startup_config)
  if #worker_panes == 0 then
    wezterm.log_error('[orchay] No worker panes created')
    return
  end

  -- 8. 스케줄러 pane에 포커스
  scheduler_pane:activate()

  -- 9. 명령 전송 (셸 초기화 대기 후)
  wezterm.time.call_after(DEFAULTS.init_delay, function()
    -- Worker에 startup 명령 전송
    for worker_num, pane in ipairs(worker_panes) do
      local cmd = startup_config.pane_startup[worker_num] or startup_config.worker_startup_cmd
      pane:send_text(cmd .. '\r')
    end

    -- 스케줄러 명령 전송
    if startup_config.scheduler_cmd then
      scheduler_pane:send_text(startup_config.scheduler_cmd .. '\r')
    end
  end)
end)

-- =============================================================================
-- 설정 반환
-- =============================================================================
return config
