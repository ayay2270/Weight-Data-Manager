(() => {
  const userInput = document.querySelector('#current-user');
  const saved = localStorage.getItem('wdm_current_user') || '';
  if (userInput) userInput.value = saved;
  const syncUser = () => {
    const name = (userInput?.value || '').trim() || 'Unknown';
    document.querySelectorAll('.current-user-field').forEach(el => el.value = name);
    document.querySelectorAll('.measured-by').forEach(el => { if (!el.value) el.value = name === 'Unknown' ? '' : name; });
  };
  syncUser();
  document.querySelector('#save-user')?.addEventListener('click', () => {
    const name = userInput.value.trim();
    if (!name) return showToast('Please enter your name.');
    localStorage.setItem('wdm_current_user', name); syncUser(); showToast(`Current user: ${name}`);
  });
  userInput?.addEventListener('change', syncUser);
  document.querySelectorAll('form').forEach(form => form.addEventListener('submit', syncUser));
  document.querySelectorAll('[data-href]').forEach(row => row.addEventListener('click', e => { if (!e.target.closest('a,button,input')) location.href = row.dataset.href; }));

  const level = document.querySelector('#level'), unit = document.querySelector('#unit'), packageBox = document.querySelector('#package-fields');
  const updateLevel = () => { if (!level) return; packageBox?.classList.toggle('visible', level.value === 'Package'); const map={Part:'g',Node:'kg',Rack:'kg',Package:'kg'}; if (!document.querySelector('input[name=version]')?.value || document.querySelector('input[name=version]').value === '0') unit.value=map[level.value]; };
  level?.addEventListener('change', updateLevel); updateLevel();
  const valueType=document.querySelector('#value-type'), weight=document.querySelector('#weight');
  const updateWeight=()=>{if(!valueType||!weight)return;const t=valueType.value==='TBD';weight.disabled=t;weight.required=!t;if(t)weight.value='';};valueType?.addEventListener('change',updateWeight);updateWeight();

  document.querySelectorAll('[data-export]').forEach(btn => btn.addEventListener('click', () => { const form=document.querySelector('#export-form'); const q=new URLSearchParams(new FormData(form)); location.href=`/export.${btn.dataset.export}?${q}`; }));
  function showToast(message){const el=document.querySelector('#toast');if(!el)return;el.textContent=message;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),2600)}

  if (document.body.dataset.live === 'true') {
    let revision = null, quiet = false;
    const poll = async () => { try { const data=await fetch('/api/revision',{cache:'no-store'}).then(r=>r.json()); if(revision && revision!==data.revision && !quiet){quiet=true;showToast('New shared data received. Refreshing…');setTimeout(()=>location.reload(),800)} revision=data.revision; } catch(_){} };
    poll(); setInterval(poll, Number(document.body.dataset.pollSeconds||7)*1000);
  }
})();

