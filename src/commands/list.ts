import chalk from 'chalk';
import ora from 'ora';
import path from 'path';
import fs from 'fs-extra';

const SKILLS_DIR = path.join(process.env.HOME || process.env.USERPROFILE || '', '.hermes', 'skills');

export async function listSkills(options: { all?: boolean; json?: boolean }) {
  const spinner = ora('Loading skills...').start();
  
  try {
    // Get installed skills
    const installedSkills = await getInstalledSkills();
    
    if (options.json) {
      console.log(JSON.stringify({ installed: installedSkills }, null, 2));
      spinner.succeed('Done');
      return;
    }
    
    if (installedSkills.length === 0) {
      spinner.info('No skills installed');
      console.log(chalk.dim('\nRun: vortexskills install <skill>'));
      return;
    }
    
    spinner.succeed(`Found ${installedSkills.length} installed skill(s)`);
    
    console.log('\n' + chalk.bold('Installed Skills:'));
    console.log(chalk.gray('─'.repeat(60)));
    
    for (const skill of installedSkills) {
      const status = skill.enabled ? chalk.green('✓ Enabled') : chalk.red('✗ Disabled');
      console.log(`  ${chalk.cyan(skill.name)} ${chalk.gray(`v${skill.version}`)} - ${status}`);
      console.log(`    ${chalk.gray(skill.description || 'No description')}`);
      console.log(`    ${chalk.gray(`Location: ${skill.path}`)}`);
      console.log();
    }
    
    if (options.all) {
      // Show available from registry
      spinner.start('Fetching registry...');
      // TODO: Fetch from registry
      spinner.info('Registry listing not yet implemented');
    }
    
  } catch (error) {
    spinner.fail('Failed to list skills');
    console.error(error);
  }
}

async function getInstalledSkills(): Promise<Array<{
  name: string;
  version: string;
  description: string;
  path: string;
  enabled: boolean;
}>> {
  const skills: Array<{
    name: string;
    version: string;
    description: string;
    path: string;
    enabled: boolean;
  }> = [];
  
  if (await import('fs-extra').then(fs => fs.pathExists(SKILLS_DIR))) {
    const entries = await import('fs-extra').then(fs => fs.readdir(SKILLS_DIR));
    
    for (const entry of entries) {
      const skillPath = path.join(SKILLS_DIR, entry);
      const stat = await import('fs-extra').then(fs => fs.stat(skillPath));
      
      if (stat.isDirectory()) {
        const manifestPath = path.join(skillPath, 'SKILL.md');
        let manifest: any = { name: entry, version: 'unknown', description: '' };
        
        try {
          if (await import('fs-extra').then(fs => fs.pathExists(manifestPath))) {
            const content = await import('fs-extra').then(fs => fs.readFile(manifestPath, 'utf-8'));
            const yamlMatch = entry.match(/^---\n([\s\S]*?)\n---/);
            if (yamlMatch) {
              const yaml = yamlMatch[1];
              const manifest: any = {};
              for (const line of yaml.split('\n')) {
                const [key, ...valueParts] = line.split(':');
                if (key && valueParts.length) {
                  manifest[key.trim()] = valueParts.join(':').trim().replace(/^["']|["']$/g, '');
                }
              }
              if (manifest.name) manifest = manifest;
            }
          } catch {}
        } catch {}
        
        // Check if enabled in hermes config
        const configPath = path.join(process.env.HOME || '', '.hermes', 'config.yaml');
        let enabled = false;
        if (await import('fs-extra').then(fs => fs.pathExists(configPath))) {
          const yaml = await import('yaml');
          const content = await import('fs-extra').then(fs => fs.readFile(configPath, 'utf-8'));
          const config = yaml.parse(content) || {};
          if (config.plugins?.enabled?.includes(entry)) {
            enabled = true;
          }
        }
        
        skills.push({
          name: entry,
          version: manifest.version || 'unknown',
          description: manifest.description || 'No description',
          path: skillPath,
          enabled
        });
      }
    }
  }
  
  return skills;
}