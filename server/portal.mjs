import { hashPassword, verifyPassword, validPassword } from './password.mjs';
import { verifyGoogle, randomToken, digest, cookie, setCookie } from './auth.mjs';

export const PUBLIC_FIELDS = ['id','fullName','profession','designation','organization','bio','photoId','revision'];
export const publicProfile = row => ({id:row.id,fullName:row.full_name,profession:row.profession,designation:row.designation,organization:row.organization,bio:row.bio,photoId:row.photo_id,revision:row.revision});
const ownProfile = row => ({...publicProfile(row),mobile:row.mobile});
class Problem extends Error { constructor(status, message) { super(message); this.status = status; } }
const fail = (status,message) => { throw new Problem(status,message); };
const json = (data,status=200,extra={}) => Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer',...extra}});
const now = () => Math.floor(Date.now()/1000);
async function body(request,limit=16384) {
  if (!request.headers.get('content-type')?.startsWith('application/json')) fail(415,'JSON প্রয়োজন।');
  if (Number(request.headers.get('content-length'))>limit) fail(413,'তথ্যের আকার বেশি।');
  const reader=request.body?.getReader(); if(!reader) fail(400,'তথ্য পাওয়া যায়নি।');
  let size=0, chunks=[];
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();fail(413,'তথ্যের আকার বেশি।')}chunks.push(value)}
  const all=new Uint8Array(size);let offset=0;for(const chunk of chunks){all.set(chunk,offset);offset+=chunk.length}
  try{return JSON.parse(new TextDecoder().decode(all))}catch{fail(400,'তথ্যের বিন্যাস সঠিক নয়।')}
}
async function rate(db,key,max,period=60) {
  const bucket=Math.floor(now()/period), k=`${key}:${bucket}`;
  const r=await db.prepare('INSERT INTO rate_limits(key,count,expires) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count').bind(k,(bucket+2)*period).first();
  if(r.count>max)fail(429,'অনেকবার চেষ্টা হয়েছে। কিছুক্ষণ পরে চেষ্টা করুন।');
}
async function actor(request,db,mutation=false,passwordEnabled=false) {
  const token=cookie(request,'__Host-lcr-session');if(!/^[a-f0-9]{64}$/.test(token))fail(401,'আগে Login করুন।');
  const user=await db.prepare('SELECT i.*,s.csrf FROM sessions s JOIN identities i ON i.id=s.identity_id WHERE s.token_hash=? AND s.expires>? AND i.active=1').bind(await digest(token),now()).first();
  if(!user)fail(401,'আবার Login করুন।');
  if(mutation&&request.headers.get('X-LCR-CSRF')!==user.csrf)fail(403,'অনুরোধটি যাচাই করা যায়নি।');
  if(passwordEnabled){const credential=await db.prepare('SELECT must_change FROM member_passwords WHERE identity_id=?').bind(user.id).first();user.must_change=credential?.must_change===1;user.has_password=!!credential;}
  return user;
}
export function validateProfile(data) {
  if(!data||typeof data!=='object'||Array.isArray(data))fail(400,'প্রোফাইল প্রয়োজন।');
  const allowed=['fullName','mobile','profession','designation','organization','bio','photoId','revision','consent'];
  if(Object.keys(data).some(k=>!allowed.includes(k)))fail(400,'অনুমোদিত নয় এমন তথ্য রয়েছে।');
  const out={};for(const [key,max] of Object.entries({fullName:80,mobile:11,profession:80,designation:80,organization:120,bio:500})){
    if(typeof data[key]!=='string'||data[key].trim().length>max)fail(400,'তথ্যের দৈর্ঘ্য বা ধরন সঠিক নয়।');out[key]=data[key].trim();
  }
  if(!out.fullName||!out.profession)fail(400,'নাম ও পেশা পূরণ করুন।');
  if(out.mobile&&!/^01[0-9]{9}$/.test(out.mobile))fail(400,'মোবাইল নম্বর সঠিক নয়।');
  if(data.consent!==true||!Number.isSafeInteger(data.revision)||data.revision<0)fail(400,'সম্মতি ও সঠিক revision প্রয়োজন।');
  if(data.photoId!==null&&(typeof data.photoId!=='string'||!/^[a-f0-9-]{36}$/.test(data.photoId)))fail(400,'ছবির পরিচিতি সঠিক নয়।');
  return {...out,photoId:data.photoId,revision:data.revision};
}
export function imageBytes(data) {
  if(!data||!['image/png','image/jpeg','image/webp'].includes(data.mime)||typeof data.base64!=='string'||data.base64.length>280000)fail(400,'JPEG, PNG বা WebP ছবি দিন।');
  let bytes;try{bytes=Uint8Array.from(atob(data.base64),c=>c.charCodeAt(0))}catch{fail(400,'ছবির তথ্য সঠিক নয়।')}
  if(bytes.length<16||bytes.length>204800)fail(413,'ছবি সর্বোচ্চ ২০০ KB হতে হবে।');
  const start=Array.from(bytes.slice(0,12)),ascii=new TextDecoder('ascii').decode(bytes.slice(0,12));
  const valid=data.mime==='image/png'?start.slice(0,8).join(',')==='137,80,78,71,13,10,26,10':data.mime==='image/jpeg'?start[0]===255&&start[1]===216&&start[2]===255:ascii.startsWith('RIFF')&&ascii.slice(8)==='WEBP';
  if(!valid)fail(400,'ছবির format মেলেনি।');return bytes;
}
export async function handleRequest(request,env,{verifyIdentity=verifyGoogle}={}) {
  try {
    const url=new URL(request.url),path=url.pathname.replace(/^\/api/,'');
    if(env.MEMBER_PORTAL_ENABLED!=='true'||!env.LCR_DB||!env.APP_ORIGIN)fail(503,'Member Portal এখনো চালু করা হয়নি।');
    if(url.origin!==env.APP_ORIGIN)fail(403,'এই ঠিকানায় Portal অনুমোদিত নয়।');
    if(!['GET','POST'].includes(request.method))fail(405,'এই method অনুমোদিত নয়।');
    if(request.method==='POST'&&request.headers.get('Origin')!==env.APP_ORIGIN)fail(403,'অনুরোধের উৎস মেলেনি।');
    const db=env.LCR_DB,passwordEnabled=env.MEMBER_PASSWORD_ENABLED==='true';
    if(path==='/config'&&request.method==='GET')return json({clientId:env.GOOGLE_CLIENT_ID||null,passwordEnabled});
    if(path==='/profiles'&&request.method==='GET'){
      const {results}=await db.prepare('SELECT id,full_name,profession,designation,organization,bio,photo_id,revision FROM members WHERE published=1 ORDER BY id LIMIT 100').all();
      return json({profiles:results.map(publicProfile)});
    }
    if(path==='/auth/challenge'&&request.method==='POST'){
      await rate(db,'login:'+await digest(request.headers.get('CF-Connecting-IP')||'local'),12);
      await db.batch([db.prepare('DELETE FROM challenges WHERE expires<?').bind(now()),db.prepare('DELETE FROM sessions WHERE expires<?').bind(now()),db.prepare('DELETE FROM rate_limits WHERE expires<?').bind(now())]);
      const nonce=randomToken();await db.prepare('INSERT INTO challenges VALUES(?,?)').bind(await digest(nonce),now()+300).run();
      return json({nonce},200,{'Set-Cookie':setCookie('__Host-lcr-login',nonce,300)});
    }
    if(path==='/auth/google'&&request.method==='POST'){
      if(!env.GOOGLE_CLIENT_ID)fail(404,'Google Login চালু নেই।');
      await rate(db,'login:'+await digest(request.headers.get('CF-Connecting-IP')||'local'),12);
      const {credential}=await body(request);if(typeof credential!=='string'||credential.length>12000)fail(400,'Login token প্রয়োজন।');
      const nonce=cookie(request,'__Host-lcr-login');
      if(!/^[a-f0-9]{64}$/.test(nonce))fail(401,'নতুন করে Login শুরু করুন।');
      const challenge=await db.prepare('DELETE FROM challenges WHERE token_hash=? AND expires>? RETURNING token_hash').bind(await digest(nonce),now()).first();
      if(!challenge)fail(401,'Login মেয়াদ শেষ হয়েছে।');
      let claims;try{claims=await verifyIdentity(credential,env.GOOGLE_CLIENT_ID,nonce)}catch{fail(401,'Google পরিচয় যাচাই হয়নি।')}
      let user=await db.prepare('SELECT * FROM identities WHERE google_sub=? AND active=1').bind(claims.sub).first();
      if(!user){
        // Email enrollment is allowed only for Google-authoritative addresses preapproved by admin.
        if(!(claims.email.endsWith('@gmail.com')||claims.hd))fail(403,'এই Google Account আগে admin-কে যুক্ত করতে হবে।');
        user=await db.prepare('UPDATE identities SET google_sub=? WHERE lower(email)=? AND google_sub IS NULL AND active=1 RETURNING *').bind(claims.sub,claims.email.toLowerCase()).first();
      }
      if(!user)fail(403,'এই Account-এর সদস্যপদ অনুমোদিত নয়।');
      const token=randomToken(),csrf=randomToken();
      await db.prepare('INSERT INTO sessions VALUES(?,?,?,?)').bind(await digest(token),user.id,csrf,now()+3600).run();
      return json({ok:true},200,{'Set-Cookie':setCookie('__Host-lcr-session',token,3600)});
    }
    if(path==='/auth/password'&&request.method==='POST'){
      if(!passwordEnabled)fail(404,'Password Login চালু নেই।');
      await rate(db,'password-ip:'+await digest(request.headers.get('CF-Connecting-IP')||'local'),20,900);
      const data=await body(request),memberId=typeof data.memberId==='string'?data.memberId.trim().toUpperCase():'';
      if(!/^[A-Z0-9-]{3,40}$/.test(memberId)||typeof data.password!=='string'||data.password.length>512)fail(400,'Member ID ও password দিন।');
      await rate(db,'password-member:'+await digest(memberId),8,900);
      const identity=await db.prepare('SELECT i.*,p.password_hash,p.must_change,p.temporary_expires FROM identities i JOIN member_passwords p ON p.identity_id=i.id WHERE i.member_id=? AND i.active=1').bind(memberId).first();
      const verified=await verifyPassword(data.password,identity?.password_hash);
      if(!verified||!identity||identity.must_change&&identity.temporary_expires<=now())fail(401,'Member ID বা password সঠিক নয়, অথবা অস্থায়ী password-এর মেয়াদ শেষ।');
      const token=randomToken(),csrf=randomToken();
      const result=await db.prepare('INSERT INTO sessions SELECT ?,i.id,?,? FROM identities i JOIN member_passwords p ON p.identity_id=i.id WHERE i.id=? AND i.active=1 AND p.password_hash=?').bind(await digest(token),csrf,now()+3600,identity.id,identity.password_hash).run();
      if(!result.meta.changes)fail(401,'আবার Login করুন।');
      return json({ok:true},200,{'Set-Cookie':setCookie('__Host-lcr-session',token,3600)});
    }
    const mediaMatch=path.match(/^\/media\/([a-f0-9-]{36})$/);
    if(mediaMatch&&request.method==='GET'){
      const media=await db.prepare('SELECT * FROM media WHERE id=?').bind(mediaMatch[1]).first();if(!media)fail(404,'ছবি পাওয়া যায়নি।');
      const published=await db.prepare('SELECT id FROM members WHERE photo_id=? AND published=1').bind(media.id).first();
      if(!published){const user=await actor(request,db,false,passwordEnabled);if(user.must_change)fail(403,'আগে password পরিবর্তন করুন।');if(user.role!=='admin'&&user.member_id!==media.member_id)fail(403,'ছবিটি ব্যক্তিগত।')}
      return new Response(media.bytes,{headers:{'Content-Type':media.mime,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox"}});
    }
    const user=await actor(request,db,request.method==='POST',passwordEnabled);
    if(user.must_change&&!['/me','/auth/change-password','/auth/logout'].includes(path))fail(403,'আগে password পরিবর্তন করুন।');
    if(path==='/me'&&request.method==='GET'){
      if(user.must_change)return json({role:user.role,email:user.email,csrf:user.csrf,mustChangePassword:true,profile:null,submission:null});
      const member=user.member_id?await db.prepare('SELECT * FROM members WHERE id=?').bind(user.member_id).first():null;
      const latest=user.member_id?await db.prepare('SELECT * FROM submissions WHERE member_id=? ORDER BY submitted_at DESC,rowid DESC LIMIT 1').bind(user.member_id).first():null;
      return json({role:user.role,email:user.email,csrf:user.csrf,mustChangePassword:false,passwordEnabled,hasPassword:!!user.has_password,profile:member?ownProfile(member):null,submission:latest?{submissionId:latest.id,...ownProfile({...latest,id:user.member_id,revision:latest.base_revision}),status:latest.status,reason:latest.reason}:null});
    }
    if(path==='/auth/logout'&&request.method==='POST'){
      await db.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await digest(cookie(request,'__Host-lcr-session'))).run();
      return json({ok:true},200,{'Set-Cookie':setCookie('__Host-lcr-session','',0)});
    }
    if(path==='/auth/change-password'&&request.method==='POST'){
      if(!passwordEnabled)fail(404,'Password Login চালু নেই।');
      await rate(db,'password-change:'+user.id,5,900);const data=await body(request);
      if(!validPassword(data.newPassword)||data.newPassword===data.currentPassword)fail(400,'নতুন আলাদা password ৪–১২৮ অক্ষরের হতে হবে।');
      const old=await db.prepare('SELECT * FROM member_passwords WHERE identity_id=?').bind(user.id).first();
      if(!await verifyPassword(data.currentPassword,old?.password_hash)||!old||old.must_change&&old.temporary_expires<=now())fail(401,'বর্তমান password সঠিক নয় অথবা মেয়াদ শেষ।');
      const encoded=await hashPassword(data.newPassword);
      const result=await db.prepare('UPDATE member_passwords SET password_hash=?,must_change=0,temporary_expires=NULL,updated_at=? WHERE identity_id=? AND password_hash=?').bind(encoded,now(),user.id,old.password_hash).run();
      if(!result.meta.changes)fail(409,'Password বদলেছে। আবার Login করুন।');
      return json({ok:true},200,{'Set-Cookie':setCookie('__Host-lcr-session','',0)});
    }
    if(path==='/me/photo'&&request.method==='POST'){
      if(!user.member_id)fail(403,'সদস্য প্রোফাইল প্রয়োজন।');await rate(db,'photo:'+user.id,4);
      const count=await db.prepare('SELECT count(*) AS n FROM media WHERE member_id=?').bind(user.member_id).first();if(count.n>=8)fail(409,'ছবির সীমা পূর্ণ। admin-এর সাহায্য নিন।');
      const data=await body(request,300000),bytes=imageBytes(data),id=crypto.randomUUID();
      const uploaded=await db.prepare('INSERT INTO media SELECT ?,?,?,?,? WHERE (SELECT count(*) FROM media WHERE member_id=?)<8').bind(id,user.member_id,data.mime,bytes.buffer,now(),user.member_id).run();
      if(!uploaded.meta.changes)fail(409,'ছবির সীমা পূর্ণ। admin-এর সাহায্য নিন।');return json({photoId:id},201);
    }
    if(path==='/me/submissions/withdraw'&&request.method==='POST'){
      if(!user.member_id)fail(403,'সদস্য প্রোফাইল প্রয়োজন।');
      const data=await body(request);if(typeof data.submissionId!=='string'||!/^[a-f0-9-]{36}$/.test(data.submissionId))fail(400,'সঠিক জমা নির্বাচন করুন।');
      const changed=await db.prepare("UPDATE submissions SET status='returned',reason='সদস্য নিজে সংশোধনের জন্য ফিরিয়ে নিয়েছেন।',reviewer_id=?,reviewed_at=? WHERE id=? AND member_id=? AND status='pending'").bind(user.id,now(),data.submissionId,user.member_id).run();
      if(!changed.meta.changes)fail(409,'জমাটি ইতোমধ্যে পর্যালোচনা হয়েছে। পেজটি আবার খুলুন।');
      return json({ok:true});
    }
    if(path==='/me/submissions'&&request.method==='POST'){
      if(!user.member_id)fail(403,'সদস্য প্রোফাইল প্রয়োজন।');await rate(db,'submit:'+user.id,6);
      const data=validateProfile(await body(request)),member=await db.prepare('SELECT revision FROM members WHERE id=?').bind(user.member_id).first();
      if(!member||member.revision!==data.revision)fail(409,'প্রোফাইল বদলেছে। পেজটি আবার খুলুন।');
      if(data.photoId&&!await db.prepare('SELECT id FROM media WHERE id=? AND member_id=?').bind(data.photoId,user.member_id).first())fail(403,'এই ছবিটি আপনার নয়।');
      try{await db.prepare("INSERT INTO submissions(id,member_id,base_revision,full_name,mobile,profession,designation,organization,bio,photo_id,publication_consent,status,submitted_at) VALUES(?,?,?,?,?,?,?,?,?,?,1,'pending',?)").bind(crypto.randomUUID(),user.member_id,data.revision,data.fullName,data.mobile,data.profession,data.designation,data.organization,data.bio,data.photoId,now()).run()}catch(e){if(String(e).includes('UNIQUE'))fail(409,'আগের জমা এখনো পর্যালোচনাধীন।');throw e}
      return json({ok:true},201);
    }
    if(user.role!=='admin')fail(403,'Admin অনুমতি প্রয়োজন।');
    if(path==='/admin/submissions'&&request.method==='GET'){
      const {results}=await db.prepare("SELECT * FROM submissions WHERE status='pending' ORDER BY submitted_at LIMIT 100").all();
      const submissions=[];for(const row of results){const m=await db.prepare('SELECT * FROM members WHERE id=?').bind(row.member_id).first();submissions.push({id:row.id,memberId:row.member_id,submittedAt:row.submitted_at,before:ownProfile(m),after:ownProfile({...row,id:row.member_id,revision:row.base_revision})})}
      return json({submissions});
    }
    if(path==='/admin/password-members'&&request.method==='GET'){
      if(!passwordEnabled)fail(404,'Password Login চালু নেই।');
      const {results}=await db.prepare("SELECT i.id,i.member_id,m.full_name,p.must_change FROM identities i JOIN members m ON m.id=i.member_id LEFT JOIN member_passwords p ON p.identity_id=i.id WHERE i.active=1 AND i.role='member' ORDER BY i.member_id LIMIT 100").all();
      return json({members:results.map(r=>({identityId:r.id,memberId:r.member_id,fullName:r.full_name,passwordSet:r.must_change!==null}))});
    }
    if(path==='/admin/reset-password'&&request.method==='POST'){
      if(!passwordEnabled)fail(404,'Password Login চালু নেই।');
      await rate(db,'password-reset:'+user.id,10,900);const data=await body(request);
      if(typeof data.identityId!=='string'||data.identityId.length>100)fail(400,'সদস্য নির্বাচন করুন।');
      const target=await db.prepare("SELECT id,member_id FROM identities WHERE id=? AND role='member' AND active=1").bind(data.identityId).first();
      if(!target)fail(404,'সদস্য পাওয়া যায়নি।');
      if(!validPassword(data.password))fail(400,'Password কমপক্ষে ৪ এবং সর্বোচ্চ ১২৮ অক্ষরের হতে হবে।');
      const temporaryPassword=data.password;let encoded;
      try{encoded=await hashPassword(temporaryPassword)}catch(error){
        // These fixed categories disclose no password, salt, hash or raw exception.
        const detail=String(error?.message||'');
        const code=/not implemented|not supported|is not a function/i.test(detail)?'HASH_RUNTIME_UNSUPPORTED':/memory|maxmem/i.test(detail)?'HASH_MEMORY_LIMIT':'HASH_DERIVATION_FAILED';
        fail(503,code+': Password তৈরি হয়নি। এই error code দিয়ে Admin-এর সহায়তা নিন।');
      }
      try{await db.batch([
        db.prepare('INSERT INTO member_passwords(identity_id,password_hash,must_change,temporary_expires,updated_at) VALUES(?,?,1,?,?) ON CONFLICT(identity_id) DO UPDATE SET password_hash=excluded.password_hash,must_change=1,temporary_expires=excluded.temporary_expires,updated_at=excluded.updated_at').bind(target.id,encoded,now()+86400,now()),
        db.prepare('INSERT INTO audit_log VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),user.id,'password_reset',target.id,now())
      ])}catch{
        fail(503,'RESET_STORAGE_FAILED: Password সংরক্ষণ হয়নি। Database table ও trigger পরীক্ষা প্রয়োজন।');
      }
      return json({memberId:target.member_id,ok:true,expiresInHours:24});
    }
    const review=path.match(/^\/admin\/submissions\/([a-f0-9-]{36})$/);
    if(review&&request.method==='POST'){
      await rate(db,'review:'+user.id,20);const data=await body(request);
      if(!['approved','returned'].includes(data.action)||typeof data.reason!=='string'||data.reason.length>300||data.action==='returned'&&!data.reason.trim())fail(400,'সঠিক সিদ্ধান্ত ও ফেরতের কারণ দিন।');
      let changed;try{changed=await db.prepare("UPDATE submissions SET status=?,reason=?,reviewer_id=?,reviewed_at=? WHERE id=? AND status='pending'").bind(data.action,data.reason.trim(),user.id,now(),review[1]).run()}catch(e){if(String(e).includes('STALE_REVISION'))fail(409,'প্রোফাইল বদলেছে। জমাটি ফেরত দিন।');throw e}
      if(changed.meta.changes===0)fail(409,'এই জমা আগেই পর্যালোচনা হয়েছে।');return json({ok:true});
    }
    fail(404,'পাওয়া যায়নি।');
  }catch(error){return json({error:error instanceof Problem?error.message:'সেবা আপাতত পাওয়া যাচ্ছে না।'},error instanceof Problem?error.status:503)}
}
