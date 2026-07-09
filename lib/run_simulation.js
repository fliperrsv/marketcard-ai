import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function runSimulation(params) {
  const jsonParams = JSON.stringify(params);
  const { stdout, stderr } = await execAsync(
    `python3 lib/simulator.py '${jsonParams}'`
  );
  if (stderr) {
    console.error('Ошибка симулятора:', stderr);
    throw new Error(stderr);
  }
  return JSON.parse(stdout);
}
