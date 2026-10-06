import { spawn } from 'child_process';
import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import prompts from 'prompts';

const VORTEX_REGISTRY_URL = 'https://api.vortexskills.dev/v1';
const HERMES_CONFIG_DIR = path.join(process.env.HOME || process.env.USERPROFILE || '', '.hermes');
const SKILLS_DIR = path.join(HERMES_CONFIG_DIR, 'skills');

interface SkillManifest {
  name: string;
  version: string;
  description: string;
  author: string;
  license: string;
  hermes: {
    plugin: boolean;
    minVersion: string;
    hooks: string[];
    commands: string[];
  };
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

export async function installSkill(skillName: string, options: { force?: boolean; dev?: boolean }) {
  const spinner = ora(`Installing skill: ${skillName}...`).start();
  
  try {
    // Ensure skills directory exists
    await fs.ensureDir(SKILLS_DIR);
    
    // Check if skill already exists
    const skillDir = path.join(SKILLS_DIR, skillName);
    if (await fs.pathExists(skillDir) && !options.force) {
      const { overwrite } = await prompts({
        type: 'confirm',
        name: 'overwrite',
        message: `Skill "${skillName}" already exists. Overwrite?`,
        initial: false
      });
      if (!overwrite) {
        spinner.fail(`Installation cancelled`);
        return;
      }
    }
    
    // Try to fetch from registry
    let manifest: SkillManifest | null = null;
    let skillSource = '';
    
    try {
      const response = await fetch(`${VORTEX_REGISTRY_URL}/skills/${skillName}`);
      if (response.ok) {
        const data = await response.json();
        manifest = data.manifest;
        skillSource = data.downloadUrl;
        spinner.text = `Downloading ${skillName} v${manifest.version}...`;
      }
    } catch {
      // Not in registry, check if it's a local path or GitHub URL
    }
    
    // If not in registry, check if it's a GitHub URL or local path
    if (!manifest) {
      if (skillName.startsWith('https://github.com/') || skillName.startsWith('github:')) {
        const repoUrl = skillName.startsWith('github:') 
          ? `https://github.com/${skillName.slice(7)}` 
          : skillName;
        spinner.text = `Cloning from ${repoUrl}...`;
        
        const tempDir = await fs.mkdtemp('vortex-');
        await runCommand('git', ['clone', '--depth=1', repoUrl, tempDir]);
        
        const manifestPath = path.join(tempDir, 'SKILL.md');
        if (await fs.pathExists(manifestPath)) {
          const content = await fs.readFile(manifestPath, 'utf-8');
          manifest = parseSkillManifest(content);
        }
        
        if (manifest) {
          await fs.move(tempDir, skillDir, { overwrite: true });
          spinner.succeed(`Installed ${manifest.name} v${manifest.version} from GitHub`);
          return;
        }
        
        await fs.remove(tempDir);
        spinner.fail('No valid skill found in repository');
        return;
      } else if (skillName.startsWith('/') || skillName.startsWith('./') || skillName.startsWith('~/')) {
        // Local path
        const localPath = path.resolve(skillName.replace(/^~/, process.env.HOME || ''));
        if (await fs.pathExists(localPath)) {
          await fs.copy(localPath, skillDir, { overwrite: true });
          const manifestPath = path.join(skillDir, 'SKILL.md');
          if (await fs.pathExists(manifestPath)) {
            const content = await fs.readFile(manifestPath, 'utf-8');
            manifest = parseSkillManifest(content);
          }
          spinner.succeed(`Installed ${skillName} from local path`);
          return;
        }
      }
    }
    
    if (!manifest) {
      // Try to install via npm as fallback
      spinner.text = `Trying npm install for ${skillName}...`;
      try {
        await runCommand('npm', ['install', skillName, options.dev ? '--save-dev' : '--save']);
        spinner.succeed(`Installed ${skillName} via npm`);
        return;
      } catch {
        spinner.fail(`Could not find skill "${skillName}" in registry, GitHub, local path, or npm`);
        return;
      }
    }
    
    // Download and install from registry
    if (skillSource) {
      spinner.text = `Downloading ${skillName}...`;
      const response = await fetch(skillSource);
      const buffer = await response.arrayBuffer();
      
      // Extract zip
      const AdmZip = (await import('adm-zip')).default;
      const zip = new AdmZip(Buffer.from(buffer));
      zip.extractAllTo(skillDir, true);
    }
    
    // Verify installation
    const installedManifestPath = path.join(skillDir, 'SKILL.md');
    if (await fs.pathExists(installedManifestPath)) {
      const content = await fs.readFile(installedManifestPath, 'utf-8');
      const installedManifest = parseSkillManifest(content);
      
      // Save to hermes config
      await updateHermesConfig(manifest.name, manifest.version);
      
      spinner.succeed(chalk.green(`Installed ${manifest.name} v${manifest.version}`));
      console.log(chalk.dim(`  Location: ${skillDir}`));
      console.log(chalk.dim(`  Run: hermes skill enable ${skillName}`));
    } else {
      spinner.fail('Installation verification failed');
    }
    
  } catch (error) {
    spinner.fail(`Installation failed: ${error.message}`);
    console.error(error);
  }
}

function parseSkillManifest(content: string): SkillManifest | null {
  try {
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (frontmatterMatch) {
      const yaml = frontmatterMatch[1];
      const manifest: any = {};
      for (const line of yaml.split('\n')) {
        const [key, ...valueParts] = line.split(':');
        if (key && valueParts.length) {
          const value = valueParts.join(':').trim();
          manifest[key.trim()] = value.replace(/^["']|["']$/g, '');
        }
      }
      return manifest;
    }
    return null;
  } catch {
    return null;
  }
}

async function updateHermesConfig(skillName: string, version: string) {
  const configPath = path.join(HERMES_CONFIG_DIR, 'config.yaml');
  let config: any = {};
  
  if (await fs.pathExists(configPath)) {
    const yaml = await import('yaml');
    const content = await fs.readFile(configPath, 'utf-8');
    config = yaml.parse(content) || {};
  }
  
  if (!config.plugins) config.plugins = {};
  if (!config.plugins.enabled) config.plugins.enabled = [];
  
  const skillKey = `hermes_fix_plugin`; // Default, should be skill-specific
  if (!config.plugins.enabled.includes(skillName)) {
    config.plugins.enabled.push(skillName);
  }
  
  if (!config.plugins[skillName]) {
    config.plugins[skillName] = { enabled: true };
  }
  
  const yaml = await import('yaml');
  await fs.writeFile(configPath, yaml.stringify(config), 'utf-8');
}

function runCommand(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, { stdio: 'inherit' });
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Command failed with code ${code}`));
    });
    proc.on('error', reject);
  });
}

export async function installSkillFromGitHub(repo: string, options: { force?: boolean }) {
  const spinner = ora(`Cloning ${repo}...`).start();
  const tempDir = await fs.mkdtemp('vortex-github-');
  
  try {
    await runCommand('git', ['clone', '--depth=1', `https://github.com/${repo}`, tempDir]);
    
    const skillDirName = repo.split('/').pop() || 'skill';
    const targetDir = path.join(SKILLS_DIR, skillDirName);
    
    if (await fs.pathExists(targetDir) && !options.force) {
      throw new Error('Skill already exists. Use --force to overwrite.');
    }
    
    await fs.move(tempDir, targetDir, { overwrite: options.force });
    
    const manifestPath = path.join(targetDir, 'SKILL.md');
    if (await fs.pathExists(manifestPath)) {
      const content = await fs.readFile(manifestPath, 'utf-8');
      const manifest = parseSkillManifest(content);
      if (manifest) {
        console.log(chalk.green(`✅ Installed ${manifest.name} v${manifest.version} from GitHub`));
      }
    }
    
    spinner.succeed('GitHub skill installed');
  } catch (error) {
    await fs.remove(tempDir).catch(() => {});
    throw error;
  }
}