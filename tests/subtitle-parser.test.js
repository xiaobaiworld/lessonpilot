/**
 * Contract checks for local teacher-provided subtitle parsing.
 * Run: node tests/subtitle-parser.test.js
 */

const { parseSubtitle } = require('../teacher-web/subtitle-parser.js');

const srt = `1
00:00:01,250 --> 00:00:04,500
A strong answer
needs an example.

2
00:00:05,000 --> 00:00:08,000
Show what changed.`;

const vtt = `WEBVTT

NOTE exported by an authorized tool

intro
00:00:01.000 --> 00:00:03.500 align:start
Start with the situation.

00:00:04.000 --> 00:00:06.000
Then explain your action.`;

const compactTimestampSrt = `1
0:0:39,0 --> 0:0:42,0
I'm hard-working, diligent, loyal, flexible and knowledgeable.`;

// The supplied interview subtitles vary the fractional width inside one file.
// Padding `,6` to 600ms would end this cue before it starts and drop it.
const variableFractionSrt = `1
0:6:21,6 --> 0:6:21,48
好的

2
0:6:21,48 --> 0:6:22,48
谢谢你，理查德`;

const checks = [
  {
    label: 'parses SRT timestamps and preserves multiline caption text',
    run: () => {
      const result = parseSubtitle(srt, 'example.srt');
      return result.ok && result.captions.length === 2
        && result.captions[0].time === '00:01'
        && result.captions[0].text === 'A strong answer needs an example.';
    }
  },
  {
    label: 'parses VTT while ignoring headers, notes, identifiers, and cue settings',
    run: () => {
      const result = parseSubtitle(vtt, 'example.vtt');
      return result.ok && result.captions.length === 2
        && result.captions[0].startSeconds === 1
        && result.captions[1].endSeconds === 6;
    }
  },
  {
    label: 'parses compact SRT timestamps from the supplied interview subtitles',
    run: () => {
      const result = parseSubtitle(compactTimestampSrt, 'interview.srt');
      return result.ok && result.captions.length === 1
        && result.captions[0].time === '00:39'
        && result.captions[0].endSeconds === 42;
    }
  },
  {
    label: 'reads the fractional field as literal milliseconds, keeping short cues',
    run: () => {
      const result = parseSubtitle(variableFractionSrt, 'interview.srt');
      return result.ok && result.captions.length === 2
        && result.captions[0].startSeconds === 381.006
        && result.captions[0].endSeconds === 381.048
        && result.captions[1].endSeconds === 382.048;
    }
  },
  {
    label: 'rejects empty or unparsable subtitle text',
    run: () => !parseSubtitle('', 'empty.srt').ok && !parseSubtitle('not a cue', 'broken.vtt').ok
  },
  {
    label: 'rejects unsupported file extensions',
    run: () => !parseSubtitle(srt, 'example.txt').ok
  }
];

let failed = 0;
checks.forEach((check) => {
  if (check.run()) {
    console.log(`PASS: ${check.label}`);
  } else {
    failed += 1;
    console.error(`FAIL: ${check.label}`);
  }
});

if (failed > 0) {
  process.exit(1);
}

console.log('All subtitle parser checks passed.');
