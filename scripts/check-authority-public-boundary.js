#!/usr/bin/env node
'use strict';
// Repository and Pages boundary, including public test sources. No private
// fixtures, trusted results or deployment credentials may enter this repo.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
const files=[...new Set([...cp.execFileSync('git',['ls-files','-z'],{cwd:root,encoding:'utf8'}).split('\0'),
 ...cp.execFileSync('git',['ls-files','--others','--exclude-standard','-z'],{cwd:root,encoding:'utf8'}).split('\0')])].filter(Boolean);
const findings=[];
for(const file of files){
 if(/^(backend|engine|agent-lab|oracle|oracle-lab|auditor|director|shared\/certification)(\/|$)/i.test(file)
  ||/(^|\/)\.env($|\.)|service-account.*\.json$|\.(pem|key|p12|pfx)$|trusted.*snapshot.*\.json$|certification.*receipt.*\.json$/i.test(file))findings.push({file,reason:'private path'});
 if(!/\.(js|html|json|ya?ml|txt|md)$/.test(file))continue;
 const text=fs.readFileSync(path.join(root,file),'utf8');
 if(/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text)||/"type"\s*:\s*"service_account"/.test(text)
  ||/"private_key"\s*:\s*"[^"\s]+/.test(text))findings.push({file,reason:'credential material'});
 if(file.endsWith('.json')){
  const data=JSON.parse(text);
  if(/^D1_TRUSTED_SNAPSHOT|^TRUSTED_CALCULATION_EXECUTION/.test(data?.schemaVersion||'')
   ||data?.snapshot_payload||data?.mapping_payload)findings.push({file,reason:'private evidence payload'});
 }
}
if(findings.length){console.error(JSON.stringify(findings));process.exit(1);}
// Pages workflow uses an explicit runtime allowlist: test, scripts and docs
// are not copied. Its publication manifest may not broaden to repository root.
const workflow=fs.readFileSync(path.join(root,'.github/workflows/pages.yml'),'utf8');
if(!workflow.includes('cp -R css js frontend en _site/')||/cp\s+-R?\s+\.\s+_site/.test(workflow))throw Error('Pages allowlist changed');
console.log(JSON.stringify({repositoryFiles:files.length,privateLeakage:0,publicationTestFiles:0,
 demoAuth:'Existing prototype auth is not backend authentication; only real JWT routes supply authority.',result:'PASS'}));
