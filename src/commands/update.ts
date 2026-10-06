import chalk from 'chalk';
import ora from 'ora';
import prompts from 'prompts';
import path from 'path';
import fs from 'fs-extra';

const SKILLS_DIR = path.join(process.env.HOME || process.env.USERPROFILE || '', '.hermes', 'skills');

export async function updateSkill(skillName: string, options: { all?: boolean }) {
  const spinner = ora(options.all ? 'Updating all skills...' : `Updating skill: ${skillName}...`).start();
  
  try {
    if (options.all) {
      const skills = await getInstalledSkills();
      
      if (skills.length === 0) {
        spinner.info('No skills installed');
        return;
      }
      
      let updated = 0;
      for (const skill of skills) {
        spinner.text = `Updating ${skill.name}...`;
        try {
          await updateSingleSkill(skill.name);
          updated++;
        } catch (error) {
          console.log(chalk.red(`  Failed to update ${skill.name}: ${error.message}`));
        }
      }
      
      spinner.succeed(`Updated ${updated}/${skills.length} skills`);
    } else {
      await updateSingleSkill(skillName);
      spinner.succeed(chalk.green(`Updated ${skillName}`));
    }
  } catch (error) {
    spinner.fail(`Update failed: ${error.message}`);
  }
}

async function updateSingleSkill(skillName: string) {
  const skillDir = path.join(process.env.HOME || '', '.hermes', 'skills', skillName);
  
  if (!await import('fs-extra').then(fs => fs.pathExists(skillDir))) {
    throw new Error(`Skill "${skillName}" not found`);
  }
  
  // Check if it's a git repo
  const gitDir = path.join(skillName, '.git');
  if (await import('fs-extra').then(fs => fs.pathExists(gitDir))) {
    await runCommand('git', ['pull', '--rebase'], { cwd: skillDir });
    console.log(chalk.green(`  ✓ ${skillName} updated from git`));
    return;
  }
  
  // Check if there's a remote URL in package.json or skill manifest
  const manifestPath = path.join(skillDir, 'SKILL.md');
  if (await import('fs-extra').then(fs => fs.pathExists(manifestPath))) {
    const content = await import('fs-extra').then(fs => fs.readFile(manifestPath, 'utf-8'));
    const manifest = parseManifest(content);
    
    if (manifest.repository) {
      // Try to update from repository
      await runCommand('git', ['pull'], { cwd: skillDir });
      console.log(chalk.green(`  ✓ ${skillName} updated from repository`));
      return;
    }
  }
  
  // Check npm
  const packageJsonPath = path.join(skillName, 'package.json');
  if (await import('fs-extra').then(fs => fs.pathExists(packageJsonPath))) {
    await runCommand('npm', ['update'], { cwd: skillDir });
    console.log(chalk.green(`  ✓ ${skillName} updated via npm`));
    return;
  }
  
  throw new Error(`Cannot determine update method for ${skillName}`);
}

function parseManifest(content: string): any {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (match) {
    const yaml = match[1];
    const manifest: any = {};
    for (const line of yaml.split('\n')) {
      const [key, ...valueParts] = line.split(':');
      if (key && valueParts.length) {
        manifest[key.trim()] = valueParts.join(':').trim().replace(/^["']|["']$/g, '');
      }
    }
    return manifest;
  }
  return {};
}

function runCommand(command: string, args: string[], options: { cwd?: string } = {}): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = import('child_process').then(cp => cp.spawn(command, args, { 
      stdio: 'inherit',
      cwd: options.cwd 
    }));
    proc.then(p => {
      p.on('close', (code: number) => {
        if (code === 0) resolve();
        else reject(new Error(`Command failed with code ${code}`));
      });
      p.on('error', reject);
    });
  }
}