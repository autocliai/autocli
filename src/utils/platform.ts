import { homedir } from 'os'
import path from 'path'

const home = homedir()
const isWindows = process.platform === 'win32'
const isMac = process.platform === 'darwin'
const isLinux = process.platform === 'linux'

const configDir = isWindows
  ? path.join(process.env.APPDATA || path.join(home, 'AppData', 'Roaming'), 'autocli')
  : path.join(home, '.autocli')

export const platform = {
  home,
  configDir,
  isWindows,
  isMac,
  isLinux,
  shell: process.env.SHELL || (isWindows ? 'cmd.exe' : '/bin/bash'),
  get columns() { return process.stdout.columns || 80 },
  get rows() { return process.stdout.rows || 24 },
}
