#!/usr/bin/env node
// Frees the configured PORT by killing whatever process is currently listening on it.
// Used by `npm run stop` and as a pre-start/pre-dev step so a stale server instance
// left running from a previous session never blocks the next one with EADDRINUSE.
require('dotenv').config();
const { execSync } = require('child_process');

const port = Number(process.argv[2] || process.env.PORT || 3000);

function killWindows(port) {
  const netstat = execSync(`netstat -ano -p tcp`, { encoding: 'utf8' });
  const pids = new Set();
  for (const line of netstat.split('\n')) {
    const match = line.match(/^\s*TCP\s+\S+:(\d+)\s+\S+\s+LISTENING\s+(\d+)\s*$/i);
    if (match && Number(match[1]) === port) {
      pids.add(match[2]);
    }
  }
  for (const pid of pids) {
    execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
    console.log(`Freed port ${port} (killed PID ${pid})`);
  }
  return pids.size > 0;
}

function killPosix(port) {
  let pids;
  try {
    pids = execSync(`lsof -ti tcp:${port}`, { encoding: 'utf8' }).trim();
  } catch {
    pids = '';
  }
  if (!pids) return false;
  for (const pid of pids.split('\n').filter(Boolean)) {
    execSync(`kill -9 ${pid}`, { stdio: 'ignore' });
    console.log(`Freed port ${port} (killed PID ${pid})`);
  }
  return true;
}

try {
  const killed = process.platform === 'win32' ? killWindows(port) : killPosix(port);
  if (!killed) console.log(`Port ${port} was already free.`);
} catch (err) {
  console.warn(`Could not check/free port ${port}: ${err.message}`);
}
