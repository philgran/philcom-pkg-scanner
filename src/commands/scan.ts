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
  .description('Scan a directory or file for dependencies (package.json, package-lock.json, yarn.lock, requirements.txt)')
  .argument('<path>', 'Path to directory or dependency file to scan')
  .option('-o, --output <file>', 'Output file path (optional)')
  .option('--no-check', 'Skip vulnerability checking')
  .option('-j, --json', 'Output vulnerability report as JSON')
  .action(async (path: string, options: { output?: string; check: boolean; json?: boolean }) => {
    try {
      const targetPath = resolve(path);

      // Suppress console output when JSON mode is enabled
      const originalLog = console.log;
      const originalWarn = console.warn;

      if (options.json) {
        // Redirect all logs to stderr or suppress them in JSON mode
        console.log = () => {};
        console.warn = () => {};
      } else {
        console.log(`Scanning: ${targetPath}\n`);
      }

      // Get dependencies and store in memory
      scannedDependencies = await getDependencies(targetPath);

      if (!options.json) {
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
      }

      // Check for vulnerabilities by default
      if (options.check) {
        // Group dependencies by ecosystem
        const npmDeps = scannedDependencies.filter(dep => dep.ecosystem === 'npm');
        const pypiDeps = scannedDependencies.filter(dep => dep.ecosystem === 'pypi');

        const allReports: any[] = [];

        // Check npm vulnerabilities
        if (npmDeps.length > 0) {
          if (!options.json) {
            console.log('\n=== Checking NPM vulnerabilities ===');
          }
          const npmVulnerabilityResults = await checkVulnerabilities(npmDeps);

          if (options.json) {
            const jsonReport = await OutputWriter.getReportJSON(npmVulnerabilityResults, getAdvisory);
            allReports.push({ ecosystem: 'npm', ...jsonReport });
          } else {
            await OutputWriter.getReport(npmVulnerabilityResults, getAdvisory);
          }
        }

        // Check PyPI vulnerabilities
        if (pypiDeps.length > 0) {
          if (!options.json) {
            console.log('\n=== Checking PyPI vulnerabilities ===');
          }
          const pypiVulnerabilityResults = await checkVulnerabilities(pypiDeps);

          console.log('RESULTS', pypiVulnerabilityResults)
          return;
          if (options.json) {
            const jsonReport = await OutputWriter.getReportJSON(pypiVulnerabilityResults, getAdvisory);
            allReports.push({ ecosystem: 'pypi', ...jsonReport });
          } else {
            await OutputWriter.getReport(pypiVulnerabilityResults, getAdvisory);
          }
        }

        // Output combined JSON report
        if (options.json) {
          // Restore console to output JSON
          console.log = originalLog;
          console.warn = originalWarn;
          console.log(JSON.stringify(allReports, null, 2));
        }
      }

      // Restore console if not already restored
      if (options.json && !options.check) {
        console.log = originalLog;
        console.warn = originalWarn;
      }

      // Optionally write to output file
      if (options.output && !options.json) {
        const outputPath = resolve(options.output);
        OutputWriter.writeDependencies(scannedDependencies, outputPath);
        console.log(`\nOutput written to: ${outputPath}`);
      }
    } catch (error) {
      console.error(`Error: ${(error as Error).message}`);
      process.exit(1);
    }
  });
