/* tail_end.js — summary + exit code */
'use strict';
console.log('==================================');
console.log('PASS: '+PASS+'   FAIL: '+FAIL);
if(FAIL){console.log('Failed checks:');FAILS.forEach(f=>console.log('  - '+f));process.exit(1)}
process.exit(0);
