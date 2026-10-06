import chalk from 'chalk';
import ora from 'ora';
import prompts from 'prompts';
import path from 'path';
import fs from 'fs-extra';
import yaml from 'yaml';

const HERMES_CONFIG_DIR = path.join(process.env.HOME || process.env.USERPROFILE || '', '.hermes');
const CONFIG_PATH = path.join(HERMES_CONFIG_DIR, 'config.yaml');

const DEFAULT_CONFIG = {
  token: 'YOUR_BOT_TOKEN_HERE',
  prefix: '!',
  owners: [],
  protection: {
    antiRaid: { enabled: true, threshold: 5, interval: 10000, action: 'lockdown' },
    antiSpam: { enabled: true, maxMessages: 5, interval: 5000, action: 'mute', duration: 300000 },
    antiAlt: { enabled: true, minAge: 86400000, action: 'kick' },
    antiLink: { enabled: true, whitelist: ['discord.gg/yourserver', 'youtube.com'], action: 'delete' },
    antiInvite: { enabled: true, action: 'delete' },
    massMention: { enabled: true, threshold: 5, action: 'mute' },
    antiNuke: { enabled: true, threshold: 3, interval: 10000, action: 'lockdown' }
  },
  logging: {
    enabled: true,
    channel: 'LOG_CHANNEL_ID_HERE',
    events: [
      'messageDelete', 'messageUpdate', 'memberJoin', 'memberLeave',
      'banAdd', 'banRemove', 'roleCreate', 'roleDelete', 'roleUpdate',
      'channelCreate', 'channelDelete', 'channelUpdate', 'guildUpdate',
      'voiceStateUpdate'
    ]
  },
  punishment: {
    muteRole: 'MUTED',
    jailRole: 'JAILED',
    defaultDuration: '5m',
    maxDuration: '7d'
  },
  whitelist: { users: [], roles: [], channels: [] },
  database: 'data/protector.db'
};

export async function initConfig(options: { force?: boolean }) {
  const spinner = ora('Initializing Vortex skills configuration...').start();
  
  try {
    // Ensure config directory exists
    await fs.ensureDir(HERMES_CONFIG_DIR);
    
    // Check if config already exists
    if (await fs.pathExists(CONFIG_PATH) && !options.force) {
      const { overwrite } = await prompts({
        type: 'confirm',
        name: 'overwrite',
        message: 'Config already exists. Overwrite?',
        initial: false
      });
      
      if (!overwrite) {
        spinner.info('Initialization cancelled');
        return;
      }
    }
    
    // Interactive setup
    spinner.text = 'Gathering configuration...';
    
    const answers = await prompts([
      {
        type: 'text',
        name: 'token',
        message: 'Discord bot token:',
        initial: DEFAULT_CONFIG.token
      },
      {
        type: 'text',
        name: 'prefix',
        message: 'Command prefix:',
        initial: DEFAULT_CONFIG.prefix
      },
      {
        type: 'text',
        name: 'owners',
        message: 'Owner user IDs (comma-separated):',
        initial: DEFAULT_CONFIG.owners.join(',')
      },
      {
        type: 'text',
        name: 'logChannel',
        message: 'Log channel ID:',
        initial: DEFAULT_CONFIG.logging.channel
      }
    ]);
    
    if (!answers.token) {
      spinner.fail('Token is required');
      return;
    }
    
    // Build config
    const config = {
      ...DEFAULT_CONFIG,
      token: answers.token,
      prefix: answers.prefix,
      owners: answers.owners.split(',').map(s => s.trim()).filter(Boolean),
      logging: {
        ...DEFAULT_CONFIG.logging,
        channel: answers.logChannel
      }
    };
    
    // Write config
    spinner.text = 'Writing configuration...';
    await fs.writeFile(CONFIG_PATH, yaml.stringify(config, { indent: 2 }), 'utf-8');
    
    // Create skills directory
    const skillsDir = path.join(process.env.HOME || '', '.hermes', 'skills');
    await fs.ensureDir(skillsDir);
    
    spinner.succeed(chalk.green('Configuration initialized!'));
    
    console.log('\n' + chalk.bold('Next steps:'));
    console.log(chalk.gray('1. Edit config: ') + chalk.cyan(`${CONFIG_PATH}`));
    console.log(chalk.gray('2. Install skills: ') + chalk.cyan('vortexskills install <skill>'));
    console.log(chalk.gray('3. Run health check: ') + chalk.cyan('vortexskills doctor'));
    console.log(chalk.gray('4. Start Hermes: ') + chalk.cyan('hermes gateway start'));
    
  } catch (error) {
    spinner.fail(`Initialization failed: ${error.message}`);
  }
}