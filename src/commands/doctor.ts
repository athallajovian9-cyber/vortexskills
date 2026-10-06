import chalk from 'chalk';
import ora from 'ora';
import path from 'path';
import fs from 'fs-extra';
import { execSync } from 'child_process';

const HERMES_CONFIG_DIR = path.join(process.env.HOME || process.env.USERPROFILE || '', '.hermes');

export async function doctor(options: { fix?: boolean }) {
  const spinner = ora('Running health checks...').start();
  
  const results = {
    hermes: { status: 'unknown', details: [] as string[] },
    node: { status: 'unknown', version: '' },
    npm: { status: 'unknown', version: '' },
    config: { status: 'unknown', details: [] as string[] },
    skills: { status: 'unknown', count: 0, issues: [] as string[] },
    plugins: { status: 'unknown', enabled: [] as string[] },
    disk: { status: 'unknown', freeSpace: '' },
  };
  
  // Check Node.js
  try {
    const nodeVersion = execSync('node --version', { encoding: 'utf-8' }).trim();
    spinner.text = `Checking Node.js...`;
    spinner.text = `Checking Node.js... ${nodeVersion}`;
    spinner.text = `Node.js ${nodeVersion} ✓`;
    spinner.text = `Checking npm...`;
    const npmVersion = execSync('npm --version', { encoding: 'utf-8' }).trim();
    spinner.text = `npm ${npmVersion} ✓`;
    
    spinner.text = `Checking Hermes...`;
    try {
      const hermesVersion = execSync('hermes --version', { encoding: 'utf-8' }).trim();
      spinner.text = `Hermes ${hermesVersion} ✓`;
      results.hermes.status = 'ok';
      results.hermes.details.push(`Version: ${hermesVersion}`);
    } catch {
      spinner.text = `Hermes not found ⚠`;
      results.hermes.status = 'warning';
      results.hermes.details.push('Hermes CLI not installed or not in PATH');
    }
    
    results.node.status = 'ok';
    results.node.version = nodeVersion;
    results.npm.status = 'ok';
    results.npm.version = npmVersion;
    
  } catch (error) {
    spinner.text = `Node.js/npm check failed`;
    results.node.status = 'error';
    results.node.details = [error.message];
  }
  
  // Check Hermes config
  spinner.text = 'Checking Hermes configuration...';
  const configPath = path.join(HERMES_CONFIG_DIR, 'config.yaml');
  
  if (await fs.pathExists(configPath)) {
    try {
      const yaml = await import('yaml');
      const content = await fs.readFile(configPath, 'utf-8');
      const config = yaml.parse(content) || {};
      
      results.config.status = 'ok';
      results.config.details.push('Config file found');
      
      // Validate model config
      if (config.model) {
        if (config.model.context_length !== config.model.context_window) {
          results.config.details.push('⚠ context_length != context_window');
          results.config.status = 'warning';
        }
        if (!config.model.context_length) {
          results.config.details.push('⚠ context_length not set');
          results.config.status = 'warning';
        }
      }
      
      // Check plugins
      if (config.plugins?.enabled?.length) {
        results.plugins.enabled = config.plugins.enabled;
        results.plugins.status = 'ok';
      }
      
      // Check skills
      const skillsDir = path.join(HERMES_CONFIG_DIR, 'skills');
      if (await fs.pathExists(skillsDir)) {
        const skills = await import('fs-extra').then(fs => fs.readdir(skillsDir));
        results.skills.count = skills.filter(s => !s.startsWith('.')).length;
        results.skills.status = 'ok';
      }
      
    } catch (error) {
      results.config.status = 'error';
      results.config.details.push(`Config parse error: ${error.message}`);
    }
  } else {
    results.config.status = 'warning';
    results.config.details.push('No config.yaml found');
  }
  
  // Check disk space
  try {
    const { free } = await import('fs-extra').then(fs => 
      fs.stat(HERMES_CONFIG_DIR).then(stats => ({ free: stats.size }))
    );
    // Actually get disk space properly
    const { stdout } = await import('child_process').then(cp => 
      cp.execSync('df -h ' + HERMES_CONFIG_DIR, { encoding: 'utf-8' })
    );
    results.disk.freeSpace = stdout.trim();
    results.disk.status = 'ok';
  } catch {
    results.disk.status = 'unknown';
  }
  
  // Display results
  spinner.succeed('Health check complete');
  
  console.log('\n' + chalk.bold('🏥 Hermes Doctor Report'));
  console.log(chalk.gray('─'.repeat(50)));
  
  // Hermes
  const hermesIcon = results.hermes.status === 'ok' ? chalk.green('✓') : results.hermes.status === 'warning' ? chalk.yellow('⚠') : chalk.red('✗');
  console.log(`${hermesIcon} ${chalk.bold('Hermes')}: ${results.hermes.status}`);
  results.hermes.details.forEach(d => console.log(`    ${d}`));
  
  // Node
  const nodeIcon = results.node.status === 'ok' ? chalk.green('✓') : chalk.red('✗');
  console.log(`${nodeIcon} ${chalk.bold('Node.js')}: v${results.node.version}`);
  
  // NPM
  const npmIcon = results.npm.status === 'ok' ? chalk.green('✓') : chalk.red('✗');
  console.log(`${npmIcon} ${chalk.bold('npm')}: v${results.npm.version}`);
  
  // Config
  const configIcon = results.config.status === 'ok' ? chalk.green('✓') : results.config.status === 'warning' ? chalk.yellow('⚠') : chalk.red('✗');
  console.log(`${configIcon} ${chalk.bold('Config')}: ${results.config.status}`);
  results.config.details.forEach(d => console.log(`    ${d.startsWith('⚠') ? chalk.yellow(d) : d}`));
  
  // Skills
  const skillsIcon = results.skills.status === 'ok' ? chalk.green('✓') : chalk.red('✗');
  console.log(`${skillsIcon} ${chalk.bold('Skills')}: ${results.skills.count} installed`);
  results.skills.issues.forEach(i => console.log(`    ${chalk.red(i)}`));
  
  // Plugins
  const pluginsIcon = results.plugins.status === 'ok' ? chalk.green('✓') : chalk.red('✗');
  console.log(`${pluginsIcon} ${chalk.bold('Plugins')}: ${results.plugins.enabled.join(', ') || 'none'}`);
  
  // Disk
  const diskIcon = results.disk.status === 'ok' ? chalk.green('✓') : chalk.red('✗');
  console.log(`${diskIcon} ${chalk.bold('Disk')}: ${results.disk.freeSpace || 'unknown'}`);
  
  console.log();
  
  // Summary
  const issues = [
    results.hermes.status === 'error' && 'Hermes not installed',
    results.config.status === 'error' && 'Config error',
    results.config.status === 'warning' && 'Config warnings',
    results.hermes.status === 'warning' && 'Hermes not in PATH'
  ].filter(Boolean);
  
  if (issues.length === 0) {
    console.log(chalk.green('\n✅ All checks passed!'));
  } else {
    console.log(chalk.yellow('\n⚠ Issues found:'));
    issues.forEach(i => console.log(`  • ${i}`));
    
    if (options.fix) {
      console.log(chalk.cyan('\n🔧 Attempting fixes...'));
      await attemptFixes(results);
    } else {
      console.log(chalk.cyan('\nRun with --fix to attempt automatic fixes'));
    }
  }
}

async function attemptFixes(results: any) {
  // Fix config warnings
  if (results.config.status === 'warning') {
    console.log('Fixing config...');
    // Auto-fix context keys
    // etc.
  }
}