# DutchDataPlugin

Claude Code plugin for producing branded deliverables for Ministerie van Economische Zaken en Klimaat.

## Skills Included

| Skill | Command | Description |
|-------|---------|-------------|
| pdf | `/dutch-data:pdf` | Create branded PDFs |
| docx | `/dutch-data:docx` | Create branded documents |
| pptx | `/dutch-data:pptx` | Create branded presentations |
| pptx-hd | `/dutch-data:pptx-hd` | pptx-hd |
| dutch-gov-data | `/dutch-data:dutch-gov-data` | dutch-gov-data |
| mermaid | `/dutch-data:mermaid` | Mermaid diagram generation |

## Installation

### Prerequisites

- Claude Code v2.1.49+ (with plugin support)
- Node.js 18+
- Python 3.11+ with [uv](https://docs.astral.sh/uv/) (for xlsx/pdf scripts)

### Setup

1. Add the private marketplace:
   ```
   /plugin marketplace add stromy-org/client-plugins-marketplace
   ```

2. Install the plugin:
   ```
   /plugin install dutch-data@stromy-org/client-plugins-marketplace
   ```

3. Install dependencies (first time only):
   ```bash
   cd ~/.claude/plugins/cache/dutch-data
   npm install
   uv sync
   ```

### Local Development

```bash
claude --plugin-dir /path/to/dutch-data-plugin
```

## Usage

Start Claude Code in any project directory and use the plugin skills:

- All output uses Ministerie van Economische Zaken en Klimaat branding (colors, fonts, logo) automatically
- Skills are accessed as `/dutch-data:<skill-name>`

## Company Data

Brand data is in `companies/nl-ez/brand/charter.json` and includes:
- Color palette (primary, secondary, accent)
- Typography (heading, body, monospace fonts)
- Logo files and paths

## Updating

```
/plugin update dutch-data
```

Or pull the latest version:
```bash
cd ~/.claude/plugins/cache/dutch-data
git pull
npm install
uv sync
```

## Version History

See [CHANGELOG.md](CHANGELOG.md) for version history.
