/* Static regression for the Spectra Client's initial hotkey configuration.
 * Run with: node tests/hotkey-defaults.mjs
 * Existing profiles may explicitly enable shortcuts in localStorage. */
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
const observer=readFileSync("angular/src/app/observer/observer.component.ts","utf8");
const service=readFileSync("src/services/hotkeyService.ts","utf8");
const flags=["spikePlanted","techPause","leftTimeout","rightTimeout","switchKdaCredits","showToast"];
function group(name,source){
  const re=new RegExp(name+"\\s*:\\s*\\{([\\s\\S]*?)\\}","m");
  const match=source.match(re);
  assert.ok(match, "Missing group: "+name);
  for(const key of flags){
    const disabled=new RegExp("\\b"+key+"\\s*:\\s*false\\s*[,\\n]");
    assert.match(match[1],disabled,"Initial shortcut "+key+" must be disabled");
  }
}
const initial=observer.match(/protected hotkeys:\s*Hotkeys\s*=\s*\{([\s\S]*?)\n  \};/);
assert.ok(initial,"Missing built-in hotkeys definition");
group("enabled",initial[1]);
const legacy=observer.match(/if \(!this\.hotkeys\.enabled\) \{([\s\S]*?)\n    \}/);
assert.ok(legacy,"Missing old-profile defaults");
group("enabled",legacy[1]);
assert.match(observer,/this\.localStorageService\.getItem<Hotkeys>\("hotkeys"\) \|\| this\.hotkeys/,"Saved settings should still load");
for(const name of ["SPIKE_PLANTED","TECH_PAUSE","LEFT_TIMEOUT","RIGHT_TIMEOUT","SWITCH_KDA_CREDITS","SHOW_TOAST"]){
  const block=service.match(new RegExp("type:\\s*HotkeyType\\."+name+"\\s*,\\s*enabled:\\s*(true|false)"));
  assert.ok(block,"Missing service shortcut "+name);
  assert.equal(block[1],"false","Electron shortcut "+name+" defaults to enabled");
}
console.log("PASS: all fresh and legacy-fallback Spectra hotkeys disabled; saved choices retained");
