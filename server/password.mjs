import { scrypt, pbkdf2 } from 'node:crypto';
import { randomToken } from './auth.mjs';
// OWASP's 16 MiB scrypt profile; bounded below the Workers isolate memory limit.
const parameters={N:16384,r:8,p:5,maxmem:32*1024*1024};
const hex=key=>Array.from(new Uint8Array(key),b=>b.toString(16).padStart(2,'0')).join('');
const derive=(password,salt)=>new Promise((resolve,reject)=>scrypt(password,salt,32,parameters,(error,key)=>error?reject(error):resolve(hex(key))));
const legacy=(password,salt)=>new Promise((resolve,reject)=>pbkdf2(password,salt,600000,32,'sha256',(error,key)=>error?reject(error):resolve(hex(key))));
export function validPassword(value){return typeof value==='string'&&[...value].length>=4&&[...value].length<=128}
export async function hashPassword(password){if(!validPassword(password))throw new Error('Password must contain 4–128 characters');const salt=randomToken();return `scrypt$16384$8$5$${salt}$${await derive(password,salt)}`}
export async function verifyPassword(password,encoded){
  if(typeof password!=='string'||[...password].length>128)return false;
  const parts=(encoded||'').split('$');
  const current=parts.length===6&&parts.slice(0,4).join('$')==='scrypt$16384$8$5'&&/^[a-f0-9]{64}$/.test(parts[4])&&/^[a-f0-9]{64}$/.test(parts[5]);
  const old=parts.length===4&&parts[0]==='pbkdf2-sha256'&&parts[1]==='600000'&&/^[a-f0-9]{64}$/.test(parts[2])&&/^[a-f0-9]{64}$/.test(parts[3]);
  const actual=old?await legacy(password,parts[2]):await derive(password,current?parts[4]:'0'.repeat(64)),expected=old?parts[3]:current?parts[5]:'0'.repeat(64);
  let different=0;for(let i=0;i<64;i++)different|=actual.charCodeAt(i)^expected.charCodeAt(i);
  return (current||old)&&different===0;
}
