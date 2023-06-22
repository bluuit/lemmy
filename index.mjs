import { LemmyHttp } from 'lemmy-js-client';
import { pipeline } from 'node:stream/promises';
import fs, { read } from 'node:fs';
import path from 'node:path';
import { createInterface } from 'node:readline/promises';
import process from 'node:process';
import { z } from 'zod';
import dotenv from 'dotenv';
import { cleanEnv, str } from 'envalid';
import { Result } from 'neverthrow';

const safeParseJson = Result.fromThrowable(
  JSON.parse,
  () => new Error('Failed to parse JSON')
);

dotenv.config();

const env = cleanEnv(process.env, {
  LEMMY_USERNAME_OR_EMAIL: str(),
  LEMMY_PASSWORD: str(),
  BLUUIT_INPUT_PATH: str(),
});

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

const reader = fs.createReadStream(env.BLUUIT_INPUT_PATH);

const lines = createInterface({
  input: reader,
  crlfDelay: Infinity,
});

for await (const line of lines) {
  const jsonResult = safeParseJson(line);
  if (jsonResult.isOk()) {
    const schemaResult = submissionSchema.safeParse(jsonResult.value);
    if (schemaResult.success) {
      console.log('line', schemaResult.data);
    } else {
      console.error(schemaResult.error);
    }
  } else {
    console.error(jsonResult.error);
  }
}

process.on('SIGINT', () => {
  reader.close();
  lines.close();
  exit(1);
});

reader.close();
lines.close();

// const client = new LemmyHttp('http://localhost:1236');

// const login = await client.login({
//   username_or_email: 'admin',
//   password: 'tf6HHDS4RolWfFhk4Rq9',
// });

// const communitiesResponse = await client.listCommunities({});

// client.register({});

// const first = communitiesResponse.communities[0];

// if (login.jwt) {
//   client.createPost({
//     name: 'something',
//     community_id: first.community.id,
//     auth: login.jwt,
//   });
// }
