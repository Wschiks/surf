// Copies the app id from capacitor.config.ts into the Android and iOS projects.
// Usage: edit appId in capacitor.config.ts, then: npm run phone:id
import fs from 'node:fs';
import path from 'node:path';

const cfg = fs.readFileSync('capacitor.config.ts', 'utf8');
const next = /appId:\s*'([^']+)'/.exec(cfg)?.[1];
if (!next || !/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(next)) throw new Error(`Not a valid app id: ${next}`);
const gradle = fs.readFileSync('android/app/build.gradle', 'utf8');
const current = /applicationId "([^"]+)"/.exec(gradle)?.[1];
if (!current) throw new Error('Cannot find the current id in android/app/build.gradle');
if (current === next) {
  console.log('The app id is already', next);
  process.exit(0);
}
const swap = (file) => {
  if (!fs.existsSync(file)) return;
  const s = fs.readFileSync(file, 'utf8');
  if (s.includes(current)) fs.writeFileSync(file, s.split(current).join(next));
};
for (const f of ['android/app/build.gradle', 'android/app/src/main/res/values/strings.xml', 'ios/App/App.xcodeproj/project.pbxproj']) swap(f);
// move the Android package folder and its package line
const oldDir = path.join('android/app/src/main/java', ...current.split('.'));
const newDir = path.join('android/app/src/main/java', ...next.split('.'));
fs.mkdirSync(newDir, { recursive: true });
for (const f of fs.readdirSync(oldDir)) {
  const body = fs.readFileSync(path.join(oldDir, f), 'utf8').replace(`package ${current};`, `package ${next};`);
  fs.writeFileSync(path.join(newDir, f), body);
  fs.unlinkSync(path.join(oldDir, f));
}
// remove the emptied old folders
let dir = oldDir;
while (dir !== 'android/app/src/main/java' && fs.existsSync(dir) && fs.readdirSync(dir).length === 0) {
  fs.rmdirSync(dir);
  dir = path.dirname(dir);
}
console.log(`App id changed from ${current} to ${next}. Now run: npm run phone:sync`);
