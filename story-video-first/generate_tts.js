const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');
const fs = require('fs');
const path = require('path');

const scenes = [
  { id: 'scene_01', start: 0.25, maxDur: 2.5, text: 'من هجده سالمه...' },
  { id: 'scene_02', start: 3.30, maxDur: 4.3, text: 'و دارم با دستام، رویامو می‌سازم.' },
  { id: 'scene_03', start: 8.35, maxDur: 4.2, text: 'همه‌چی از یه علاقه کوچیک شروع شد...' },
  { id: 'scene_04', start: 13.45, maxDur: 5.0, text: 'حالا هر سفارشی که می‌گیرم، بهم امید می‌ده.' },
  { id: 'scene_05', start: 19.40, maxDur: 5.1, text: 'شاید کوچیک شروع کرده باشم، ولی رؤیام خیلی بزرگه.' },
  { id: 'scene_06', start: 25.35, maxDur: 4.0, text: 'این تازه شروع داستان منه...' }
];

(async () => {
  // Try api.msedgeservices.com with 30s timeout first, or speech.platform.bing.com with TrustedClientToken
  const endpoints = [
    {
      name: 'api.msedgeservices.com',
      setup: () => {
        MsEdgeTTS.WSS_URL = "wss://api.msedgeservices.com/tts/cognitiveservices/websocket/v1";
        MsEdgeTTS.getSynthUrl = async function() {
          const req_id = MsEdgeTTS.generateUUID();
          const secMsGEC = await MsEdgeTTS.generateSecMsGec(this.TRUSTED_CLIENT_TOKEN);
          return `${this.WSS_URL}?Ocp-Apim-Subscription-Key=${this.TRUSTED_CLIENT_TOKEN}&Sec-MS-GEC=${secMsGEC}&Sec-MS-GEC-Version=1-143.0.3650.96&ConnectionId=${req_id}`;
        };
      }
    },
    {
      name: 'speech.platform.bing.com',
      setup: () => {
        MsEdgeTTS.WSS_URL = "wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1";
        MsEdgeTTS.getSynthUrl = async function() {
          const req_id = MsEdgeTTS.generateUUID();
          const secMsGEC = await MsEdgeTTS.generateSecMsGec(this.TRUSTED_CLIENT_TOKEN);
          return `${this.WSS_URL}?TrustedClientToken=${this.TRUSTED_CLIENT_TOKEN}&Sec-MS-GEC=${secMsGEC}&Sec-MS-GEC-Version=1-143.0.3650.96&ConnectionId=${req_id}`;
        };
      }
    }
  ];

  for (const ep of endpoints) {
    try {
      console.log('Trying endpoint:', ep.name);
      ep.setup();
      const tts = new MsEdgeTTS({ connectionTimeoutMs: 25000, enableLogger: true });
      await tts.setMetadata('fa-IR-DilaraNeural', OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);

      for (const s of scenes) {
        const outFile = path.join(__dirname, 'audio', `narration_${s.id}.mp3`);
        const { audioStream } = tts.toStream(s.text, { rate: '-4%', pitch: '+2Hz' });
        const chunks = [];
        await new Promise((resolve, reject) => {
          audioStream.on('data', c => chunks.push(c));
          audioStream.on('end', resolve);
          audioStream.on('close', resolve);
          audioStream.on('error', reject);
        });
        const buf = Buffer.concat(chunks);
        fs.writeFileSync(outFile, buf);
        console.log(`Generated ${s.id}: ${buf.length} bytes`);
      }
      tts.close();
      console.log('All 6 Persian voiceover clips generated successfully!');
      break;
    } catch (err) {
      console.error(`Endpoint ${ep.name} failed:`, err.message);
    }
  }
})();
