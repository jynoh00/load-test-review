import { readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const appRoot = resolve(__dirname, '../..');
const calloutFiles = [
  'components/FilePreview.js',
  'components/ProfileImageUpload.js',
  'features/chat/room/ChatRoomView.js',
  'features/chat/rooms/ChatRoomsView.js',
  'pages/chat/new.js',
  'pages/index.js',
  'pages/profile.js',
  'pages/register.js',
  'components/Toast.js',
];

describe('Callout usage', () => {
  it('uses the Vapor compound Callout API instead of the legacy Callout element', () => {
    const legacyUsages = calloutFiles.flatMap((file) => {
      const absolutePath = resolve(appRoot, file);
      return readFileSync(absolutePath, 'utf8')
        .split('\n')
        .flatMap((line, index) => {
          const usesLegacyCallout = /<Callout(?:[\s>]|$)/.test(line) && !/<Callout\.(Root|Icon)(?:[\s>]|$)/.test(line);
          return usesLegacyCallout ? [`${relative(appRoot, absolutePath)}:${index + 1}`] : [];
        });
    });

    expect(legacyUsages).toEqual([]);
  });
});
