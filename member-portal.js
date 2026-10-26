'use strict';
(() => {
  const $=id=>document.getElementById(id), form=$('memberForm');
  let current=null, csrf='',photoId=null,preparedPhoto=null,busy=false,loaded=false,photoSequence=0;
  const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n};
  const notice=text=>$('portalNotice').textContent=text;
  async function api(path,options={}) {
    const headers={'Content-Type':'application/json',...(csrf?{'X-LCR-CSRF':csrf}:{})};
    const response=await fetch('/api'+path,{credentials:'same-origin',cache:'no-store',...options,headers});
    const data=await response.json().catch(()=>({error:'সার্ভারের উত্তর পাওয়া যায়নি।'}));
    if(!response.ok)throw new Error(data.error||'আবার চেষ্টা করুন।');return data;
  }
  function photo(profile){const n=node('img',undefined,'portrait');n.src='/api/media/'+encodeURIComponent(profile.photoId);n.alt=profile.fullName||'প্রোফাইল ছবি';return n}
  function renderProfile(profile){const card=node('article',undefined,'profile-card');if(profile.photoId)card.append(photo(profile));card.append(node('h3',profile.fullName),node('p',profile.id));for(const key of ['profession','designation','organization','bio'])if(profile[key])card.append(node('p',profile[key]));return card}
  async function directory(){const data=await api('/profiles');$('publicDirectory').replaceChildren(...data.profiles.map(renderProfile));if(!data.profiles.length)$('publicDirectory').append(node('p','এখনো কোনো প্রোফাইল প্রকাশ করা হয়নি।'))}
  function myPhoto(){const p=current?.profile;$('myPhoto').replaceChildren();if(photoId&&p)$('myPhoto').append(photo({...p,photoId}));if(preparedPhoto)$('myPhoto').append(node('p','নতুন ছবিটি প্রস্তুত; ফর্ম জমা দিলে upload হবে।'))}
  async function refresh(){
    current=await api('/me');csrf=current.csrf;loaded=true;$('accountLabel').textContent=current.email;$('logout').hidden=false;$('loginButton').hidden=true;$('passwordLogin').hidden=true;
    $('passwordPanel').hidden=!current.mustChangePassword&&!current.hasPassword;
    if(current.mustChangePassword){$('myPanel').hidden=true;$('reviewPanel').hidden=true;notice('প্রথমে অস্থায়ী password পরিবর্তন করুন।');return}
    const member=current.profile,submission=current.submission;
    $('myPanel').hidden=!member;$('reviewPanel').hidden=current.role!=='admin';
    if(member){const draft=submission&&submission.status!=='approved'?submission:member;
      for(const key of ['id','fullName','mobile','profession','designation','organization','bio'])form.elements.namedItem(key).value=draft[key]||'';
      form.elements.email.value=current.email;form.elements.photo.value='';form.elements.consent.checked=false;photoId=draft.photoId;preparedPhoto=null;
      const waiting=submission?.status==='pending';$('myStatus').textContent=waiting?'পর্যালোচনাধীন':submission?.status==='returned'?'সংশোধন প্রয়োজন':'তথ্য সম্পাদনা করুন';
      $('reviewReason').textContent=submission?.status==='returned'?'পর্যালোচকের মন্তব্য: '+submission.reason:'';
      form.querySelectorAll('input:not([readonly]),textarea,button').forEach(n=>n.disabled=waiting);myPhoto();
    }
    if(current.role==='admin'){await reviews();if(current.passwordEnabled)await passwordMembers()}
  }
  async function passwordMembers(){
    const {members}=await api('/admin/password-members');$('passwordAdmin').hidden=false;
    $('passwordMembers').replaceChildren();
    for(const member of members){const row=node('form'),label=node('label',member.memberId+' · '+member.fullName+' '),password=node('input'),confirmation=node('input'),button=node('button',member.passwordSet?'Password Reset':'Password সেট করুন','subtle'),status=node('p');
      password.type=confirmation.type='password';password.required=confirmation.required=true;password.minLength=confirmation.minLength=4;password.maxLength=confirmation.maxLength=128;password.autocomplete=confirmation.autocomplete='new-password';
      password.placeholder='নিজে password লিখুন (কমপক্ষে ৪ অক্ষর)';confirmation.placeholder='Password আবার লিখুন';password.setAttribute('aria-label',member.memberId+' নতুন password');confirmation.setAttribute('aria-label',member.memberId+' password নিশ্চিত করুন');button.type='submit';status.setAttribute('role','status');
      row.addEventListener('submit',async event=>{event.preventDefault();if(password.value!==confirmation.value){status.textContent='Password দুটি মেলেনি।';return}if(!row.reportValidity())return;if(!confirm(member.memberId+'-এর password সেট/reset করবেন? পুরোনো session বন্ধ হবে।'))return;
        button.disabled=true;status.textContent='Password সংরক্ষণ হচ্ছে…';
        try{await api('/admin/reset-password',{method:'POST',body:JSON.stringify({identityId:member.identityId,password:password.value})});password.value=confirmation.value='';member.passwordSet=true;status.textContent=member.memberId+'-এর password সেট হয়েছে। ২৪ ঘণ্টার মধ্যে প্রথম login করে সদস্যকে password বদলাতে হবে।'}catch(e){status.textContent=e.message;notice(e.message)}finally{button.disabled=false;button.textContent=member.passwordSet?'Password Reset':'Password সেট করুন'}});
      row.append(label,password,confirmation,button,status);$('passwordMembers').append(row);
    }
  }
  $('hideTemporary').addEventListener('click',()=>{$('temporaryPassword').textContent='';$('hideTemporary').hidden=true});
  $('passwordLogin').addEventListener('submit',async event=>{event.preventDefault();const f=event.currentTarget,b=f.querySelector('button');b.disabled=true;
    try{await api('/auth/password',{method:'POST',body:JSON.stringify({memberId:f.elements.memberId.value,password:f.elements.password.value})});f.reset();await refresh();notice(current.mustChangePassword?'আগে অস্থায়ী password পরিবর্তন করুন।':'Login সম্পন্ন হয়েছে।')}catch(e){notice(e.message)}finally{f.elements.password.value='';b.disabled=false}});
  $('passwordChange').addEventListener('submit',async event=>{event.preventDefault();const f=event.currentTarget,b=f.querySelector('button');if(f.elements.newPassword.value!==f.elements.confirmPassword.value){notice('নতুন password দুটি মেলেনি।');return}b.disabled=true;
    try{await api('/auth/change-password',{method:'POST',body:JSON.stringify({currentPassword:f.elements.currentPassword.value,newPassword:f.elements.newPassword.value})});f.reset();location.reload()}catch(e){notice(e.message)}finally{b.disabled=false}});
  async function reviews(){const {submissions}=await api('/admin/submissions'),root=$('pendingReviews');root.replaceChildren();if(!submissions.length)root.append(node('p','কোনো জমা পর্যালোচনার অপেক্ষায় নেই।'));
    for(const item of submissions){const card=node('article',undefined,'review-card');card.append(node('h3',item.memberId));const table=node('table'),head=node('tr');['তথ্য','বর্তমান','প্রস্তাবিত'].forEach(t=>head.append(node('th',t)));table.append(head);
      for(const [key,label] of Object.entries({fullName:'নাম',mobile:'মোবাইল · ব্যক্তিগত',profession:'পেশা',designation:'পদবি',organization:'প্রতিষ্ঠান',bio:'পরিচিতি'})){const row=node('tr');row.append(node('th',label),node('td',item.before[key]||'—'),node('td',item.after[key]||'—'));table.append(row)}
      const row=node('tr');row.append(node('th','ছবি'));for(const p of [item.before,item.after]){const td=node('td');td.append(p.photoId?photo(p):node('span','ছবি নেই'));row.append(td)}table.append(row);card.append(table);
      const reason=node('input');reason.placeholder='ফেরত দেওয়ার কারণ';reason.maxLength=300;reason.setAttribute('aria-label',item.memberId+' ফেরত দেওয়ার কারণ');card.append(reason);
      for(const [action,label] of [['approved','অনুমোদন দিন'],['returned','ফেরত দিন']]){const button=node('button',label,'subtle');button.type='button';button.addEventListener('click',async()=>{if(action==='returned'&&!reason.value.trim()){notice('ফেরত দেওয়ার কারণ লিখুন।');reason.focus();return}button.disabled=true;try{await api('/admin/submissions/'+item.id,{method:'POST',body:JSON.stringify({action,reason:reason.value})});await Promise.all([directory(),reviews()]);notice('পর্যালোচনা সংরক্ষিত হয়েছে।')}catch(e){notice(e.message)}finally{button.disabled=false}});card.append(button)}root.append(card)}
  }
  form.elements.photo.addEventListener('change',async()=>{const sequence=++photoSequence,file=form.elements.photo.files[0];preparedPhoto=null;if(!file){busy=false;return}
    try{if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>5*1024*1024)throw new Error('৫ MB-এর মধ্যে JPEG, PNG বা WebP দিন।');
      busy=true;const bitmap=await createImageBitmap(file);if(sequence!==photoSequence){bitmap.close();return}const scale=Math.min(1,640/Math.max(bitmap.width,bitmap.height));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();const data=canvas.toDataURL('image/webp',0.75);if(!data.startsWith('data:image/webp;')||data.length>273100)throw new Error('আরও ছোট ছবি দিন।');preparedPhoto={mime:'image/webp',base64:data.split(',')[1]};myPhoto();notice('ছবি প্রস্তুত হয়েছে।');
    }catch(e){if(sequence===photoSequence){form.elements.photo.value='';notice(e.message)}}finally{if(sequence===photoSequence)busy=false}
  });
  $('clearPhoto').addEventListener('click',()=>{photoSequence++;busy=false;photoId=null;preparedPhoto=null;form.elements.photo.value='';myPhoto()});
  form.addEventListener('submit',async event=>{event.preventDefault();if(busy){notice('ছবি প্রস্তুত হচ্ছে, একটু অপেক্ষা করুন।');return}if(!current?.profile||!form.reportValidity())return;
    const button=form.querySelector('[type=submit]');button.disabled=true;
    try{if(preparedPhoto){const result=await api('/me/photo',{method:'POST',body:JSON.stringify(preparedPhoto)});photoId=result.photoId;preparedPhoto=null}
      const data={};for(const key of ['fullName','mobile','profession','designation','organization','bio'])data[key]=form.elements.namedItem(key).value;
      await api('/me/submissions',{method:'POST',body:JSON.stringify({...data,photoId,revision:current.profile.revision,consent:form.elements.consent.checked})});await refresh();notice('তথ্য জমা হয়েছে। অনুমোদন হলে প্রকাশিত হবে।');
    }catch(e){notice(e.message);button.disabled=false}
  });
  $('logout').addEventListener('click',async()=>{try{await api('/auth/logout',{method:'POST',body:'{}'});location.reload()}catch(e){notice(e.message)}});
  async function startLogin(clientId){const challenge=await api('/auth/challenge',{method:'POST',body:'{}'});
    if(!window.google?.accounts?.id)throw new Error('Google Login লোড হয়নি। পেজটি আবার খুলুন।');
    google.accounts.id.initialize({client_id:clientId,nonce:challenge.nonce,auto_select:false,callback:async response=>{try{await api('/auth/google',{method:'POST',body:JSON.stringify({credential:response.credential})});await refresh();notice('Login সম্পন্ন হয়েছে।')}catch(e){notice(e.message+' আবার চেষ্টা করতে পেজটি রিফ্রেশ করুন।')}}});
    google.accounts.id.renderButton($('loginButton'),{theme:'outline',size:'large',text:'signin_with'});
  }
  async function start(){try{const config=await api('/config');await directory();try{await refresh();notice(current.mustChangePassword?'প্রথমে অস্থায়ী password পরিবর্তন করুন।':'আপনার Account-এ Login করা আছে।')}catch(e){if(loaded)throw e;$('passwordLogin').hidden=!config.passwordEnabled;if(config.clientId){try{await startLogin(config.clientId)}catch(googleError){if(!config.passwordEnabled)throw googleError}}notice(config.passwordEnabled?'Member ID ও password দিয়ে Login করুন।':'নিজের অনুমোদিত Google Account দিয়ে Login করুন।')}}catch(e){notice(e.message)}}
  start();
})();
