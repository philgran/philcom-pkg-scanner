import { Command } from 'commander';
import { resolve } from 'path';
import { Dependency } from '../parsers/npm-parser';
import { getDependencies } from '../utils/get-dependencies';
import { OutputWriter } from '../utils/output-writer';
import { checkVulnerabilities } from '../utils/osv-client';
import { getAdvisory } from '../utils/ghsa-client';

// Store dependencies in memory for use by other commands
let scannedDependencies: Dependency[] = [];

export function getScannedDependencies(): Dependency[] {
  return scannedDependencies;
}

export const scanCommand = new Command('scan')
  .description('Scan a directory recursively for dependency files (package.json, package-lock.json, yarn.lock, requirements.txt)')
  .argument('<directory>', 'Path to directory to scan')
  .option('-o, --output <file>', 'Output file path (optional)')
  .option('--no-check', 'Skip vulnerability checking')
  .action(async (directory: string, options: { output?: string; check: boolean }) => {
    try {
      const dirPath = resolve(directory);

      console.log(`Scanning directory: ${dirPath}\n`);

      // Get dependencies and store in memory
      scannedDependencies = await getDependencies(dirPath);

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
        // Default to npm ecosystem (could be enhanced to detect based on found files)
        const ecosystem = 'npm';
        const vulnerabilityResults = await checkVulnerabilities(scannedDependencies, ecosystem);

        // Display report
        await OutputWriter.getReport(vulnerabilityResults, getAdvisory);
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
