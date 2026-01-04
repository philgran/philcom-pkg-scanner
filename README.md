# philcom -  A vulnerability scanner

A TypeScript CLI tool for scanning package manifests, extracting dependencies, and checking them against vulnerability databases. Supports both npm (JavaScript/TypeScript) and PyPI (Python) ecosystems.

## Features

- **Multi-ecosystem support**: Parses npm and Python dependency files
- **Vulnerability scanning**: Checks dependencies against OSV (Open Source Vulnerabilities) database
- **Security metadata**: Identifies non-standard package sources and integrity hash types
- **GHSA integration**: Fetches detailed advisory information including CVSS and EPSS scores
- **Flexible output**: Console reports, JSON export, and file output options

## Setup

Install dependencies, build the project, then link the project
```bash
npm i && npm run build && npm link
```

## Usage

Now you can run commands like this:
```bash
philcom <command> [options]
```

## Commands

### `scan`

Scan a directory or individual file for dependencies and check for vulnerabilities.

**Supported files:**
- `package-lock.json` (npm lockfile v1, v2, v3)
- `yarn.lock` (Yarn lockfile)
- `package.json` (npm manifest)
- `requirements.txt` (Python requirements)

**Usage:**
```bash
philcom scan <path> [options]
```

**Arguments:**
- `<path>` - Path to a directory (scans recursively) or a specific dependency file

**Options:**
- `-o, --output <file>` - Write dependencies to output file
- `-c, --check` - Check for vulnerabilities (default: true)
- `--no-check` - Skip vulnerability checking
- `-j, --json` - Output vulnerability report as JSON

**Examples:**
```bash
# Scan fixtures directory and check for vulnerabilities
philcom scan ./fixtures

# Scan the whole project if you want
philcom scan .

# Scan a npm file
philcom scan ./fixtures/package-lock.json

# Scan a requirements.txt file (will call external endpoint for transitive dependencies)
philcom scan ./fixtures/requirements.txt

# Scan and write dependencies to file, will be in the form package-name@sem.ver
philcom scan ./fixtures -o dependencies.txt

# Scan without vulnerability checking (GHSA calls can be a bottleneck)
philcom scan ./fixtures --no-check

# Get vulnerability report as JSON
philcom scan ./fixtures -j
```

**What it does:**
1. If given a directory: recursively scans for dependency files
2. If given a file: validates it's a supported type and processes it directly
3. Parses all files and extracts dependencies, optionally writing them to an output file in the form package-name@sem.ver
4. Deduplicates dependencies by name@version so we can do a scan for each version
5. Groups dependencies by ecosystem (npm vs pypi)
6. Shows statistics (total packages, unique packages, packages with multiple versions)
7. Checks vulnerabilities against OSV database (if --check enabled)
8. Fetches detailed GHSA advisory information for each vulnerability
9. Displays vulnerability reports with:
   - GHSA ID and CVE ID
   - Summary and description
   - CVSS score and severity
   - EPSS (Exploit Prediction Scoring System) with exploitation probability
   - Links to HTML and JSON advisory details

**Security metadata tracked:**
- Severity in the form of a CVSS score (not exactly sure what good/bad numbers are here)
- EPSS looked cool so I included it
- Package source type (npm registry, git, github, gitlab, bitbucket, svn, http, https, file, link)
- Integrity hash algorithm (flags non-SHA-512 hashes)
- Resolved URL for audit purposes

### `get-dependencies`

Extract all dependencies from a directory or file and output to STDOUT or file. Will scan recursively for all supported manifests, package.json, package-lock.json, yarn.lock and requirements.txt.

**Usage:**
```bash
philcom get-dependencies <path> [options]
```

**Arguments:**
- `<path>` - Path to a directory (scans recursively) or a specific dependency file

**Options:**
- `-o, --output <file>` - Output file path (if not specified, outputs to STDOUT)

**Examples:**
```bash
# Output to STDOUT from directory
philcom get-dependencies ./fixtures

# Process a single file
philcom get-dependencies ./fixtures/package-lock.json

# Output to file
philcom get-dependencies ./fixtures -o deps.txt

# Process single file with output
philcom get-dependencies ./fixtures/requirements.txt -o python-deps.txt

# Pipe to other commands
philcom get-dependencies ./fixtures | grep lodash
```

**Output format:**
```
# NPM Packages
commander@11.1.0
octokit@5.0.5

# PyPI Packages
requests@2.31.0
urllib3@2.1.0
```

## get-version-timestamps

Get publication timestamps for specific package versions from npm registry.

**NOTE:** Use this at your own risk. This command can take several minutes when processing hundreds of packages due to npm registry rate limits. It's also somewhat brittle in the way it's written, there's probably a better way we should be checking for package freshness.

**Usage:**
```bash
philcom get-version-timestamps [options]
```

**Options:**
- `-p, --package <name@version>` - Single package in format name@version
- `-f, --file <path>` - File containing package@version entries (one per line)
- `-j, --json` - Output as JSON

**Examples:**
```bash
# Single package
philcom get-version-timestamps -p lodash@4.17.21

# Scoped package
philcom get-version-timestamps -p @babel/core@7.23.0

# From file
philcom get-version-timestamps -f deps.txt

# JSON output
philcom get-version-timestamps -p lodash@4.17.21 -j

# Using output from get-dependencies
philcom get-dependencies ./fixtures -q | grep -E '^[^#]' | philcom get-version-timestamps -f /dev/stdin
```

## score

Score a single package (placeholder for future implementation). I was going to use this as the way to see details for a single package, then just call it repeatedly for every package. But I ended up using output-writer to do basically the same thing in what's probably a smarter way. It would still be nice to have this command to introspect into a single package at some point.

**Usage:**
```bash
philcom score <package>
```

**Example:**
```bash
philcom score express
```

## API Reference

### Vulnerability Report Structure

When checking vulnerabilities, the tool generates detailed reports with the following information:

**Summary:**
- Total packages checked
- Number of vulnerable packages
- Total vulnerabilities found

**Per-vulnerability details:**
- **GHSA ID**: GitHub Security Advisory identifier
- **CVE ID**: Common Vulnerabilities and Exposures identifier
- **NVD Link**: Link to the CVE in the National Vulnerability Database
- **Summary**: Brief description of the vulnerability
- **Description**: Detailed information about the issue
- **Severity**: Risk level (LOW, MODERATE, HIGH, CRITICAL)
- **CVSS Score**: Common Vulnerability Scoring System score (0-10)
- **EPSS Data**:
  - Exploitation probability (% chance of exploitation in next 30 days)
  - Percentile ranking (how risky compared to other vulnerabilities)
- **URLs**: Links to advisory details (HTML and JSON)
- **Timestamps**: Published and updated dates

### JSON Output

The `getReportJSON` method in `OutputWriter` class provides programmatic access to vulnerability data:

```typescript
import { OutputWriter } from './utils/output-writer';
import { checkVulnerabilities } from './utils/osv-client';
import { getAdvisory } from './utils/ghsa-client';

const vulnerabilities = await checkVulnerabilities(dependencies);
const jsonReport = await OutputWriter.getReportJSON(vulnerabilities, getAdvisory);
```

## Architecture

```
src/
├── commands/           # CLI command definitions
│   ├── scan.ts        # Main vulnerability scanning command
│   ├── get-dependencies.ts
│   ├── get-version-timestamps.ts
│   └── score.ts
├── parsers/           # Dependency file parsers
│   ├── npm-parser.ts  # Parses package-lock.json, yarn.lock, package.json
│   └── python-parser.ts # Parses requirements.txt
├── utils/             # Utility functions
│   ├── osv-client.ts  # OSV API integration
│   ├── ghsa-client.ts # GitHub Security Advisory API
│   ├── output-writer.ts # Report formatting
│   ├── get-dependencies.ts # Dependency extraction
│   └── get-version-timestamp.ts # npm registry queries
└── index.ts           # CLI entry point
```

# Other stuff

The docs folder contains a stream-of-consciousness [DEVLOG.md](./docs/DEVLOG.md) file with my thoughts as I was doing the dev work for this project.

The [CONSIDERATIONS.md](./docs/CONSIDERATIONS.md) doc is similar but more structured and was meant to the notes for my presentation/discussion about this project.

It's called `philcom` because I wanted a name that was unique. `philscan` would have been cool, but I didn't like the signature `philscan scan ...` for the main command. And yes the name **Philcom** is derived from Encom, the evil corporation in the Tron universe.