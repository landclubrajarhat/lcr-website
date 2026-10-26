const grid=document.getElementById('memberGrid');
async function loadApprovedProfiles(){
 const count=document.getElementById('profileCount');
 const message=document.createElement('p');message.className='directory-message';message.setAttribute('role','status');
 message.textContent='অনুমোদিত পরিচিতি লোড হচ্ছে…';grid.replaceChildren(message);
 try{
  const response=await fetch('/api/profiles',{cache:'no-store'});
  if(!response.ok)throw new Error('Profiles unavailable');
  const data=await response.json();
  if(!Array.isArray(data.profiles))throw new Error('Invalid profiles');
  if(count)count.textContent=`${data.profiles.length} APPROVED PROFILES`;
  grid.replaceChildren();
  for(const profile of data.profiles){
   const card=document.createElement('article');card.className='member';
   const avatar=document.createElement('div');avatar.className='avatar';avatar.textContent=profile.fullName?.trim().slice(0,1)||'LCR';
   if(profile.photoId){
    const image=document.createElement('img');image.src=`/api/media/${encodeURIComponent(profile.photoId)}`;image.alt=profile.fullName||'সদস্যের ছবি';image.loading='lazy';
    image.addEventListener('error',()=>image.remove());avatar.append(image);
   }
   const title=document.createElement('h4');title.textContent=profile.fullName;
   card.append(avatar,title);
   for(const value of [profile.profession,profile.designation,profile.organization,profile.bio]){
    if(value){const detail=document.createElement('p');detail.textContent=value;card.append(detail);}
   }
   const code=document.createElement('small');code.textContent=profile.id;card.append(code);grid.append(card);
  }
  if(!data.profiles.length){message.textContent='এখনো কোনো পরিচিতি প্রকাশ করা হয়নি।';grid.append(message);}
 }catch(error){
  if(count)count.textContent='APPROVED PROFILES';message.textContent='পরিচিতি লোড করা যায়নি।';
  const retry=document.createElement('button');retry.type='button';retry.textContent='আবার চেষ্টা করুন';retry.addEventListener('click',loadApprovedProfiles);
  grid.replaceChildren(message,retry);
 }
}
loadApprovedProfiles();
const menu=document.getElementById('menuBtn'),nav=document.getElementById('nav');
menu.addEventListener('click',()=>{const open=nav.classList.toggle('open');menu.setAttribute('aria-expanded',String(open));menu.setAttribute('aria-label',open?'মেনু বন্ধ করুন':'মেনু খুলুন');menu.textContent=open?'✕':'☰'});
nav.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{nav.classList.remove('open');menu.textContent='☰';menu.setAttribute('aria-expanded','false')}));
document.getElementById('year').textContent=new Date().getFullYear();
const form=document.getElementById('interestForm'),status=document.getElementById('formMessage');
form.addEventListener('submit',e=>{e.preventDefault();if(!form.reportValidity())return;const data=Object.fromEntries(new FormData(form));delete data.consent;try{const existing=JSON.parse(localStorage.getItem('lcr-demo-interest')||'[]');existing.push({...data,createdAt:new Date().toISOString()});localStorage.setItem('lcr-demo-interest',JSON.stringify(existing));status.textContent='✓ আপনার ডেমো উত্তর শুধু এই ব্রাউজারে সংরক্ষিত হয়েছে। এটি LCR-এর কাছে পাঠানো হয়নি।';form.reset()}catch(err){status.textContent='এই ব্রাউজারে তথ্য সংরক্ষণ সম্ভব হয়নি। অনুগ্রহ করে ব্রাউজার সেটিংস পরীক্ষা করুন।'}});

