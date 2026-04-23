import { exec } from '../../host';

export type NanoProbeResult = {
  found: boolean;
  path: string | null;
  version: string | null;
  packageManager: 'cargo' | 'pip' | 'apt' | 'unknown';
};

function detectPackageManager(): 'cargo' | 'pip' | 'apt' | 'unknown' {
  if (exec('which cargo 2>/dev/null').trim()) return 'cargo';
  if (exec('which pip 2>/dev/null').trim() || exec('which pip3 2>/dev/null').trim()) return 'pip';
  if (exec('which apt 2>/dev/null').trim()) return 'apt';
  return 'unknown';
}

export function probeNanoDiffusion(): NanoProbeResult {
  const path = exec('which nano-diffusion 2>/dev/null || which nanodiffusion 2>/dev/null').trim().split('\n')[0] || null;
  if (!path) {
    return { found: false, path: null, version: null, packageManager: detectPackageManager() };
  }
  const version = exec('nano-diffusion --version 2>/dev/null || nanodiffusion --version 2>/dev/null').trim() || null;
  return { found: true, path, version, packageManager: detectPackageManager() };
}

export function installCommand(): string {
  const pm = detectPackageManager();
  switch (pm) {
    case 'cargo': return 'cargo install nano-diffusion';
    case 'pip': return 'pip install nano-diffusion';
    case 'apt': return 'apt install nano-diffusion';
    default: return 'cargo install nano-diffusion  ||  pip install nano-diffusion  ||  apt install nano-diffusion';
  }
}

export function installHint(): string {
  return 'nano-diffusion not found. Install: ' + installCommand();
}
