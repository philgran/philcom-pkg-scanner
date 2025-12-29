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
      const dependencies = getDependencies(dirPath);

      // Restore console
      console.log = originalLog;
      console.warn = originalWarn;

      if (dependencies.length === 0) {
        console.error('No dependencies found');
        process.exit(1);
      }

      // Format output
      const output = dependencies
        .map(dep => `${dep.name}@${dep.version}`)
        .join('\n');

      // Write to file or STDOUT
      if (options.output) {
        const outputPath = resolve(options.output);
        OutputWriter.writeDependencies(dependencies, outputPath);
        console.error(`Dependencies written to: ${outputPath}`);
      } else {
        // Output to STDOUT
        console.log(output);
      }
    } catch (error) {
      console.error(`Error: ${(error as Error).message}`);
      process.exit(1);
    }
  });
