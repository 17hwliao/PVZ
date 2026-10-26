'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),source=fs.readFileSync(path.join(root,'game/index.html'),'utf8');
// Generate from the current production template to avoid a drifting duplicate.
// The altered base URI is confined to this developer fixture.
const html=source.replace("base-uri 'none'","base-uri 'self'").replace('<title>','<base href="/game/"><title>').replace('<script src="assets-data.js">','<script src="/tools/visual-qa/ui-cases.js"></script><script src="assets-data.js">');
fs.writeFileSync(path.join(__dirname,'visual-qa/ui-cases.html'),html);
console.log('Visual fixture generated. Serve the repository root and open /tools/visual-qa/index.html or /tools/visual-qa/ui-cases.html.');
