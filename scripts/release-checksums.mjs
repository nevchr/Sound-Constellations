import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readFile, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';
const pkg = JSON.parse(await readFile('package.json', 'utf8'));
const directory = path.resolve(pkg.build.directories.output);
const files = [
  `Sound-Constellations-Setup-${pkg.version}-x64.exe`,
  `Sound-Constellations-Portable-${pkg.version}-x64.exe`,
];
const records = [];
for (const name of files) {
  const filename = path.join(directory, name);
  const digest = createHash('sha256');
  for await (const chunk of createReadStream(filename)) digest.update(chunk);
  records.push({ name, bytes: (await stat(filename)).size, sha256: digest.digest('hex') });
}
await writeFile(
  path.join(directory, 'SHA256SUMS.txt'),
  records.map((record) => `${record.sha256}  ${record.name}`).join('\n') + '\n',
);
await writeFile(
  path.join(directory, 'release-manifest.json'),
  JSON.stringify(
    {
      product: 'Sound Constellations',
      version: pkg.version,
      platform: 'Windows x64',
      signed: false,
      builtAt: new Date().toISOString(),
      files: records,
    },
    null,
    2,
  ) + '\n',
);
console.log(JSON.stringify(records, null, 2));
