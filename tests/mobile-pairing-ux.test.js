const assert = require('assert');
const fs = require('fs');
const path = require('path');
const test = require('node:test');

const readSource = (relativePath) => fs.readFileSync(
  path.resolve(__dirname, '..', ...relativePath),
  'utf8'
);

const qrSource = readSource(['src', 'screens', 'QRPairingScreen.jsx']);
const homeSource = readSource(['src', 'screens', 'HomeScreen.jsx']);

test('qr pairing remains recoverable when disconnected or after scan failure', () => {
  assert.match(qrSource, /const \[scanError, setScanError\] = useState\(''\)/);
  assert.match(qrSource, /onBarcodeScanned=\{scanLocked \|\| scanError \? undefined : handleBarcodeScanned\}/);
  assert.match(qrSource, /<Text style=\{styles\.scanAgainText\}>Scan again<\/Text>/);
  assert.match(qrSource, /accessibilityLabel="Close QR scanner"/);
  assert.match(qrSource, /Linking\.openSettings\(\)/);
  assert.match(qrSource, /Camera frames are not saved\./);
  assert.doesNotMatch(qrSource, /Disconnected is okay\. Scan the Desktop QR/);
});

test('home screen exposes direct recovery actions for disconnected users', () => {
  assert.match(homeSource, /function buildConnectionGuidance/);
  assert.match(homeSource, /function ConnectionRecoveryCard/);
  assert.match(homeSource, /Scan the QR from OpenX Desktop/);
  assert.match(homeSource, /primaryLabel: 'Reconnect'/);
  assert.match(homeSource, /navigation\.navigate\('QRPairing'\)/);
  assert.match(homeSource, /ListHeaderComponent=\{assistantConnectionCard\}/);
  assert.match(homeSource, /minHeight: 50/);
});
