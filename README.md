# philcom

A TypeScript CLI tool for scanning and operations.

## Installation

```bash
npm install
```

## Development

Build the project:
```bash
npm run build
```

Watch mode for development:
```bash
npm run dev
```

## Usage

After building, you can run the CLI:

```bash
node dist/index.js scan express -a myarg
```

Or link it globally for development:
```bash
npm link
philcom scan express -a myarg
```

## Commands

### scan

Scan a target with optional arguments.

```bash
philcom scan <target> [-a <value>]
```

Example:
```bash
philcom scan express -a myargument
```
