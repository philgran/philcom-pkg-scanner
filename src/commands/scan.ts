import { Command } from 'commander';
import { resolve, basename } from 'path';
import { Dependency } from '../parsers/npm-parser';
import { getDependencies } from '../utils/get-dependencies';
import { OutputWriter } from '../utils/output-writer';
import { checkVulnerabilities } from '../utils/osv-client';

// Store dependencies in memory for use by other commands
let scannedDependencies: Dependency[] = [];

export function getScannedDependencies(): Dependency[] {
  return scannedDependencies;
}

export const scanCommand = new Command('scan')
  .description('Scan a dependency file (package.json, package-lock.json, or requirements.txt)')
  .argument('<file>', 'Path to dependency file')
  .option('-o, --output <file>', 'Output file path (optional)')
  .option('--no-check', 'Skip vulnerability checking')
  .action(async (file: string, options: { output?: string; check: boolean }) => {
    try {
      const filePath = resolve(file);
      const fileName = basename(filePath);

      console.log(`Scanning ${fileName}...`);

      // Get dependencies and store in memory
      scannedDependencies = getDependencies(filePath);

      // Show statistics
      const stats = OutputWriter.getDependencyStats(scannedDependencies);
      console.log(`\nFound ${stats.total} dependencies (${stats.unique} unique packages)`);

      if (stats.multipleVersions.length > 0) {
        console.log(`\nPackages with multiple versions: ${stats.multipleVersions.length}`);
        stats.multipleVersions.slice(0, 5).forEach(name => {
          const versions = scannedDependencies
            .filter(d => d.name === name)
            .map(d => d.version);
          console.log(`  - ${name}: ${versions.join(', ')}`);
        });
        if (stats.multipleVersions.length > 5) {
          console.log(`  ... and ${stats.multipleVersions.length - 5} more`);
        }
      }

      // Check for vulnerabilities by default
      if (options.check) {
        // Determine ecosystem from file type
        const ecosystem = fileName === 'requirements.txt' ? 'pypi' : 'npm';
        await checkVulnerabilities(scannedDependencies, ecosystem);
      }

      // Optionally write to output file
      if (options.output) {
        const outputPath = resolve(options.output);
        OutputWriter.writeDependencies(scannedDependencies, outputPath);
        console.log(`\nOutput written to: ${outputPath}`);
      }
    } catch (error) {
      console.error(`Error: ${(error as Error).message}`);
      process.exit(1);
    }
  });
