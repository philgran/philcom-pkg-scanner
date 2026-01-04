import { Command } from 'commander';
import { resolve } from 'path';
import { getDependencies } from '../utils/get-dependencies';
import { OutputWriter } from '../utils/output-writer';

export const getDependenciesCommand = new Command('get-dependencies')
  .description('Get all dependencies from a directory or file and output to STDOUT or file')
  .argument('<path>', 'Path to directory or dependency file to scan')
  .option('-o, --output <file>', 'Output file path (if not specified, outputs to STDOUT)')
  .action(async (path: string, options: { output?: string }) => {
    try {
      const targetPath = resolve(path);

      // Temporarily redirect console logs when outputting to STDOUT
      const originalLog = console.log;
      const originalWarn = console.warn;

      if (!options.output) {
        // Redirect logs to stderr when outputting to stdout
        console.log = (...args: any[]) => console.error(...args);
        console.warn = (...args: any[]) => console.error(...args);
      }

      // Get dependencies
      const dependencies = await getDependencies(targetPath);

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
