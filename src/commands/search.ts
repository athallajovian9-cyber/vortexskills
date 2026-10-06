import chalk from 'chalk';
import ora from 'ora';
import prompts from 'prompts';

const VORTEX_REGISTRY_URL = 'https://api.vortexskills.dev/v1';

export async function searchSkills(query: string, options: { limit?: string }) {
  const spinner = ora(`Searching for "${query}"...`).start();
  const limit = parseInt(options.limit || '10');
  
  try {
    // Try registry search
    const response = await fetch(`${VORTEX_REGISTRY_URL}/skills/search?q=${encodeURIComponent(query)}&limit=${limit}`);
    
    if (response.ok) {
      const data = await response.json();
      displayResults(data.results || []);
      spinner.succeed(`Found ${data.total || 0} skills`);
      return;
    }
  } catch {
    // Registry not available, try GitHub search
  }
  
  // Fallback to GitHub search
  spinner.text = `Searching GitHub for "${query}"...`;
  try {
    const response = await fetch(`https://api.github.com/search/repositories?q=${encodeURIComponent(query)}+topic:vortex-skill&per_page=${limit}&sort=stars&order=desc`, {
      headers: { 'Accept': 'application/vnd.github.v3+json' }
    });
    
    if (response.ok) {
      const data = await response.json();
      displayGitHubResults(data.items || []);
      spinner.succeed(`Found ${data.total_count || 0} repositories`);
      return;
    }
  } catch {}
  
  spinner.fail('Search failed - no registry or GitHub API available');
}

function displayResults(results: any[]) {
  if (!results.length) {
    console.log(chalk.gray('No skills found'));
    return;
  }
  
  console.log('\n' + chalk.bold('Search Results:'));
  console.log(chalk.gray('─'.repeat(60)));
  
  for (const skill of results) {
    console.log(`  ${chalk.cyan(skill.name)} ${chalk.gray(`v${skill.version}`)}`);
    console.log(`    ${chalk.gray(skill.description || 'No description')}`);
    console.log(`    ${chalk.gray(`Author: ${skill.author}`)}`);
    console.log(`    ${chalk.blue(`vortexskills install ${skill.name}`)}`);
    console.log();
  }
}

function displayGitHubResults(repos: any[]) {
  if (!repos.length) {
    console.log(chalk.gray('No repositories found'));
    return;
  }
  
  console.log('\n' + chalk.bold('GitHub Repositories:'));
  console.log(chalk.gray('─'.repeat(60)));
  
  for (const repo of repos) {
    const name = repo.name;
    const desc = repo.description || 'No description';
    const stars = repo.stargazers_count;
    const owner = repo.owner.login;
    
    console.log(`  ${chalk.cyan(`${owner}/${name}`)} ${chalk.gray(`★${stars}`)}`);
    console.log(`    ${chalk.gray(desc)}`);
    console.log(`    ${chalk.blue(`vortexskills install github:${owner}/${name}`)}`);
    console.log();
  }
}