const assert = require('assert');
const fs = require('fs');
const path = require('path');
const test = require('node:test');

const source = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'screens', 'MobileRemotePanel.jsx'),
  'utf8'
);

test('mobile remote mirrors desktop remote controls in a phone layout', () => {
  assert.match(source, /const DIRECTION_ACTIONS = Object\.freeze\(\['up', 'left', 'center', 'right', 'down'\]\)/);
  assert.match(source, /const MEDIA_ACTIONS = Object\.freeze\(\['previous', 'playPause', 'next', 'seekBack', 'seekForward', 'fullscreen'\]\)/);
  assert.match(source, /const PRESENTATION_ACTIONS = Object\.freeze\(\['slideshow', 'previous', 'next', 'exit'\]\)/);
  assert.match(source, /const SOCIAL_ACTIONS = Object\.freeze\(\['left', 'center', 'right', 'back'\]\)/);
  assert.match(source, /function remoteActionsForTarget/);
  assert.match(source, /function normalizeRemoteTarget/);
  assert.match(source, /function isActionSupported/);
  assert.match(source, /<Text style=\{styles\.title\}>Remote<\/Text>/);
  assert.match(source, /<Text style=\{styles\.sectionLabel\}>Active app<\/Text>/);
  assert.match(source, /function friendlyRemoteStatus/);
  assert.match(source, /function isRoutineReadyStatus/);
  assert.match(source, /Scan active apps/);
  assert.match(source, /safeRemoteTargets\.map/);
  assert.match(source, /<RemotePadButton\s+action="up"/);
  assert.match(source, /<RemotePadButton\s+action="left"/);
  assert.match(source, /<RemotePadButton\s+action="center"/);
  assert.match(source, /<RemotePadButton\s+action="right"/);
  assert.match(source, /<RemotePadButton\s+action="down"/);
  assert.match(source, /quickActions\.map/);
  assert.match(source, /showStatus/);
  assert.match(source, /paddingBottom: bottomPadding, paddingTop: topPadding/);
});

test('mobile remote uses mobile-sized touch targets', () => {
  assert.match(source, /targetChip:[\s\S]*height: 48/);
  assert.match(source, /emptyChip:[\s\S]*height: 48/);
  assert.match(source, /refreshButton:[\s\S]*height: 44/);
  assert.match(source, /remoteDisc:[\s\S]*height: 216/);
  assert.match(source, /actionPill:[\s\S]*height: 46/);
});
