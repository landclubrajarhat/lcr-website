const grid=document.getElementById('memberGrid');
for(let i=1;i<=20;i++){
 const card=document.createElement('article');card.className='member';
 const avatar=document.createElement('div');avatar.className='avatar';avatar.textContent=String(i).padStart(2,'0');
 const title=document.createElement('h4');title.textContent=`সদস্য ${String(i).padStart(2,'0')}`;
 const subtitle=document.createElement('p');subtitle.textContent='পরিচিতি শীঘ্রই যুক্ত হবে';
 const code=document.createElement('small');code.textContent=`LCR-M${String(i).padStart(3,'0')} · DEMO`;
 card.append(avatar,title,subtitle,code);grid.append(card);
}
const menu=document.getElementById('menuBtn'),nav=document.getElementById('nav');
menu.addEventListener('click',()=>{const open=nav.classList.toggle('open');menu.setAttribute('aria-expanded',String(open));menu.setAttribute('aria-label',open?'মেনু বন্ধ করুন':'মেনু খুলুন');menu.textContent=open?'✕':'☰'});
nav.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{nav.classList.remove('open');menu.textContent='☰';menu.setAttribute('aria-expanded','false')}));
document.getElementById('year').textContent=new Date().getFullYear();
const form=document.getElementById('interestForm'),status=document.getElementById('formMessage');
form.addEventListener('submit',e=>{e.preventDefault();if(!form.reportValidity())return;const data=Object.fromEntries(new FormData(form));delete data.consent;try{const existing=JSON.parse(localStorage.getItem('lcr-demo-interest')||'[]');existing.push({...data,createdAt:new Date().toISOString()});localStorage.setItem('lcr-demo-interest',JSON.stringify(existing));status.textContent='✓ আপনার ডেমো উত্তর শুধু এই ব্রাউজারে সংরক্ষিত হয়েছে। এটি LCR-এর কাছে পাঠানো হয়নি।';form.reset()}catch(err){status.textContent='এই ব্রাউজারে তথ্য সংরক্ষণ সম্ভব হয়নি। অনুগ্রহ করে ব্রাউজার সেটিংস পরীক্ষা করুন।'}});
