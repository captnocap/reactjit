import { exec, writeFile } from '../../host';

export type NanoParams = {
  prompt: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  steps?: number;
  cfg?: number;
  seed?: number;
  model?: string;
  device?: 'cpu' | 'cuda';
  samples?: number;
};

export type NanoResult = {
  pngPath: string | null;
  error: string | null;
  stdout: string;
};

export function nanoGenerate(params: NanoParams): NanoResult {
  const ts = Date.now();
  const paramsPath = `/tmp/nano-params-${ts}.json`;
  const outputPath = `/tmp/nano-out-${ts}.png`;

  if (!writeFile(paramsPath, JSON.stringify(params))) {
    return { pngPath: null, error: 'Failed to write params file', stdout: '' };
  }

  const cmd = `nano-diffusion --params-file "${paramsPath}" --output "${outputPath}" 2>&1 || nanodiffusion --params-file "${paramsPath}" --output "${outputPath}" 2>&1`;
  const stdout = exec(cmd);

  if (stdout.includes('command not found') || stdout.includes('No such file')) {
    exec(`rm -f "${paramsPath}" "${outputPath}"`);
    return { pngPath: null, error: 'nano-diffusion not installed', stdout };
  }

  if (stdout.includes('Error') || stdout.includes('error:')) {
    exec(`rm -f "${paramsPath}" "${outputPath}"`);
    return { pngPath: null, error: stdout.trim() || 'Generation failed', stdout };
  }

  const exists = exec(`test -f "${outputPath}" && echo yes || echo no`).trim() === 'yes';
  exec(`rm -f "${paramsPath}"`);

  if (!exists) {
    return { pngPath: null, error: 'Failed to read generated image', stdout };
  }

  return { pngPath: outputPath, error: null, stdout };
}
