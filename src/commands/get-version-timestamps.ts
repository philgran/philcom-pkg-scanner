import { Command } from 'commander';
import { getVersionTimestamp, getVersionTimestamps } from '../utils/get-version-timestamp';
import { readFileSync } from 'fs';

export const getVersionTimestampsCommand = new Command('get-version-timestamps')
  .description('Get publication timestamps for package versions')
  .option('-p, --package <name@version>', 'Single package in format name@version')
  .option('-f, --file <path>', 'File containing package@version entries (one per line)')
  .option('-j, --json', 'Output as JSON')
  .action(async (options: { package?: string; file?: string; json?: boolean }) => {
    try {
      let packages: Array<{ name: string; version: string }> = [];

      // Handle single package
      if (options.package) {
        const parts = options.package.split('@');
        if (parts.length < 2) {
          console.error('Error: Package must be in format name@version (e.g., lodash@4.17.21)');
          process.exit(1);
        }

        // Handle scoped packages like @babel/core@7.0.0
        let name: string;
        let version: string;

        if (options.package.startsWith('@')) {
          // Scoped package: @scope/name@version
          const lastAtIndex = options.package.lastIndexOf('@');
          name = options.package.substring(0, lastAtIndex);
          version = options.package.substring(lastAtIndex + 1);
        } else {
          // Regular package: name@version
          name = parts[0];
          version = parts.slice(1).join('@'); // In case version has @ in it
        }

        packages.push({ name, version });
      }

      // Handle file input
      if (options.file) {
        const content = readFileSync(options.file, 'utf-8');
        const lines = content.split('\n').filter(line => line.trim());

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          let name: string;
          let version: string;

          if (trimmed.startsWith('@')) {
            // Scoped package
            const lastAtIndex = trimmed.lastIndexOf('@');
            if (lastAtIndex <= 0) {
              console.warn(`Skipping invalid entry: ${trimmed}`);
              continue;
            }
            name = trimmed.substring(0, lastAtIndex);
            version = trimmed.substring(lastAtIndex + 1);
          } else {
            // Regular package
            const parts = trimmed.split('@');
            if (parts.length < 2) {
              console.warn(`Skipping invalid entry: ${trimmed}`);
              continue;
            }
            name = parts[0];
            version = parts.slice(1).join('@');
          }

          packages.push({ name, version });
        }
      }

      if (packages.length === 0) {
        console.error('Error: No packages specified. Use -p for a single package or -f for a file.');
        console.error('Examples:');
        console.error('  philcom get-version-timestamps -p lodash@4.17.21');
        console.error('  philcom get-version-timestamps -p @babel/core@7.23.0');
        console.error('  philcom get-version-timestamps -f deps.txt');
        process.exit(1);
      }

      // Fetch timestamps
      if (packages.length === 1) {
        // Single package - use simple function
        const pkg = packages[0];
        const timestamp = await getVersionTimestamp(pkg.name, pkg.version);

        if (options.json) {
          console.log(JSON.stringify({
            package: `${pkg.name}@${pkg.version}`,
            timestamp: timestamp || null
          }, null, 2));
        } else {
          if (timestamp) {
            console.log(`${pkg.name}@${pkg.version}: ${timestamp}`);
          } else {
            console.log(`${pkg.name}@${pkg.version}: Not found`);
          }
        }
      } else {
        // Multiple packages - use batch function
        console.error(`Fetching timestamps for ${packages.length} packages...`);
        const results = await getVersionTimestamps(packages);

        if (options.json) {
          const jsonOutput: Record<string, string | null> = {};
          for (const pkg of packages) {
            const key = `${pkg.name}@${pkg.version}`;
            jsonOutput[key] = results.get(key) || null;
          }
          console.log(JSON.stringify(jsonOutput, null, 2));
        } else {
          for (const pkg of packages) {
            const key = `${pkg.name}@${pkg.version}`;
            const timestamp = results.get(key);
            if (timestamp) {
              console.log(`${key}: ${timestamp}`);
            } else {
              console.log(`${key}: Not found`);
            }
          }
        }
      }
    } catch (error) {
      console.error(`Error: ${(error as Error).message}`);
      process.exit(1);
    }
  });
