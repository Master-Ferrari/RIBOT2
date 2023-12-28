import { spawn } from 'child_process';
import { printL, format } from './lib/consoleUtils';
import * as path from 'path';

const indexPath = path.join(__dirname, './index.js');

function runChildScript(args: string[]) {
  const child = spawn('node', args, {
    stdio: 'pipe'
  });

  child.stdout.on('data', (data) => {
    console.log(data.toString().trim());
  });

  child.stderr.on('data', (data) => {
    console.error(data.toString().trim());
  });

  child.on('close', (code) => {
    if (code !== 0) {
      printL(format(`RIBA BOT script exited with code ${code}. Restarting...`, { foreground: 'red', bold: true }));
      runChildScript(args);
    } else {
      printL(format('RIBA BOT script exited successfully.', { foreground: 'green', bold: true }));
    }
  });
}

runChildScript([indexPath, ...process.argv.slice(2)]);
