#!/usr/bin/env node

import { program } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import prompts from 'prompts';
import { installSkill } from './commands/install.js';
import { listSkills } from './commands/list.js';
import { searchSkills } from './commands/search.js';
import { updateSkill } from './commands/update.js';
import { removeSkill } from './commands/remove.js';
import { doctor } from './commands/doctor.js';
import { initConfig } from './commands/init.js';

const pkg = await import('../package.json', { assert: { type: 'json' } });

program
  .name('vortexskills')
  .description('Vortex Skills CLI - Install and manage Vortex skills/plugins for Hermes Agent')
  .version(pkg.default.version);

program
  .command('install <skill>')
  .description('Install a skill from Vortex registry or local path')
  .option('-f, --force', 'Force overwrite existing skill')
  .option('-d, --dev', 'Install as development dependency')
  .action(installSkill);

program
  .command('list')
  .description('List installed skills')
  .option('-a, --all', 'Show all available skills from registry')
  .option('-j, --json', 'Output as JSON')
  .action(listSkills);

program
  .command('search <query>')
  .description('Search for skills in Vortex registry')
  .option('-l, --limit <number>', 'Limit results', '10')
  .action(searchSkills);

program
  .command('update <skill>')
  .description('Update an installed skill')
  .option('-a, --all', 'Update all skills')
  .action(updateSkill);

program
  .command('remove <skill>')
  .description('Remove an installed skill')
  .option('-f, --force', 'Force removal without confirmation')
  .action(removeSkill);

program
  .command('doctor')
  .description('Check Hermes and skills health')
  .option('--fix', 'Attempt to fix issues')
  .action(doctor);

program
  .command('init')
  .description('Initialize Vortex skills configuration')
  .option('--force', 'Overwrite existing config')
  .action(initConfig);

program.parse(process.argv);