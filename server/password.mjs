import { pbkdf2 } from 'node:crypto';
import { randomToken } from './auth.mjs';
const iterations=600000;
const derive=(password,salt)=>new Promise((resolve,reject)=>pbkdf2(password,salt,iterations,32,'sha256',(error,key)=>error?reject(error):resolve(key.toString('hex'))));
export function validPassword(value){return typeof value==='string'&&[...value].length>=15&&[...value].length<=128}
export async function hashPassword(password){if(!validPassword(password))throw new Error('Password must contain 15–128 characters');const salt=randomToken();return `pbkdf2-sha256$${iterations}$${salt}$${await derive(password,salt)}`}
export async function verifyPassword(password,encoded){
  if(typeof password!=='string'||[...password].length>128)return false;
  const parts=(encoded||'').split('$');
  const valid=parts.length===4&&parts[0]==='pbkdf2-sha256'&&parts[1]===String(iterations)&&/^[a-f0-9]{64}$/.test(parts[2])&&/^[a-f0-9]{64}$/.test(parts[3]);
  const actual=await derive(password,valid?parts[2]:'0'.repeat(64)),expected=valid?parts[3]:'0'.repeat(64);
  let different=0;for(let i=0;i<64;i++)different|=actual.charCodeAt(i)^expected.charCodeAt(i);
  return valid&&different===0;
}
