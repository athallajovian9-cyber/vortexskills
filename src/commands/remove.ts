import chalk from 'chalk';
import ora from 'ora';
import prompts from 'prompts';
import path from 'path';
import fs from 'fs-extra';

const SKILLS_DIR = path.join(process.env.HOME || process.env.USERPROFILE || '', '.hermes', 'skills');

export async function removeSkill(skillName: string, options: { force?: boolean }) {
  const skillDir = path.join(process.env.HOME || '', '.hermes', 'skills', skillName);
  
  if (!await import('fs-extra').then(fs => fs.pathExists(skillDir))) {
    console.log(chalk.red(`Skill "${skillName}" not found`));
    return;
  }
  
  if (!options.force) {
    const { confirm } = await prompts({
      type: 'confirm',
      name: 'confirm',
      message: `Remove skill "${skillName}"? This cannot be undone.`,
      initial: false
    });
    
    if (!confirm) {
      console.log(chalk.gray('Cancelled'));
      return;
    }
  }
  
  const spinner = ora(`Removing ${skillName}...`).start();
  
  try {
    await import('fs-extra').then(fs => fs.remove(path.join(process.env.HOME || '', '.hermes', 'skills', skillName)));
    
    // Remove from hermes config
    await removeFromHermesConfig(skillName);
    
    spinner.succeed(chalk.green(`Removed ${skillName}`));
  } catch (error) {
    spinner.fail(`Failed to remove: ${error.message}`);
  }
}

async function removeFromHermesConfig(skillName: string) {
  const configPath = path.join(process.env.HOME || '', '.hermes', 'config.yaml');
  
  if (!await import('fs-extra').then(fs => fs.pathExists(configPath))) {
    return;
  }
  
  const yaml = await import('yaml');
  const content = await import('fs-extra').then(fs => fs.readFile(configPath, 'utf-8'));
  const config = yaml.parse(content) || {};
  
  // Remove from enabled plugins
  if (config.plugins?.enabled) {
    config.plugins.enabled = config.plugins.enabled.filter((p: string) => p !== skillName);
  }
  
  // Remove plugin config
  if (config.plugins?.[skillName]) {
    delete config.plugins[skillName];
  }
  
  const yamlLib = await import('yaml');
  await import('fs-extra').then(fs => fs.writeFile(configPath, yamlLib.stringify(config), 'utf-8'));
}