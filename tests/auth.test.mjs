import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPair,exportJWK,createLocalJWKSet,SignJWT } from 'jose';
import { verifyWithKeys } from '../server/auth.mjs';

test('signed Google-style tokens enforce signature, issuer, audience, expiry, age, nonce and verification',async()=>{
  const {privateKey,publicKey}=await generateKeyPair('RS256'),jwk=await exportJWK(publicKey);jwk.kid='offline-test';jwk.alg='RS256';const resolver=createLocalJWKSet({keys:[jwk]});
  const time=Math.floor(Date.now()/1000),base={iss:'https://accounts.google.com',aud:'client',sub:'12345',iat:time,exp:time+300,email:'member@gmail.com',email_verified:true,nonce:'one-use-nonce'};
  const sign=(claims,key=privateKey)=>new SignJWT(claims).setProtectedHeader({alg:'RS256',kid:'offline-test'}).sign(key);
  const valid=await sign(base);assert.equal((await verifyWithKeys(valid,'client',base.nonce,resolver)).sub,'12345');
  for(const altered of [{...base,iss:'https://evil.invalid'},{...base,aud:'other-client'},{...base,exp:time-1},{...base,iat:time-1000},{...base,email_verified:false},{...base,nonce:'wrong'}])await assert.rejects(verifyWithKeys(await sign(altered),'client',base.nonce,resolver));
  const other=await generateKeyPair('RS256');await assert.rejects(verifyWithKeys(await sign(base,other.privateKey),'client',base.nonce,resolver));
  const noNonce={...base};delete noNonce.nonce;await assert.rejects(verifyWithKeys(await sign(noNonce),'client',base.nonce,resolver));
});
