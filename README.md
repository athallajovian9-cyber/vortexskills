# vortexskills

> **Vortex Skills CLI** - Install and manage Vortex skills/plugins for Hermes Agent

A package manager for Hermes Agent skills/plugins, similar to `npm` but designed for Vortex ecosystem skills.

## Features

- 📦 **Install skills** from Vortex registry, GitHub, npm, or local paths
- 🔍 **Search skills** across registry and GitHub
- 📋 **List** installed skills with status
- 🔄 **Update** skills from git, npm, or registry
- 🗑️ **Remove** skills cleanly
- 🏥 **Doctor** - Health checks for Hermes + skills
- ⚙️ **Init** - Interactive configuration setup
- 🔒 **Security** - Built-in prompt injection protection integration

## Installation

```bash
# Global install (recommended)
npm install -g vortexskills

# Or use npx directly
npx vortexskills install hermes-fix-plugin
```

## Commands

```bash
# Install a skill
vortexskills install hermes-fix-plugin
vortexskills install github:athallajovian9-cyber/HermesFixPlugin
vortexskills install ./local-skill

# List installed skills
vortexskills list
vortexskills list --all   # Show all from registry

# Search for skills
vortexskills search "anti-spam"
vortexskills search "anti-nuke" --limit 5

# Update skills
vortexskills update hermes-fix-plugin
vortexskills update --all

# Remove a skill
vortexskills remove old-skill
vortexskills remove old-skill --force

# Health check
vortexskills doctor
vortexskills doctor --fix

# Initialize config
vortexskills init
```

## Skill Sources

| Source | Syntax | Example |
|--------|--------|---------|
| Registry | `skill-name` | `vortexskills install hermes-fix-plugin` |
| GitHub | `github:owner/repo` | `vortexskills install github:athallajovian9-cyber/HermesFixPlugin` |
| npm | `npm:package` | `vortexskills install npm:hermes-fix-plugin` |
| Local | `./path` | `vortexskills install ./my-skill` |

## Skill Format

Skills use `SKILL.md` with YAML frontmatter:

```markdown
---
name: my-skill
version: 1.0.0
description: My awesome skill
author: Your Name
license: MIT
hermes:
  plugin: true
  minVersion: "0.12.0"
  hooks:
    - on_startup
    - on_tool_dispatch
  commands:
    - mycommand
---

# My Skill

Documentation here...
```

## Configuration

Run `vortexskills init` for interactive setup, or manually edit `~/.hermes/config.yaml`:

```yaml
token: "YOUR_BOT_TOKEN"
prefix: "!"
owners: ["YOUR_USER_ID"]
protection:
  antiRaid:
    enabled: true
    threshold: 5
    interval: 10000
    action: "lockdown"
  # ... other protections
logging:
  enabled: true
  channel: "LOG_CHANNEL_ID"
  events: ["messageDelete", "memberJoin", "..."]
```

## Security

The CLI integrates with `hermes-fix-plugin` for security:

- Prompt injection protection
- Skill injection scanning
- Auto-update validation
- Automatic config validation

## Development

```bash
# Clone and setup
git clone https://github.com/athallajovian9-cyber/vortexskills
cd vortexskills
npm install
npm run build

# Run locally
npm run dev -- install hermes-fix-plugin

# Run tests
npm test
```

## Publishing to npm

```bash
npm login
npm version patch
npm publish --access public
```

## License

MIT - Athalla Jovian Maharsa