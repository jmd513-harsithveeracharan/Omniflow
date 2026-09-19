// run_claude.cjs
// How to run: node run_claude.cjs

const https = require('https');
const crypto = require('crypto');
const fs = require('fs');

// ==========================================
// 🔴 CONFIGURATION (Extracted from cURL)
// ==========================================
const ORG_UUID = '37000f3f-9944-4b11-9e3e-d255456192da';
const DEVICE_ID = 'c69be8b5-7e37-4b28-b7c5-72c51c218c1d';
const MODEL_NAME = 'claude-opus-5';
const FULL_COOKIE = 'anthropic-device-id=c69be8b5-7e37-4b28-b7c5-72c51c218c1d; CH-prefers-color-scheme=dark; anthropic-consent-preferences=%7B%22analytics%22%3Atrue%2C%22marketing%22%3Atrue%7D; _fbp=fb.1.1781674824483.50664089742258230; _gcl_au=1.1.293495200.1781674825; __ssid=3279e44f-5815-4b88-937f-96a479912bf1; user-sidebar-pinned=false; ajs_anonymous_id=claudeai.v1.52e12f92-78b8-4d1c-ac24-c23c102f41d8; g_state={"i_l":0,"i_ll":1782381415125,"i_e":{"enable_itp_optimization":24},"i_et":1782381415125}; intercom-device-id-lupk8zyo=87d88293-2a4c-4011-9b6d-ea882eb202cb; _dd_s=aid=f8e5668a-d1fd-42a4-8368-3a6d4021bc52&rum=2&id=d37309ec-6358-425c-aa29-de282a81912e&created=1785145390916&expire=1785146292811; sessionKey=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; sessionKeyLC=1787558180454; lastActiveOrg=37000f3f-9944-4b11-9e3e-d255456192da; routingHint=sk-ant-rh-eyJhbGciOiJFUzI1NiIsImtpZCI6IjdDMXFhT0Z4anVsWlI0RUJzbjZNVHlGRjVnQ1diR2xaTVQ0dkZJa0RRaW8iLCJ0eXAiOiJKV1QifQ.eyJhZ2VfdmVyaWZpZWQiOnRydWUsImF1ZCI6WyJjbGF1ZGUtYWktZnJvbnRlbmQiXSwiZXhwIjoxNzkwMjY0NTcwLCJmbGFncyI6WyJlZGdlX2RlZmF1bHRfcm91dGUiXSwiaGFzX21lbWJlcnNoaXAiOnRydWUsImlhdCI6MTc4NzY3MjU3MCwiaXNfdmVyaWZpZWQiOnRydWUsImlzcyI6ImNsYXVkZS1haS1yb3V0aW5nIiwibmFtZSI6IkFraGlsIiwib25ib2FyZGluZ19jb21wbGV0ZSI6dHJ1ZSwicGVuZGluZ19pbnZpdGUiOmZhbHNlLCJwaG9uZV92ZXJpZmllZCI6ZmFsc2UsInN1YiI6IjhhZTlmYWNlLTUxOTgtNDg4Ni1iZDE5LTljODFlOWUzYTA2ZiIsInYiOjJ9.1LPTT9yy2j0u61IGHaQpfSLnkhJupvI15zwrmYL5hEzyFv0KkuXjSffyvUoOdnll5JcLaIoV4tXK8R06vWP2iw; sessionKeyV3=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; sessionKeyV3LC=1787672570354; intercom-session-lupk8zyo=L1ZFWEhKUVJ6aElRcE5GTjFRZ201WEtoRExGdmlyT2lkamdSakZrWUsxdXFwQjBCMCtFQWQyaWxPbXNiVlRqVWt3V3MrbjdCUkdxQUFucExGVnZCRXpyc1BVd2pPb01vNUVMakE3SWhLcVQ5VDk0b0RRTHR5Mmc1TzNtM0hnd3ZWcHJYOVNseFJUZ2FaQ0NlSGZ4cVg5RjgxakY4NmZ0NksvRzF0L3A2blBWcVNoTFkwVzVIdXQ3VVdQL3JJTjFpZDMycmhXOFJPSjI4S1pIQ05naWtIMXc3WVIxWGptaFBaSzB0Y0RrRVVjVDQrc0tidnEvdUpqNThwQk9LVmc5aFJKQkhVTmNWSHFobElyYXJ0Q1JGNFFiSGlodXFaWjB3NGQwZENXRHltVDg9LS1MVEhHd1BRMldhMlg2azZ3Mk9PV0p3PT0=--417592c55e4d6bad85b63de7d8b13d75ea768d3e; activitySessionId=21e4f01e-9beb-4819-a859-b94845b976f0; ion-vk=345e4824-0a93-46d2-b0a6-85f2629a3aa2; cf_clearance=acOZwCFeSTMM_C1GioJ16nv.xPl9RMutYPzv3m7YaGI-1787913960-1.2.1.1-l.YdFuwzuzc7MVDoPZEmqsEodcXurKEoH97s1ngbKM4LneaiqXfGODho2058V7Eb8CzeHjng1zB_ATJEkO25x39CLrhQFomHRVW6w7dYxrrORSq6HtNF1dvRIsrERWsaGI8I9hVi8pFkXICow6EizQ8SjYdVXLg.oqUE.1XKALxxQuW6jQFcTZ3rXX8QAi9MxWNUB7HwDBkKn426.rWx5Bu9NaPtfvGLUeX8ASoTLP4hOc8xusCFPl40Jlb4uoflLBDol9N32bF45WjLB3qp8S0ZJJz_MzI.AFeG.HLJnfugOv_tFMaP3HJXhHZY_qf9UY1bS7erZIRs9_ZDbUfhzzamO8nTlKsRWIEbdoZUAAY; __cf_bm=TcUTQfF0Muo30lIIgxGv7hQB1Oal0.yPHdDz66e2VxE-1787913960.9194427-1.0.1.1-1g_0dJiREZ36KU_9W02grlKlxPA8kIzrY7IoQyYCKqEvy3.CUKOO.PkUD8E9PUabiJlUl5j1Tz5W6V41vc_fFvyzFM6x0qg7GxieeqUfcK3j7ROQweviSBMCS4BxaB2v; _cfuvid=Fe14MaGFru3jp4sXmiWjCdR6YIHOM1GsLmcdTVblum4-1787913960.0597053-1.0.1.1-Am6zpqwLkP2KkCBTCUt9ykKZqOQpuAnZ9jU7oiKuM0k; user-sidebar-visible-on-load=false; _dd_s_v2=aid=f8e5668a-d1fd-42a4-8368-3a6d4021bc52&id=1b885e35-7198-4d54-a514-1afd6e2d4726&created=1787913961755&expire=1787915506262&c=0';

const headers = {
  'Cookie': FULL_COOKIE,
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 Edg/151.0.0.0',
  'Content-Type': 'application/json',
  'Accept': 'text/event-stream, text/plain, */*',
  'Origin': 'https://claude.ai',
  'Referer': 'https://claude.ai/new',
  'anthropic-client-platform': 'web_claude_ai',
  'anthropic-device-id': DEVICE_ID,
  'Sec-Fetch-Site': 'same-origin',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Dest': 'empty'
};

async function askClaude(promptText) {
  const chatUuid = crypto.randomUUID();

  // 1. Create chat thread
  await new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'claude.ai',
      path: `/api/organizations/${ORG_UUID}/chat_conversations`,
      method: 'POST',
      headers
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(d));
    });
    req.on('error', reject);
    req.write(JSON.stringify({ uuid: chatUuid, name: 'Senior Query' }));
    req.end();
  });

  console.log(`\n🤖 Prompt: "${promptText}"\n`);
  console.log('--- CLAUDE RESPONSE (STREAMING LIVE) ---');

  // 2. Stream answer
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      prompt: promptText,
      timezone: 'Asia/Calcutta',
      locale: 'en-US',
      model: MODEL_NAME,
      attachments: [],
      files: []
    });

    const req = https.request({
      hostname: 'claude.ai',
      path: `/api/organizations/${ORG_UUID}/chat_conversations/${chatUuid}/completion`,
      method: 'POST',
      headers
    }, (res) => {
      let fullText = '';
      let buffer = '';

      res.on('data', (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.completion) {
                fullText += data.completion;
                process.stdout.write(data.completion); // 📺 1. Live Terminal View
              }
            } catch {}
          }
        }
      });

      res.on('end', () => {
        console.log('\n----------------------------------------');
        // 💾 2. Save output to file
        fs.writeFileSync('claude_response.txt', fullText, 'utf8');
        console.log('✅ Response saved to: claude_response.txt');
        resolve(fullText);
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// 🎯 Change this question to whatever you or your senior want to ask:
const myQuestion = 'Explain what si sorting algorithm and also give me merge sort code and explain what it is okay.';
askClaude(myQuestion);
