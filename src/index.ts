#!/usr/bin/env node

import { Command } from 'commander';
import { scanCommand } from './commands/scan';
import { scoreCommand } from './commands/score';
import { readFileSync } from 'fs';
import { join } from 'path';

// Read version from package.json
const packageJson = JSON.parse(
  readFileSync(join(__dirname, '../package.json'), 'utf-8')
);

const program = new Command();

program
  .name('philcom')
  .description('CLI tool for scanning and operations')
  .version(packageJson.version);

// Register commands
program.addCommand(scanCommand);
program.addCommand(scoreCommand);

program.parse(process.argv);
