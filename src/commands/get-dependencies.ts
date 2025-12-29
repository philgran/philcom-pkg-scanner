import { Command } from 'commander';
import { resolve } from 'path';
import { getDependencies } from '../utils/get-dependencies';
import { OutputWriter } from '../utils/output-writer';

export const getDependenciesCommand = new Command('get-dependencies')
  .description('Get all dependencies from a directory and output to STDOUT or file')
  .argument('<directory>', 'Path to directory to scan')
  .option('-o, --output <file>', 'Output file path (if not specified, outputs to STDOUT)')
  .option('-q, --quiet', 'Suppress informational messages')
  .action(async (directory: string, options: { output?: string; quiet?: boolean }) => {
    try {
      const dirPath = resolve(directory);

      // Temporarily redirect console logs when outputting to STDOUT
      const originalLog = console.log;
      const originalWarn = console.warn;

      if (!options.output && !options.quiet) {
        // Redirect logs to stderr when outputting to stdout
        console.log = (...args: any[]) => console.error(...args);
        console.warn = (...args: any[]) => console.error(...args);
      } else if (options.quiet) {
        // Suppress all logs in quiet mode
        console.log = () => {};
        console.warn = () => {};
      }

      // Get dependencies
      const dependencies = await getDependencies(dirPath);

      // Restore console
      console.log = originalLog;
      console.warn = originalWarn;

      if (dependencies.length === 0) {
        console.error('No dependencies found');
        process.exit(1);
      }

      // Write to file or STDOUT
      if (options.output) {
        const outputPath = resolve(options.output);
        OutputWriter.writeDependencies(dependencies, outputPath);
        console.error(`Dependencies written to: ${outputPath}`);
      } else {
        // Format output grouped by ecosystem for STDOUT
        const npmDeps = dependencies.filter(d => d.ecosystem === 'npm');
        const pypiDeps = dependencies.filter(d => d.ecosystem === 'pypi');
        const unknownDeps = dependencies.filter(d => !d.ecosystem);

        const sections: string[] = [];

        if (npmDeps.length > 0) {
          sections.push('# NPM Packages');
          sections.push(...npmDeps.map(dep => `${dep.name}@${dep.version}`));
          sections.push(''); // Empty line between sections
        }

        if (pypiDeps.length > 0) {
          sections.push('# PyPI Packages');
          sections.push(...pypiDeps.map(dep => `${dep.name}@${dep.version}`));
          sections.push(''); // Empty line between sections
        }

        if (unknownDeps.length > 0) {
          sections.push('# Other Packages');
          sections.push(...unknownDeps.map(dep => `${dep.name}@${dep.version}`));
        }

        console.log(sections.join('\n'));
      }
    } catch (error) {
      console.error(`Error: ${(error as Error).message}`);
      process.exit(1);
    }
  });
