const assert = require('assert');
const fs = require('fs');
const path = require('path');
const test = require('node:test');

const source = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'screens', 'MobileRemotePanel.jsx'),
  'utf8'
);

test('mobile remote mirrors desktop remote controls in a phone layout', () => {
  assert.match(source, /const SHORTCUT_ACTIONS = Object\.freeze\(\['back', 'playPause', 'fullscreen'\]\)/);
  assert.match(source, /const DIRECTION_ACTIONS = Object\.freeze\(\['up', 'left', 'center', 'right', 'down'\]\)/);
  assert.match(source, /function normalizeRemoteTarget/);
  assert.match(source, /function isActionSupported/);
  assert.match(source, /<Text style=\{styles\.title\}>Remote<\/Text>/);
  assert.match(source, /<Text style=\{styles\.sectionLabel\}>Active app<\/Text>/);
  assert.match(source, /function friendlyRemoteStatus/);
  assert.match(source, /Scan active apps/);
  assert.match(source, /styles\.stageLabel/);
  assert.match(source, /safeRemoteTargets\.map/);
  assert.match(source, /<RemotePadButton\s+action="up"/);
  assert.match(source, /<RemotePadButton\s+action="left"/);
  assert.match(source, /<RemotePadButton\s+action="center"/);
  assert.match(source, /<RemotePadButton\s+action="right"/);
  assert.match(source, /<RemotePadButton\s+action="down"/);
  assert.match(source, /SHORTCUT_ACTIONS\.map/);
  assert.match(source, /paddingBottom: bottomPadding, paddingTop: topPadding/);
});

test('mobile remote uses mobile-sized touch targets', () => {
  assert.match(source, /targetChip:\s*\{[^}]*height: 54/);
  assert.match(source, /emptyChip:[\s\S]*height: 52/);
  assert.match(source, /refreshButton:[\s\S]*height: 48/);
  assert.match(source, /actionPill:[\s\S]*height: 48/);
});
