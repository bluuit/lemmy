#!/usr/bin/env node

import { program } from 'commander';
import { LemmyHttp } from 'lemmy-js-client';
import fs from 'node:fs';
import { readFile as fsReadFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { createInterface } from 'node:readline/promises';
import process from 'node:process';
import { z } from 'zod';
import readFn from 'read';
import { Result, ResultAsync, ok, err } from 'neverthrow';

const read = (o) => ResultAsync.fromPromise(readFn(o), (e) => e);

const createLemmyClient = Result.fromThrowable((u) => new LemmyHttp(u));

const pathExists = (o) => ResultAsync.fromPromise(stat(o), (e) => e);

const createReadStream = (o) =>
  pathExists(o).andThen(() => ok(fs.createReadStream(o)));

const submissionSchema = z.object({
  title: z.string(),
  permalink: z.string(),
  url: z.string(),
  author: z.string(),
  created_utc: z.number(),
  id: z.string(),
  over_18: z.boolean(),
  subreddit_name_prefixed: z.string(),
});

const safeParseJson = Result.fromThrowable(JSON.parse);

const safeParseSubmission = Result.fromThrowable(submissionSchema.parse);

program
  .name('bluuit-lemmy-importer')
  .version('1.0.0')
  .description('imports bluuit data into a lemmy instance')
  .requiredOption('-i, --input <path>', 'path to input file')
  .requiredOption('-u, --user <user>', 'username or email of lemmy admin')
  .requiredOption('-l, --lemmy <url>', 'url of lemmy instance')
  .parse();

const options = program.opts();

const setupResult = await createReadStream(options.input)
  .andThen((input) =>
    ok({
      input,
      lines: createInterface({
        input,
        crlfDelay: Infinity,
      }),
    })
  )
  .andThen(({ input, lines }) =>
    read({
      prompt: `Password for ${options.user}: `,
      silent: true,
      timeout: 60000,
    })
      .andThen((password) => {
        // needed to add newline after password prompt
        console.log();

        return createLemmyClient(options.lemmy).asyncAndThen(
          async (lemmyClient) => {
            const login = (o) =>
              ResultAsync.fromPromise(lemmyClient.login(o), (e) => e);

            const loginResult = await login({
              username_or_email: options.user,
              password,
            });

            if (loginResult.isOk()) {
              if (loginResult.value.jwt) {
                return ok({
                  input,
                  lines,
                  lemmyClient,
                  jwt: loginResult.value.jwt,
                });
              }

              return err(
                new Error(
                  'Credentials are valid but login response did not return JWT'
                )
              );
            }

            return err(loginResult.error);
          }
        );
      })
      .orElse((e) => {
        console.error('Closing file stream due to lemmy authentication error');
        input.close();
        lines.close();
        return err(e);
      })
  );

if (setupResult.isOk()) {
  const { input, lines, lemmyClient, jwt } = setupResult.value;

  process.on('SIGINT', () => {
    input.close();
    lines.close();
    process.exitCode = 1;
  });

  console.log(jwt);
} else {
  console.error(setupResult.error);
  process.exitCode = 1;
}
