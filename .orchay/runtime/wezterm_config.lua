
local wezterm = require 'wezterm'
return {
    unix_domains = {
        {
            name = 'orchay',
            socket_path = '\\\\.\\pipe\\orchay-31636',
            serve_command = { 'wezterm-mux-server', '--daemonize' },
        }
    },
    default_gui_startup_args = { 'connect', 'orchay' },
    default_prog = { 'powershell.exe' },
    enable_tab_bar = false,
    window_decorations = "RESIZE",
    check_for_updates = false,
}
