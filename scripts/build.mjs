import { mkdir, copyFile, rm } from 'node:fs/promises';
// Explicit allowlist: never deploy source workbooks, private imports, tests or secrets.
const files=['index.html','app.js','styles.css','profile-demo.css','member-portal.html','member-portal.js','_headers'];
await rm('public',{recursive:true,force:true});await mkdir('public',{recursive:true});
for(const file of files)await copyFile(file,'public/'+file);
console.log('Static build ready: public/ (allowlisted files only).');
