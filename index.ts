import bsky from '@atproto/api';
const { BskyAgent } = bsky;
const { RichText } = bsky;
const {AppBskyActorProfile} = bsky;
import { backOff } from "exponential-backoff";
import * as dotenv from 'dotenv';
dotenv.config();

const agent = new BskyAgent({
  service: 'https://bsky.social',
});

async function block(actor: string) {
  return agent.api.app.bsky.graph.block.create(
    { repo: agent.session?.did },
    {
      subject: actor,
      createdAt: new Date().toISOString(),
    });
}

async function getDidByHandle(handle) {
  const res = await agent.api.com.atproto.identity.resolveHandle({ handle: handle });
  return res.data.did;
}

async function unblock(rkey: string, actor: string) {
  try {
      const block = await agent.api.app.bsky.graph.block.delete(
          {rkey: rkey, repo: agent.session?.did },
          {
              subject: actor,
              createdAt: new Date().toISOString(),
          });
  } catch (e) {
      console.error(e)
  }
}

// get all blocks
async function getBlocks() {
  return agent.api.app.bsky.graph.block.list({ repo: agent.session?.did as string });
}

async function batchBlock(actors: string[]) {
  const repoDid = agent.session?.did as string;
  if (!repoDid) {
    throw new Error('Not logged in');
  }
  
  const writes = actors.map((actor) => {
    return {
      collection: 'app.bsky.graph.block',
      value: {
        subject: actor,
        createdAt: new Date().toISOString(),
      },
      $type: 'lex:com.atproto.repo.applyWrites#create',
      rkey: 'self',
    };
  });
  const data = {
    repo: repoDid,
    writes: writes,
  };
  return agent.api.com.atproto.repo.applyWrites(data);
}

async function main() {
  // login to the agent
  if (!process.env.BSKY_USERNAME || !process.env.BSKY_PASSWORD) {
    throw new Error('BSKY_USERNAME and BSKY_PASSWORD must be set in the environment');
  }

  const username = process.env.BSKY_USERNAME;
  const password = process.env.BSKY_PASSWORD;

  // login to the agent. If it fails, do exponential backoff
  await backOff(() => agent.login({ identifier: username, password: password }), { maxDelay: 60000, numOfAttempts: 10 });

  const res = await fetch('https://search.bsky.social/search/profiles?q=' + encodeURIComponent('🔨'))
                .then(response => response.json())
  
  if (res.length > 0) {
    res.forEach(async (actor) => {
      if (AppBskyActorProfile.isRecord(actor)) {
        const did = actor.did as string
        // make sure 🔨 is actually in the handle
        if (!actor.displayName?.includes('🔨')) {
          return
        }
        
        await block(did)
        console.log(`blocked ${did}`)
      }
    })
  }
  
  // // const accountsResp = await agent.searchActors({ term: '🔨' })
  // const accountsResp = await agent.searchActors({ term: '👨' })
  // if (accountsResp.success) {
  //   const accounts = accountsResp.data.actors
  //   console.log(`Found ${accounts.length} accounts`)
  //   accounts.forEach(async (account) => {
  //     console.log("account", account)
  //     const did = account.did
  //     // make sure 🔨 is actually in the handle
  //     if (!account.displayName?.includes('🔨')) {
  //       return
  //     }
      
  //     // await block(did)
  //     console.log(`blocked ${did}`)
  //   })
  // }
}

main()