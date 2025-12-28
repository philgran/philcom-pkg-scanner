import { Command } from "commander";

export const scoreCommand = new Command('score')
  .description('Score a single package')
  .action((pkg: string) => {
    console.log(`Scoring package: ${pkg}`)

  });
