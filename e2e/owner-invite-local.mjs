// Local-only synthetic E2E setup. Never connects to a deployed Firebase project.
import { createServer } from 'node:http';
const project = 'demo-pawpair';
const authOrigin = 'http://127.0.0.1:9099';
const firestoreOrigin = 'http://127.0.0.1:8189';
const email = 'facility-ui@example.test';
const password = 'synthetic-e2e-only';
async function authCall(method) {
  const response = await fetch(`${authOrigin}/identitytoolkit.googleapis.com/v1/accounts:${method}?key=local-emulator`, {
    method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({email,password,returnSecureToken:true}),
  });
  return { response, data:await response.json() };
}
let account = await authCall('signUp');
if (!account.response.ok && account.data.error?.message === 'EMAIL_EXISTS') account = await authCall('signInWithPassword');
if (!account.response.ok) throw new Error('Could not create synthetic emulator account. Start Auth emulator first.');
const uid = account.data.localId;
async function seed(path, fields) {
  const response = await fetch(`${firestoreOrigin}/v1/projects/${project}/databases/(default)/documents/${path}`, {
    method:'PATCH', headers:{authorization:'Bearer owner','content-type':'application/json'}, body:JSON.stringify({fields}),
  });
  if (!response.ok) throw new Error(`Emulator seed failed: ${response.status}`);
}
await seed(`facilities/${uid}`,{name:{stringValue:'UI検証施設'},active:{booleanValue:true}});
for (const [id,name] of [['ui-staff-a','検証スタッフA'],['ui-staff-b','検証スタッフB']]) {
  await seed(`facilities/${uid}/staffProfiles/${id}`,{name:{stringValue:name},active:{booleanValue:true},createdAt:{timestampValue:new Date().toISOString()}});
}
// Deliberate AI test double: validates the non-PII boundary, with no external calls.
const analysis={summary:'合成データによる検証結果',observations:['穏やか'],personalityTraits:[],compatibilitySignals:[],riskFlags:[],confidence:0.8,matchingProfile:{energyLevel:3,sociability:3,anxietyLevel:2,assertiveness:2,resourceGuarding:1,playStyles:['gentle']}};
createServer(async(req,res)=>{
  res.setHeader('access-control-allow-origin','http://127.0.0.1:5191');
  res.setHeader('access-control-allow-methods','POST,OPTIONS');
  res.setHeader('access-control-allow-headers','content-type');
  res.setHeader('content-type','application/json');
  if(req.method==='OPTIONS'){res.writeHead(204).end();return;}
  if(req.method!=='POST'||req.url!=='/api/analyze'){res.writeHead(404).end('{}');return;}
  let body='';
  for await(const chunk of req){body+=chunk; if(body.length>1024*1024){res.writeHead(413).end('{}');return;}}
  try {
    const payload=JSON.parse(body);
    const keys=Object.keys(payload.profile??{});
    if(keys.some(key=>!['personality','playStyle','precautions'].includes(key))) throw new Error('Unexpected profile keys');
    if(!Array.isArray(payload.media)||payload.media.some(item=>item.type!=='image'))throw new Error('Only silent image media allowed');
    res.end(JSON.stringify({ok:true,requestId:'synthetic-ui-e2e',model:'local-test-double',analysis}));
  }catch{res.writeHead(400).end(JSON.stringify({error:{message:'E2E privacy boundary rejected',code:'fixture_rejected'}}));}
}).listen(5193,'127.0.0.1',()=>{
  console.log('Synthetic fixture ready; external AI is NOT tested.');
  console.log(`Emulator facility UID: ${uid}`);
  console.log(`Local-only login: ${email} / ${password}`);
  console.log('AI test double: http://127.0.0.1:5193 (Ctrl+C to stop)');
});
