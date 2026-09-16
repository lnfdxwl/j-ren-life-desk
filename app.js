/* ============================================================
 * J人生活台 v2 - app.js
 * 12 modules, left-right layout
 * ============================================================ */

/* ===== IndexedDB ===== */
const DB = {
  db:null, DB_NAME:'LifeDashboard', DB_VERSION:2,
  STORES:['wardrobe','consumables','expiry','travel','weekend','holidays','health','notes','packing','books','movies','shopping'],
  async init(){
    return new Promise((res,rej)=>{
      const r=indexedDB.open(this.DB_NAME,this.DB_VERSION);
      r.onupgradeneeded=e=>{
        const db=e.target.result;
        this.STORES.forEach(s=>{if(!db.objectStoreNames.contains(s))db.createObjectStore(s,{keyPath:'id'});});
      };
      r.onsuccess=e=>{this.db=e.target.result;res();};
      r.onerror=e=>rej(e.target.error);
    });
  },
  _tx(s,m='readonly'){return this.db.transaction(s,m).objectStore(s);},
  async add(s,d){d.id=d.id||(Date.now()+'_'+Math.random().toString(36).slice(2,8));d.createdAt=d.createdAt||Date.now();return new Promise((res,rej)=>{const r=this._tx(s,'readwrite').add(d);r.onsuccess=()=>res(d);r.onerror=()=>rej(r.error);});},
  async put(s,d){return new Promise((res,rej)=>{const r=this._tx(s,'readwrite').put(d);r.onsuccess=()=>res(d);r.onerror=()=>rej(r.error);});},
  async del(s,id){return new Promise((res,rej)=>{const r=this._tx(s,'readwrite').delete(id);r.onsuccess=()=>res();r.onerror=()=>rej(r.error);});},
  async get(s,id){return new Promise((res,rej)=>{const r=this._tx(s).get(id);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});},
  async all(s){return new Promise((res,rej)=>{const r=this._tx(s).getAll();r.onsuccess=()=>res(r.result||[]);r.onerror=()=>rej(r.error);});},
  async search(s,q){const a=await this.all(s);if(!q)return a;const l=q.toLowerCase();return a.filter(i=>JSON.stringify(i).toLowerCase().includes(l));}
};

/* ===== Utils ===== */
const U={
  fmtDate(t){const d=new Date(t);return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;},
  fmtShort(t){const d=new Date(t);return`${d.getMonth()+1}/${d.getDate()}`;},
  today(){const d=new Date();return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;},
  daysBetween(ds){const t=new Date(ds+'T00:00:00'),n=new Date();n.setHours(0,0,0,0);return Math.ceil((t-n)/86400000);},
  readFile(f){return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(f);});},
  toast(m){const e=document.getElementById('toast');e.textContent=m;e.classList.add('show');setTimeout(()=>e.classList.remove('show'),2000);},
  esc(s){if(!s)return'';const d=document.createElement('div');d.textContent=s;return d.innerHTML;},
  lunarToSolar(y,lm,ld){
    const cny={'2024':'2024-02-10','2025':'2025-01-29','2026':'2026-02-17','2027':'2027-02-06','2028':'2028-01-26','2029':'2029-02-13','2030':'2030-02-03','2031':'2031-01-23','2032':'2032-02-11'};
    const c=cny[y];if(!c)return null;const b=new Date(c+'T00:00:00');const d=(lm-1)*29.5+(ld-1);return new Date(b.getTime()+d*86400000);
  }
};

/* ===== Module Config ===== */
const MODULES=[
  {id:'wardrobe',name:'电子衣橱',icon:'👕',color:'#ec4899'},
  {id:'consumables',name:'生活消耗',icon:'📦',color:'#3b82f6'},
  {id:'expiry',name:'赏味期限',icon:'⏰',color:'#f59e0b'},
  {id:'travel',name:'旅行记录',icon:'🗺️',color:'#22c55e'},
  {id:'weekend',name:'周末玩耍',icon:'🎉',color:'#a855f7'},
  {id:'holidays',name:'节日记录',icon:'🎊',color:'#ef4444'},
  {id:'health',name:'身体倍棒',icon:'💪',color:'#14b8a6'},
  {id:'notes',name:'生活备忘',icon:'📝',color:'#6366f1'},
  {id:'packing',name:'行李清单',icon:'🎒',color:'#f97316'},
  {id:'books',name:'读书清单',icon:'📚',color:'#0891b2'},
  {id:'movies',name:'电影清单',icon:'🎬',color:'#7c3aed'},
  {id:'shopping',name:'购物清单',icon:'🛒',color:'#059669'}
];

/* ===== App ===== */
const App={
  currentModule:null, editId:null, confirmCb:null,

  async init(){
    await DB.init();
    await MH.seedHolidays();
    this.renderSidebar();
    if('serviceWorker'in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});
  },

  renderSidebar(){
    const el=document.getElementById('sidebarTabs');
    el.innerHTML=MODULES.map(m=>
      `<div class="tab-item" data-id="${m.id}" onclick="App.openModule('${m.id}')">
        <span class="tab-icon">${m.icon}</span>
        <span class="tab-name">${m.name}</span>
        <span class="tab-badge" id="badge_${m.id}"></span>
      </div>`
    ).join('');
    this.updateBadges();
  },

  async updateBadges(){
    for(const m of MODULES){
      const c=await DB.all(m.id);
      const b=document.getElementById('badge_'+m.id);
      if(b){b.textContent=c.length||'';b.className='tab-badge'+(c.length>0?' has':'');}
    }
  },

  async openModule(id){
    this.currentModule=id;
    document.querySelectorAll('.tab-item').forEach(t=>t.classList.toggle('active',t.dataset.id===id));
    const m=MODULES.find(x=>x.id===id);
    const main=document.getElementById('mainContent');
    main.innerHTML=`
      <div class="module-header">
        <h2 style="color:${m.color}">${m.icon} ${m.name}</h2>
        ${MH.hasAddButton(id)?`<button class="header-btn" style="background:${m.color}" onclick="MH.add('${id}')">+ 添加</button>`:''}
      </div>
      <div class="search-bar"><input type="text" placeholder="搜索..." oninput="MH.search('${id}',this.value)" id="searchInput"></div>
      <div class="module-content" id="moduleContent"><div class="loading">加载中...</div></div>
    `;
    await MH.render(id);
  },

  openModal(t,b){document.getElementById('modalTitle').textContent=t;document.getElementById('modalBody').innerHTML=b;document.getElementById('modal').style.display='flex';},
  closeModal(){document.getElementById('modal').style.display='none';this.editId=null;},
  saveModal(){if(this.currentModule)MH.save(this.currentModule);},
  askConfirm(t,cb){document.getElementById('confirmText').textContent=t;this.confirmCb=cb;document.getElementById('confirmDialog').style.display='flex';},
  closeConfirm(r){document.getElementById('confirmDialog').style.display='none';if(r&&this.confirmCb)this.confirmCb();this.confirmCb=null;}
};

/* ===== Module Handler ===== */
const MH={
  _q:{}, _img:null, _calYear:new Date().getFullYear(), _subTab:{},

  hasAddButton(id){
    return!['travel','weekend'].includes(id);
  },

  async render(id){
    this._q[id]=this._q[id]||'';
    const fn=this['render_'+id]||this.renderGeneric;
    await fn.call(this,id);
    App.updateBadges();
  },

  search(id,v){this._q[id]=v;this.render(id);},

  async add(id){
    const fn=this['form_'+id];
    if(fn){App.editId=null;App.openModal('添加',fn.call(this,null));}
    else this.addGeneric(id);
  },

  async edit(id,iid){
    const item=await DB.get(id,iid);
    App.editId=iid;
    const fn=this['form_'+id];
    if(fn)App.openModal('编辑',fn.call(this,item));
    else this.editGeneric(id,item);
  },

  async del(id,iid){
    App.askConfirm('确认删除？此操作不可撤销。',async()=>{
      await DB.del(id,iid);U.toast('已删除');this.render(id);App.updateBadges();
    });
  },

  async save(id){
    const fn=this['save_'+id];
    if(fn)await fn.call(this);
    else await this.saveGeneric(id);
  },

  /* --- Generic CRUD --- */
  async renderGeneric(id){
    const items=await DB.search(id,this._q[id]||'');
    const c=document.getElementById('moduleContent');
    if(!items.length){c.innerHTML=`<div class="empty-state"><div class="empty-icon">📋</div><p>还没有数据，点击右上角添加</p></div>`;return;}
    const fields=this.getFields(id);
    items.sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
    c.innerHTML=items.map(item=>{
      const title=item[fields.title]||'未命名';
      const desc=fields.desc?item[fields.desc]:'';
      const meta=fields.meta?this.renderMeta(item,fields.meta):'';
      return`<div class="item-card"><div class="item-body"><div class="item-title">${U.esc(title)}</div>${desc?`<div class="item-desc">${U.esc(desc)}</div>`:''}${meta}</div><div class="actions"><button class="action-btn edit" onclick="MH.edit('${id}','${item.id}')">编辑</button><button class="action-btn del" onclick="MH.del('${id}','${item.id}')">删除</button></div></div>`;
    }).join('');
  },

  renderMeta(item,meta){return'<div class="item-meta">'+meta.map(([l,k])=>item[k]?`<span class="tag">${l}: ${U.esc(String(item[k]))}</span>`:'').join('')+'</div>';},

  getFields(id){
    const m={consumables:{title:'name',desc:'note',meta:[['分类','category'],['数量','quantity'],['单位','unit']]},
             health:{title:'type',desc:'content',meta:[['日期','date'],['时长','duration']]},
             shopping:{title:'name',desc:null,meta:null}};
    return m[id]||{title:'name',desc:'note',meta:null};
  },

  getFormFields(id){
    const m={consumables:{name:'名称',category:'分类',quantity:'数量',unit:'单位',purchaseDate:'购入日期',note:'备注'}};
    return m[id]||{name:'名称',note:'备注'};
  },

  addGeneric(id){
    const fields=this.getFormFields(id);
    let b='';
    for(const[k,l]of Object.entries(fields))b+=`<div class="form-group"><label>${l}</label>${this.getInput(k,id)}</div>`;
    App.openModal('添加',b);
  },

  editGeneric(id,item){
    const fields=this.getFormFields(id);
    let b='';
    for(const[k,l]of Object.entries(fields))b+=`<div class="form-group"><label>${l}</label>${this.getInput(k,id,item[k]||'')}</div>`;
    App.openModal('编辑',b);
  },

  getInput(k,id,val=''){
    if(k==='note'||k==='content')return`<textarea id="f_${k}">${U.esc(val)}</textarea>`;
    if(k==='date'||k==='purchaseDate')return`<input type="date" id="f_${k}" value="${val}">`;
    if(k==='quantity'||k==='duration')return`<input type="number" id="f_${k}" value="${val}" min="0">`;
    if(k==='category'&&id==='consumables')return`<select id="f_${k}">${['纸品','清洁','个护','食品','其他'].map(c=>`<option value="${c}" ${val===c?'selected':''}>${c}</option>`).join('')}</select>`;
    return`<input type="text" id="f_${k}" value="${U.esc(String(val))}">`;
  },

  async saveGeneric(id){
    const fields=Object.keys(this.getFormFields(id));
    const d={};
    fields.forEach(k=>{const e=document.getElementById('f_'+k);if(e)d[k]=e.value.trim();});
    if(!d.name){U.toast('请填写名称');return;}
    if(App.editId){d.id=App.editId;const ex=await DB.get(id,App.editId);d.createdAt=ex.createdAt;await DB.put(id,d);U.toast('已更新');}
    else{await DB.add(id,d);U.toast('已添加');}
    App.closeModal();this.render(id);App.updateBadges();
  },

  /* ===== 1. 电子衣橱 ===== */
  _wf:'全部',
  async render_wardrobe(){
    const items=await DB.search('wardrobe',this._q['wardrobe']||'');
    const c=document.getElementById('moduleContent');
    const cats=['全部','上衣','裤子','裙子','外套','配饰','帽子','鞋','其他'];
    let f=`<div class="wardrobe-filters">${cats.map(cat=>`<button class="wardrobe-filter ${this._wf===cat?'active':''}" onclick="MH._wf='${cat}';MH.render('wardrobe')">${cat}</button>`).join('')}</div>`;
    // Outfit suggestion button
    f+=`<button class="header-btn" style="background:#ec4899;margin-bottom:10px;width:100%" onclick="MH.suggestOutfit()">✨ 搭配建议</button>`;
    let filtered=items;
    if(this._wf!=='全部')filtered=items.filter(i=>i.category===this._wf);
    if(!filtered.length){c.innerHTML=f+`<div class="empty-state"><div class="empty-icon">👕</div><p>还没有衣服，添加你的第一件吧</p></div>`;return;}
    filtered.sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
    let h=f+'<div class="wardrobe-grid">';
    filtered.forEach(item=>{
      const img=item.image||`data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect fill='%23f0f0f5' width='100' height='100'/%3E%3C/svg%3E`;
      h+=`<div class="wardrobe-item"><img src="${img}"><div class="wi-info"><div class="wi-name">${U.esc(item.name)}</div><div class="wi-tags"><span class="wi-tag">${U.esc(item.category||'未分类')}</span>${item.occasion?`<span class="wi-tag">${U.esc(item.occasion)}</span>`:''}</div></div><div class="wi-actions"><button onclick="MH.edit('wardrobe','${item.id}')">✎</button><button onclick="MH.del('wardrobe','${item.id}')">🗑</button></div></div>`;
    });
    h+='</div>';c.innerHTML=h;
  },

  async suggestOutfit(){
    const items=await DB.all('wardrobe');
    if(items.length<2){U.toast('至少添加2件衣服才能搭配');return;}
    const cats=['上衣','裤子','裙子','外套','鞋','配饰','帽子'];
    const pick=cat=>{const m=items.filter(i=>i.category===cat);return m.length?m[Math.floor(Math.random()*m.length)]:null;};
    let h='<div class="outfit-suggestion"><h3>✨ 今日搭配建议</h3><div class="outfit-grid">';
    cats.forEach(cat=>{const p=pick(cat);if(p)h+=`<div class="outfit-item"><img src="${p.image||''}" onerror="this.style.display='none'"><div class="outfit-label">${cat}: ${U.esc(p.name)}</div></div>`;});
    h+='</div></div>';
    document.getElementById('moduleContent').insertAdjacentHTML('afterbegin',h);
  },

  form_wardrobe(item){
    this._img=item?.image||null;
    return`<div class="form-group"><label>照片</label><div class="img-upload" id="imgU" onclick="document.getElementById('imgF').click()">${item?.image?`<img src="${item.image}">`:'<span class="placeholder">点击上传</span>'}</div><input type="file" id="imgF" accept="image/*" style="display:none" onchange="MH.handleImg(this)"></div>
    <div class="form-group"><label>名称</label><input type="text" id="f_name" value="${U.esc(item?.name||'')}" placeholder="白色T恤"></div>
    <div class="form-group"><label>分类</label><select id="f_category">${['上衣','裤子','裙子','外套','配饰','帽子','鞋','其他'].map(c=>`<option value="${c}" ${item?.category===c?'selected':''}>${c}</option>`).join('')}</select></div>
    <div class="form-group"><label>场合</label><input type="text" id="f_occasion" value="${U.esc(item?.occasion||'')}" placeholder="日常、正式、运动"></div>
    <div class="form-group"><label>备注</label><textarea id="f_note">${U.esc(item?.note||'')}</textarea></div>`;
  },

  async handleImg(input){const f=input.files[0];if(!f)return;const d=await U.readFile(f);this._img=d;document.getElementById('imgU').innerHTML=`<img src="${d}">`;},

  async save_wardrobe(){
    const n=document.getElementById('f_name').value.trim();if(!n){U.toast('请填写名称');return;}
    const d={name:n,category:document.getElementById('f_category').value,occasion:document.getElementById('f_occasion').value.trim(),note:document.getElementById('f_note').value.trim(),image:this._img};
    if(App.editId){d.id=App.editId;const ex=await DB.get('wardrobe',App.editId);d.createdAt=ex.createdAt;await DB.put('wardrobe',d);U.toast('已更新');}
    else{await DB.add('wardrobe',d);U.toast('已添加');}
    App.closeModal();this.render('wardrobe');App.updateBadges();
  },

  /* ===== 2. 生活消耗 (generic) ===== */

  /* ===== 3. 赏味期限 ===== */
  async render_expiry(){
    const items=await DB.search('expiry',this._q['expiry']||'');
    const c=document.getElementById('moduleContent');
    if(!items.length){c.innerHTML=`<div class="empty-state"><div class="empty-icon">⏰</div><p>还没有需要追踪的物品</p></div>`;return;}
    items.forEach(i=>{i._ed=this.calcExp(i.productionDate,i.shelfLife);i._dl=i._ed?U.daysBetween(U.fmtDate(i._ed)):null;});
    items.sort((a,b)=>(a._dl??9999)-(b._dl??9999));
    let h='';
    items.forEach(item=>{
      const d=item._dl;let b='';
      if(d===null)b='<span class="badge badge-expired">无日期</span>';
      else if(d<0)b='<span class="badge badge-expired">已过期</span>';
      else if(d<=30)b=`<span class="badge badge-danger">${d}天后过期</span>`;
      else if(d<=90)b=`<span class="badge badge-warning">${d}天后过期</span>`;
      else b=`<span class="badge badge-safe">${d}天后过期</span>`;
      const ed=item._ed?U.fmtShort(item._ed.getTime()):'';
      h+=`<div class="item-card">${item.image?`<img class="item-thumb" src="${item.image}">`:''}<div class="item-body"><div class="item-title">${U.esc(item.name)}</div><div class="item-desc">${U.esc(item.category||'')} ${item.productionDate?'| 生产: '+item.productionDate:''} ${ed?'| 到期: '+ed:''}</div><div class="item-meta">${b}</div></div><div class="actions"><button class="action-btn edit" onclick="MH.edit('expiry','${item.id}')">编辑</button><button class="action-btn del" onclick="MH.del('expiry','${item.id}')">删除</button></div></div>`;
    });
    c.innerHTML=h;
  },

  calcExp(pd,sl){if(!pd||!sl)return null;const d=new Date(pd+'T00:00:00');d.setMonth(d.getMonth()+parseInt(sl));return d;},

  form_expiry(item){
    this._img=item?.image||null;
    return`<div class="form-group"><label>照片（可选）</label><div class="img-upload" id="imgU" onclick="document.getElementById('imgF').click()">${item?.image?`<img src="${item.image}">`:'<span class="placeholder">点击上传</span>'}</div><input type="file" id="imgF" accept="image/*" style="display:none" onchange="MH.handleImg(this)"></div>
    <div class="form-group"><label>名称</label><input type="text" id="f_name" value="${U.esc(item?.name||'')}" placeholder="精华液小样"></div>
    <div class="form-group"><label>分类</label><select id="f_category">${['护肤品','美妆','食品','保健品','其他'].map(c=>`<option value="${c}" ${item?.category===c?'selected':''}>${c}</option>`).join('')}</select></div>
    <div class="form-group"><label>生产日期</label><input type="date" id="f_productionDate" value="${item?.productionDate||''}"></div>
    <div class="form-group"><label>保质期（月）</label><input type="number" id="f_shelfLife" value="${item?.shelfLife||''}" min="1" placeholder="12"></div>
    <div class="form-group"><label>备注</label><textarea id="f_note">${U.esc(item?.note||'')}</textarea></div>`;
  },

  async save_expiry(){
    const n=document.getElementById('f_name').value.trim();if(!n){U.toast('请填写名称');return;}
    const d={name:n,category:document.getElementById('f_category').value,productionDate:document.getElementById('f_productionDate').value,shelfLife:parseInt(document.getElementById('f_shelfLife').value)||0,note:document.getElementById('f_note').value.trim(),image:this._img};
    if(App.editId){d.id=App.editId;const ex=await DB.get('expiry',App.editId);d.createdAt=ex.createdAt;await DB.put('expiry',d);U.toast('已更新');}
    else{await DB.add('expiry',d);U.toast('已添加');}
    App.closeModal();this.render('expiry');App.updateBadges();
  },

  /* ===== 4. 旅行记录 (Real SVG World Map + Hover Tooltip) ===== */
  async render_travel(){
    const items=await DB.all('travel');
    const visited=new Set(items.map(i=>i.country));
    const c=document.getElementById('moduleContent');
    const totalCountries=Object.keys(COUNTRY_ISO).length;

    let h=`<div class="map-stats">
      <div class="map-stat-card"><div class="ms-val">${visited.size}</div><div class="ms-label">已去过</div></div>
      <div class="map-stat-card"><div class="ms-val total">${totalCountries}</div><div class="ms-label">总国家数</div></div>
      <div class="map-stat-card"><div class="ms-val">${((visited.size/totalCountries)*100).toFixed(0)}%</div><div class="ms-label">完成度</div></div>
    </div>`;

    h+=`<div class="map-legend"><span><span class="dot" style="background:#e2e8f0;border:1px solid #cbd5e1"></span>未去过</span><span><span class="dot" style="background:#22c55e"></span>去过</span><span><span class="dot" style="background:#e2e8f0;border:2px solid #3b82f6"></span>已选中</span><span><span class="dot" style="background:#3b82f6;color:#fff;display:flex;align-items:center;justify-content:center;font-size:0.6rem;font-weight:bold">✓</span>去过标注</span><span style="color:#94a3b8;font-size:0.72rem">点击地图上的国家查看/标注</span></div>`;

    h+=`<div class="world-map-wrap"><div id="worldMapSvg" style="min-height:200px;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:0.85rem">加载世界地图中...</div></div>`;
    h+=`<div class="map-action-panel" id="mapActionPanel" style="display:none"></div>`;

    h+=`<details class="map-tile-view"><summary>按大洲浏览</summary>`;
    for(const[continent,countries]of Object.entries(WORLD_MAP)){
      h+=`<div class="map-continent"><div class="map-continent-title">${continent}</div><div class="map-grid">`;
      countries.forEach(country=>{
        const v=visited.has(country);
        h+=`<div class="map-tile ${v?'visited':''}" onclick="MH.selectCountryFromTile('${country}')">${country}${v?' ✓':''}</div>`;
      });
      h+='</div></div>';
    }
    h+='</details>';

    if(items.length){
      h+=`<div class="section-title">已去过 ${items.length} 个地方</div>`;
      items.sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
      items.forEach(item=>{
        h+=`<div class="item-card">${item.image?`<img class="item-thumb" src="${item.image}">`:''}<div class="item-body"><div class="item-title">${U.esc(item.country)}</div><div class="item-desc">${item.date?'日期: '+item.date:''} ${item.continent?'| '+item.continent:''} ${item.note?'| '+U.esc(item.note):''}</div></div><div class="actions"><button class="action-btn edit" onclick="MH.editTravel('${item.id}')">编辑</button><button class="action-btn del" onclick="MH.del('travel','${item.id}')">删除</button></div></div>`;
      });
    }
    c.innerHTML=h;

    try{
      const resp=await fetch('world-map.svg');
      const svgText=await resp.text();
      const container=document.getElementById('worldMapSvg');
      container.innerHTML=svgText;
      const svg=container.querySelector('svg');
      svg.removeAttribute('width');
      svg.removeAttribute('height');
      svg.style.width='100%';
      svg.style.height='auto';
      svg.style.display='block';

      const panelEl=document.getElementById('mapActionPanel');
      let selectedCountry=null;

      // CRITICAL: default-fill ALL paths first so nothing is black
      svg.querySelectorAll('path').forEach(p=>{p.setAttribute('fill','#e2e8f0');p.setAttribute('stroke','#cbd5e1');p.setAttribute('stroke-width','0.5');});
      svg.querySelectorAll('g[id]').forEach(g=>{g.setAttribute('fill','#e2e8f0');g.setAttribute('stroke','#cbd5e1');g.setAttribute('stroke-width','0.5');});

      const refreshVisited=async()=>{const ni=await DB.all('travel');items.length=0;items.push(...ni);visited.clear();ni.forEach(i=>visited.add(i.country));};

      const applyVisuals=(el,countryName,isSelected)=>{
        const v=visited.has(countryName);
        el.setAttribute('fill',v?'#22c55e':'#e2e8f0');
        if(isSelected){el.setAttribute('stroke','#3b82f6');el.setAttribute('stroke-width','1.8');el.style.filter='drop-shadow(0 0 4px rgba(59,130,246,0.7))';}
        else{el.setAttribute('stroke',v?'#16a34a':'#cbd5e1');el.setAttribute('stroke-width','0.5');el.style.filter='';}
      };

      const renderPanel=()=>{
        if(!selectedCountry){panelEl.style.display='none';return;}
        const isVisited=visited.has(selectedCountry);
        const logs=items.filter(i=>i.country===selectedCountry);
        panelEl.innerHTML=`<div class="map-panel-header"><span class="map-panel-title">📍 ${selectedCountry}</span><button class="map-panel-close" id="panelClose">✕</button></div><div class="map-panel-actions"><button class="map-panel-btn ${isVisited?'visited':''}" id="panelToggle">${isVisited?'✓ 已去过（点击取消）':'○ 标记去过'}</button><button class="map-panel-btn" id="panelLogs">📋 查看日志 (${logs.length})</button><button class="map-panel-btn primary" id="panelAdd">+ 添加日志</button></div><div class="map-panel-content" id="panelContent" style="display:none"></div>`;
        panelEl.style.display='block';
        panelEl.querySelector('#panelClose').onclick=deselect;
        panelEl.querySelector('#panelToggle').onclick=async()=>{
          const all=await DB.all('travel');
          const ex=all.find(i=>i.country===selectedCountry);
          if(ex){await DB.del('travel',ex.id);U.toast(`${selectedCountry} 已取消标记`);}
          else{
            let continent='';
            for(const[cont,countries]of Object.entries(WORLD_MAP)){if(countries.includes(selectedCountry)){continent=cont;break;}}
            await DB.add('travel',{country:selectedCountry,continent,date:U.today(),note:'',image:null});
            U.toast(`${selectedCountry} 已标记去过`);
          }
          await refreshVisited();
          const iso=COUNTRY_ISO[selectedCountry];
          const el=svg.querySelector('#'+iso);
          if(el){applyVisuals(el,selectedCountry,true);if(visited.has(selectedCountry))addMarker(el);else removeMarker();}
          renderPanel();
          App.updateBadges();
        };
        panelEl.querySelector('#panelLogs').onclick=showLogs;
        panelEl.querySelector('#panelAdd').onclick=showAddForm;
      };

      const showLogs=()=>{
        const content=document.getElementById('panelContent');
        const logs=items.filter(i=>i.country===selectedCountry);
        if(!logs.length){content.innerHTML='<div class="panel-empty">还没有旅行记录，点上面的"添加日志"开始记录</div>';}
        else{let html='<div class="panel-logs">';logs.forEach(log=>{html+=`<div class="panel-log-item">${log.image?`<img src="${log.image}" class="panel-log-img">`:'<div class="panel-log-img" style="background:#e2e8f0;display:flex;align-items:center;justify-content:center;color:#94a3b8">📷</div>'}<div class="panel-log-body">${log.date?`<div class="panel-log-date">📅 ${log.date}</div>`:''}${log.note?`<div class="panel-log-note">${U.esc(log.note)}</div>`:''}</div><button class="panel-log-del" data-id="${log.id}" title="删除">×</button></div>`;});html+='</div>';content.innerHTML=html;content.querySelectorAll('.panel-log-del').forEach(btn=>{btn.onclick=async()=>{if(!confirm('删除这条旅行日志？'))return;await MH.del('travel',btn.dataset.id);await refreshVisited();showLogs();renderPanel();};});}
        content.style.display='block';
      };

      const showAddForm=()=>{
        const content=document.getElementById('panelContent');
        content.innerHTML=`<div class="panel-form"><input type="date" id="panelDate"><textarea id="panelNote" placeholder="说点什么... 这次旅行印象最深的是什么？" rows="3"></textarea><label class="panel-file-label"><input type="file" id="panelImage" accept="image/*" style="display:none"><span id="panelFileName">📷 添加照片（可选）</span></label><div class="panel-form-btns"><button class="panel-save" id="panelSave">保存</button><button class="panel-cancel" id="panelCancel">取消</button></div></div>`;
        content.style.display='block';
        content.querySelector('#panelImage').onchange=(e)=>{document.getElementById('panelFileName').textContent=e.target.files[0]?'📷 '+e.target.files[0].name:'📷 添加照片（可选）';};
        content.querySelector('#panelSave').onclick=async()=>{
          const date=document.getElementById('panelDate').value;
          const note=document.getElementById('panelNote').value;
          const file=document.getElementById('panelImage').files[0];
          const save=async(img)=>{
            const continent=Object.entries(WORLD_MAP).find(([_,v])=>v.includes(selectedCountry))?.[0]||'';
            await DB.add('travel',{country:selectedCountry,date,continent,note,image:img||''});
            U.toast('已添加旅行日志');
            await refreshVisited();
            const iso=COUNTRY_ISO[selectedCountry];
            const el=svg.querySelector('#'+iso);
            if(el)applyVisuals(el,selectedCountry,true);
            renderPanel();
          };
          if(file){const r=new FileReader();r.onload=()=>save(r.result);r.readAsDataURL(file);}else{save('');}
        };
        content.querySelector('#panelCancel').onclick=()=>{content.style.display='none';};
      };

      const removeMarker=()=>{const m=svg.querySelector('.country-marker');if(m)m.remove();};

      const addMarker=(el)=>{
        removeMarker();
        let bbox;try{bbox=el.getBBox();}catch(e){return;}
        if(!bbox||bbox.width<1)return;
        const cx=bbox.x+bbox.width/2, cy=bbox.y+bbox.height/2;
        const g=document.createElementNS('http://www.w3.org/2000/svg','g');
        g.setAttribute('class','country-marker');
        g.setAttribute('pointer-events','none');
        const r=Math.max(5,Math.min(14,bbox.width*0.10));
        const c=document.createElementNS('http://www.w3.org/2000/svg','circle');
        c.setAttribute('cx',cx);c.setAttribute('cy',cy);c.setAttribute('r',r);
        c.setAttribute('fill','#3b82f6');c.setAttribute('stroke','#fff');c.setAttribute('stroke-width','1.5');
        const t=document.createElementNS('http://www.w3.org/2000/svg','text');
        t.setAttribute('x',cx);t.setAttribute('y',cy);t.setAttribute('text-anchor','middle');t.setAttribute('dominant-baseline','central');
        t.setAttribute('font-size',r*1.1);t.setAttribute('fill','#fff');t.setAttribute('font-weight','bold');
        t.textContent='✓';
        g.appendChild(c);g.appendChild(t);
        svg.appendChild(g);
      };

      const deselect=()=>{if(selectedCountry){const iso=COUNTRY_ISO[selectedCountry];const el=svg.querySelector('#'+iso);if(el)applyVisuals(el,selectedCountry,false);}selectedCountry=null;removeMarker();panelEl.style.display='none';};

      const select=(countryName)=>{
        if(selectedCountry===countryName){deselect();return;}
        if(selectedCountry){const prevIso=COUNTRY_ISO[selectedCountry];const prevEl=svg.querySelector('#'+prevIso);if(prevEl)applyVisuals(prevEl,selectedCountry,false);}
        selectedCountry=countryName;
        const iso=COUNTRY_ISO[countryName];
        const el=svg.querySelector('#'+iso);
        if(el){
          applyVisuals(el,countryName,true);
          if(visited.has(countryName))addMarker(el);else removeMarker();
        }
        renderPanel();
        panelEl.scrollIntoView({behavior:'smooth',block:'nearest'});
      };

      // Wire up countries with paths
      for(const[countryName,iso]of Object.entries(COUNTRY_ISO)){
        const el=svg.querySelector('#'+iso);
        if(!el)continue;
        applyVisuals(el,countryName,false);
        el.style.cursor='pointer';
        el.dataset.country=countryName;
        el.addEventListener('click',(e)=>{e.stopPropagation();select(countryName);});
      }

      // Small island markers
      const vb=svg.viewBox.baseVal;
      const toXY=(lat,lng)=>({x:vb.x+(lng+180)*(vb.width/360),y:vb.y+(90-lat)*(vb.height/360)});
      const noSvgPaths=['毛里求斯','塞舌尔','帕劳'];
      for(const country of noSvgPaths){
        const coord=COUNTRY_COORDS[country];if(!coord)continue;
        const{x,y}=toXY(coord.lat,coord.lng);
        const v=visited.has(country);
        const g=document.createElementNS('http://www.w3.org/2000/svg','g');
        const circle=document.createElementNS('http://www.w3.org/2000/svg','circle');
        circle.setAttribute('cx',x.toFixed(1));
        circle.setAttribute('cy',y.toFixed(1));
        circle.setAttribute('r',v?'6':'4');
        circle.setAttribute('fill',v?'#22c55e':'#cbd5e1');
        circle.setAttribute('stroke',v?'#16a34a':'#94a3b8');
        circle.setAttribute('stroke-width','1');
        g.style.cursor='pointer';
        g.dataset.country=country;
        g.appendChild(circle);
        g.addEventListener('click',(e)=>{e.stopPropagation();select(country);});
        svg.appendChild(g);
      }
    }catch(e){
      const el=document.getElementById('worldMapSvg');
      if(el)el.innerHTML='<div style="padding:40px;text-align:center;color:#94a3b8">地图加载失败，请刷新页面重试</div>';
    }
  },

  async selectCountryFromTile(country){
    await this.render_travel();
    setTimeout(()=>{
      const svg=document.querySelector('.world-map-wrap svg');
      if(!svg)return;
      const iso=COUNTRY_ISO[country];
      if(!iso){U.toast('该国家无地图路径');return;}
      const el=svg.querySelector('#'+iso);
      if(el)el.dispatchEvent(new MouseEvent('click',{bubbles:true}));
    },150);
  },

  async toggleCountry(country){
    const items=await DB.all('travel');
    const ex=items.find(i=>i.country===country);
    let continent='';
    for(const[cont,countries]of Object.entries(WORLD_MAP)){if(countries.includes(country)){continent=cont;break;}}
    if(ex){await DB.del('travel',ex.id);U.toast(`${country} 已取消标记`);}
    else{await DB.add('travel',{country,continent,date:U.today(),note:'',image:null});U.toast(`${country} 已标记`);}
    this.render('travel');App.updateBadges();
  },

  async editTravel(id){
    const item=await DB.get('travel',id);
    App.editId=id;this._img=item.image||null;
    App.openModal('编辑旅行记录',`<div class="form-group"><label>国家/地区</label><input type="text" id="f_country" value="${U.esc(item.country)}" readonly></div>
    <div class="form-group"><label>日期</label><input type="date" id="f_date" value="${item.date||''}"></div>
    <div class="form-group"><label>照片</label><div class="img-upload" id="imgU" onclick="document.getElementById('imgF').click()">${item.image?`<img src="${item.image}">`:'<span class="placeholder">点击上传</span>'}</div><input type="file" id="imgF" accept="image/*" style="display:none" onchange="MH.handleImg(this)"></div>
    <div class="form-group"><label>备注</label><textarea id="f_note">${U.esc(item.note||'')}</textarea></div>`);
  },

  async save_travel(){
    const d={country:document.getElementById('f_country').value,date:document.getElementById('f_date').value,note:document.getElementById('f_note').value.trim(),image:this._img};
    if(App.editId){d.id=App.editId;const ex=await DB.get('travel',App.editId);d.continent=ex.continent;d.createdAt=ex.createdAt;await DB.put('travel',d);U.toast('已更新');}
    App.closeModal();this.render('travel');App.updateBadges();
  },

  /* ===== 5. 周末玩耍 ===== */
  async render_weekend(){
    const items=await DB.all('weekend');
    const dm={};items.forEach(i=>dm[i.date]=i);
    const c=document.getElementById('moduleContent');
    const today=U.today();
    let h=`<div class="cal-year-picker"><button onclick="MH._calYear--;MH.render('weekend')">-</button><span>${this._calYear}年</span><button onclick="MH._calYear++;MH.render('weekend')">+</button></div><div class="cal-months">`;
    for(let m=0;m<12;m++){
      const fd=new Date(this._calYear,m,1),sw=fd.getDay(),di=new Date(this._calYear,m+1,0).getDate();
      h+=`<div class="cal-month"><div class="cal-month-title">${m+1}月</div><div class="cal-days">`;
      for(let i=0;i<sw;i++)h+='<div class="cal-day"></div>';
      for(let d=1;d<=di;d++){
        const ds=`${this._calYear}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        const wd=new Date(this._calYear,m,d).getDay();
        const it=dm[ds];let cls=['cal-day'];
        if(wd===0||wd===6)cls.push('weekend');
        if(it){if(it.actual)cls.push('went-out');else if(it.plan)cls.push('has-plan');if(it.starred)cls.push('star');}
        if(ds===today)cls.push('today');
        h+=`<div class="${cls.join(' ')}" onclick="MH.editWeekend('${ds}')">${d}</div>`;
      }
      h+='</div></div>';
    }
    h+='</div><div class="map-legend" style="margin-top:10px"><span><span class="dot" style="background:#c7d2fe"></span>有计划</span><span><span class="dot" style="background:#fde68a"></span>出去玩</span><span><span class="dot" style="background:#f59e0b"></span>星标</span></div>';
    const rec=items.filter(i=>i.date&&i.date.startsWith(this._calYear)).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5);
    if(rec.length){h+='<div class="section-title">最近记录</div>';rec.forEach(it=>{h+=`<div class="item-card"><div class="item-body"><div class="item-title">${it.date} ${it.starred?'★':''}</div><div class="item-desc">计划: ${U.esc(it.plan||'无')} | 实际: ${U.esc(it.actual||'未记录')} ${it.companion?'| 和 '+U.esc(it.companion):''}</div></div><div class="actions"><button class="action-btn edit" onclick="MH.editWeekend('${it.date}')">编辑</button><button class="action-btn del" onclick="MH.del('weekend','${it.id}')">删除</button></div></div>`;});}
    c.innerHTML=h;
  },

  async editWeekend(ds){
    const items=await DB.all('weekend');
    const ex=items.find(i=>i.date===ds);
    App.editId=ex?.id||null;
    App.openModal(ex?'编辑周末记录':'添加周末记录',this.form_weekend(ex,ds));
  },

  form_weekend(item,fixedDate){
    const dv=fixedDate||item?.date||U.today();
    return`<div class="form-group"><label>日期</label><input type="date" id="f_date" value="${dv}" ${fixedDate?'readonly':''}></div>
    <div class="form-group"><label>计划</label><textarea id="f_plan" placeholder="计划做什么...">${U.esc(item?.plan||'')}</textarea></div>
    <div class="form-group"><label>实际去哪玩了</label><textarea id="f_actual" placeholder="实际去了哪里...">${U.esc(item?.actual||'')}</textarea></div>
    <div class="form-group"><label>和谁玩</label><input type="text" id="f_companion" value="${U.esc(item?.companion||'')}" placeholder="朋友、家人"></div>
    <div class="form-group"><label>星标</label><select id="f_starred"><option value="false" ${!item?.starred?'selected':''}>普通</option><option value="true" ${item?.starred?'selected':''}>星标</option></select></div>`;
  },

  async save_weekend(){
    const d={date:document.getElementById('f_date').value,plan:document.getElementById('f_plan').value.trim(),actual:document.getElementById('f_actual').value.trim(),companion:document.getElementById('f_companion').value.trim(),starred:document.getElementById('f_starred').value==='true'};
    if(App.editId){d.id=App.editId;const ex=await DB.get('weekend',App.editId);d.createdAt=ex.createdAt;await DB.put('weekend',d);U.toast('已更新');}
    else{await DB.add('weekend',d);U.toast('已添加');}
    App.closeModal();this.render('weekend');App.updateBadges();
  },

  /* ===== 6. 节日记录 ===== */
  async seedHolidays(){
    const ex=await DB.all('holidays');if(ex.length)return;
    const defaults=[
      {name:'元旦',type:'solar',month:1,day:1,isRecurring:true},
      {name:'情人节',type:'solar',month:2,day:14,isRecurring:true},
      {name:'妇女节',type:'solar',month:3,day:8,isRecurring:true},
      {name:'植树节',type:'solar',month:3,day:12,isRecurring:true},
      {name:'劳动节',type:'solar',month:5,day:1,isRecurring:true},
      {name:'青年节',type:'solar',month:5,day:4,isRecurring:true},
      {name:'儿童节',type:'solar',month:6,day:1,isRecurring:true},
      {name:'建党节',type:'solar',month:7,day:1,isRecurring:true},
      {name:'建军节',type:'solar',month:8,day:1,isRecurring:true},
      {name:'教师节',type:'solar',month:9,day:10,isRecurring:true},
      {name:'国庆节',type:'solar',month:10,day:1,isRecurring:true},
      {name:'圣诞节',type:'solar',month:12,day:25,isRecurring:true},
      {name:'春节',type:'lunar',lunarMonth:1,lunarDay:1,isRecurring:true},
      {name:'元宵节',type:'lunar',lunarMonth:1,lunarDay:15,isRecurring:true},
      {name:'端午节',type:'lunar',lunarMonth:5,lunarDay:5,isRecurring:true},
      {name:'七夕',type:'lunar',lunarMonth:7,lunarDay:7,isRecurring:true},
      {name:'中元节',type:'lunar',lunarMonth:7,lunarDay:15,isRecurring:true},
      {name:'中秋节',type:'lunar',lunarMonth:8,lunarDay:15,isRecurring:true},
      {name:'重阳节',type:'lunar',lunarMonth:9,lunarDay:9,isRecurring:true},
      {name:'腊八节',type:'lunar',lunarMonth:12,lunarDay:8,isRecurring:true},
      {name:'除夕',type:'lunar',lunarMonth:12,lunarDay:30,isRecurring:true}
    ];
    for(const h of defaults)await DB.add('holidays',h);
  },

  async render_holidays(){
    const items=await DB.search('holidays',this._q['holidays']||'');
    const c=document.getElementById('moduleContent');
    if(!items.length){c.innerHTML=`<div class="empty-state"><div class="empty-icon">🎊</div><p>还没有节日记录</p></div>`;return;}
    const now=new Date(),y=now.getFullYear();
    const list=items.map(item=>{
      let nd=null;
      if(item.type==='solar'){let d=new Date(y,item.month-1,item.day);if(d<now)d=new Date(y+1,item.month-1,item.day);nd=d;}
      else if(item.type==='lunar'){nd=U.lunarToSolar(y,item.lunarMonth,item.lunarDay);if(nd&&nd<now)nd=U.lunarToSolar(y+1,item.lunarMonth,item.lunarDay);}
      else if(item.type==='custom'&&item.date)nd=new Date(item.date+'T00:00:00');
      return{...item,_nd:nd};
    });
    list.sort((a,b)=>{if(!a._nd)return 1;if(!b._nd)return-1;return a._nd-b._nd;});
    let h='';
    list.forEach(item=>{
      const d=item._nd;let cd='',ds='';
      if(d){const days=Math.ceil((d-now)/86400000);cd=days===0?'就是今天！':days<0?'已过':`还有 ${days} 天`;ds=`${d.getMonth()+1}月${d.getDate()}日`;}
      else cd='日期待定';
      h+=`<div class="holiday-item"><div class="h-date"><div class="month">${d?(d.getMonth()+1)+'月':'?'}</div><div class="day">${d?d.getDate():'?'}</div></div><div class="h-info"><div class="h-name">${U.esc(item.name)}</div><div class="h-countdown">${cd} ${ds?'· '+ds:''}</div></div><span class="h-type ${item.type}">${item.type==='lunar'?'农历':item.type==='solar'?'阳历':'自定义'}</span><div class="actions" style="margin-left:6px"><button class="action-btn edit" onclick="MH.edit('holidays','${item.id}')">编辑</button><button class="action-btn del" onclick="MH.del('holidays','${item.id}')">删除</button></div></div>`;
    });
    c.innerHTML=h;
  },

  form_holidays(item){
    return`<div class="form-group"><label>名称</label><input type="text" id="f_name" value="${U.esc(item?.name||'')}" placeholder="妈妈生日"></div>
    <div class="form-group"><label>类型</label><select id="f_type" onchange="MH.toggleHolType(this)"><option value="solar" ${item?.type==='solar'?'selected':''}>阳历</option><option value="lunar" ${item?.type==='lunar'?'selected':''}>农历</option><option value="custom" ${item?.type==='custom'?'selected':''}>自定义日期</option></select></div>
    <div id="solarFields" style="display:${item?.type==='solar'||!item?.type?'block':'none'}"><div class="form-group"><label>月份</label><input type="number" id="f_month" value="${item?.month||''}" min="1" max="12"></div><div class="form-group"><label>日</label><input type="number" id="f_day" value="${item?.day||''}" min="1" max="31"></div></div>
    <div id="lunarFields" style="display:${item?.type==='lunar'?'block':'none'}"><div class="form-group"><label>农历月份</label><input type="number" id="f_lunarMonth" value="${item?.lunarMonth||''}" min="1" max="12"></div><div class="form-group"><label>农历日</label><input type="number" id="f_lunarDay" value="${item?.lunarDay||''}" min="1" max="30"></div></div>
    <div id="customFields" style="display:${item?.type==='custom'?'block':'none'}"><div class="form-group"><label>日期</label><input type="date" id="f_date" value="${item?.date||''}"></div></div>
    <div class="form-group"><label>每年重复</label><select id="f_isRecurring"><option value="true" ${item?.isRecurring!==false?'selected':''}>是</option><option value="false" ${item?.isRecurring===false?'selected':''}>否</option></select></div>
    <div class="form-group"><label>备注</label><textarea id="f_note">${U.esc(item?.note||'')}</textarea></div>`;
  },

  toggleHolType(s){document.getElementById('solarFields').style.display=s.value==='solar'?'block':'none';document.getElementById('lunarFields').style.display=s.value==='lunar'?'block':'none';document.getElementById('customFields').style.display=s.value==='custom'?'block':'none';},

  async save_holidays(){
    const n=document.getElementById('f_name').value.trim();if(!n){U.toast('请填写名称');return;}
    const t=document.getElementById('f_type').value;const d={name:n,type:t,isRecurring:document.getElementById('f_isRecurring').value==='true',note:document.getElementById('f_note').value.trim()};
    if(t==='solar'){d.month=parseInt(document.getElementById('f_month').value)||1;d.day=parseInt(document.getElementById('f_day').value)||1;}
    else if(t==='lunar'){d.lunarMonth=parseInt(document.getElementById('f_lunarMonth').value)||1;d.lunarDay=parseInt(document.getElementById('f_lunarDay').value)||1;}
    else d.date=document.getElementById('f_date').value;
    if(App.editId){d.id=App.editId;const ex=await DB.get('holidays',App.editId);d.createdAt=ex.createdAt;await DB.put('holidays',d);U.toast('已更新');}
    else{await DB.add('holidays',d);U.toast('已添加');}
    App.closeModal();this.render('holidays');App.updateBadges();
  },

  /* ===== 7. 身体倍棒 ===== */
  async render_health(){
    const items=await DB.search('health',this._q['health']||'');
    const c=document.getElementById('moduleContent');
    const ex=items.filter(i=>i.type==='运动'),so=items.filter(i=>i.type==='泡脚'),per=items.filter(i=>i.type==='月经'),sug=items.filter(i=>i.type==='含糖饮料'),bm=items.filter(i=>i.type==='如厕');
    const exMin=ex.reduce((s,i)=>s+(parseInt(i.duration)||0),0);
    const sd=sug.filter(i=>i.date===U.today()).length;
    // Period prediction (based on period END date when available)
    let nextP='',lastPDays='';
    if(per.length){
      const ds=per.map(i=>i.endDate||i.date).sort().reverse();
      if(ds[0]){const last=new Date(ds[0]+'T00:00:00');const next=new Date(last.getTime()+28*86400000);nextP=`下次预计: ${U.fmtShort(next.getTime())}`;}
      const withEnd=per.filter(i=>i.endDate).sort((a,b)=>(b.date||'').localeCompare(a.date||''));
      if(withEnd.length){const w=withEnd[0];const days=Math.round((new Date(w.endDate+'T00:00:00')-new Date(w.date+'T00:00:00'))/86400000)+1;if(days>0)lastPDays=`最近${days}天`;}
    }
    let h=`<div class="health-stats">
      <div class="health-stat-card"><div class="stat-value">${ex.length}</div><div class="stat-label">运动次数</div></div>
      <div class="health-stat-card"><div class="stat-value">${so.length}</div><div class="stat-label">泡脚次数</div></div>
      <div class="health-stat-card"><div class="stat-value">${exMin}</div><div class="stat-label">运动(分)</div></div>
      <div class="health-stat-card"><div class="stat-value">${sd}</div><div class="stat-label">今日含糖</div></div>
      ${nextP?`<div class="health-stat-card"><div class="stat-value" style="font-size:1rem">${nextP}</div><div class="stat-label">${lastPDays?lastPDays:'月经周期'}</div></div>`:''}
    </div>`;
    if(!items.length){h+=`<div class="empty-state"><div class="empty-icon">💪</div><p>还没有记录</p></div>`;}
    else{
      items.sort((a,b)=>(b.date||'').localeCompare(a.date||''));
      items.forEach(item=>{
        const dateTxt=item.type==='月经'&&item.endDate?`${item.date} ~ ${item.endDate}`:(item.date||'');
        h+=`<div class="item-card"><div class="item-body"><div class="item-title">${U.esc(item.type)} ${item.duration?item.duration+'分钟':''}</div><div class="item-desc">${dateTxt} ${item.content?'| '+U.esc(item.content):''}</div></div><div class="actions"><button class="action-btn edit" onclick="MH.edit('health','${item.id}')">编辑</button><button class="action-btn del" onclick="MH.del('health','${item.id}')">删除</button></div></div>`;
      });
    }
    c.innerHTML=h;
  },

  form_health(item){
    return`<div class="form-group"><label>类型</label><select id="f_type" onchange="MH.togglePeriodField(this)">${['运动','泡脚','月经','含糖饮料','如厕'].map(t=>`<option value="${t}" ${item?.type===t?'selected':''}>${t}</option>`).join('')}</select></div>
    <div class="form-group"><label>日期</label><input type="date" id="f_date" value="${item?.date||U.today()}"></div>
    <div class="form-group" id="f_periodEndGroup" style="display:${item?.type==='月经'?'block':'none'}"><label>结束日期</label><input type="date" id="f_periodEnd" value="${item?.endDate||''}"><div style="font-size:0.7rem;color:#94a3b8;margin-top:4px">填写结束日期后，将按区间记录并用于预测下次周期</div></div>
    <div class="form-group"><label>时长（分钟）</label><input type="number" id="f_duration" value="${item?.duration||''}" min="0"></div>
    <div class="form-group"><label>内容</label><textarea id="f_content" placeholder="如：跑步5公里...">${U.esc(item?.content||'')}</textarea></div>`;
  },

  togglePeriodField(s){const g=document.getElementById('f_periodEndGroup');if(g)g.style.display=s.value==='月经'?'block':'none';},

  async save_health(){
    const t=document.getElementById('f_type').value;
    const endEl=document.getElementById('f_periodEnd');
    const d={type:t,date:document.getElementById('f_date').value,endDate:(t==='月经'&&endEl)?endEl.value:'',duration:parseInt(document.getElementById('f_duration').value)||0,content:document.getElementById('f_content').value.trim()};
    if(t==='月经'&&d.endDate&&d.endDate<d.date){U.toast('结束日期不能早于开始日期');return;}
    if(App.editId){d.id=App.editId;const ex=await DB.get('health',App.editId);d.createdAt=ex.createdAt;await DB.put('health',d);U.toast('已更新');}
    else{await DB.add('health',d);U.toast('已添加');}
    App.closeModal();this.render('health');App.updateBadges();
  },

  /* ===== 8. 生活备忘 ===== */
  async render_notes(){
    const items=await DB.search('notes',this._q['notes']||'');
    const c=document.getElementById('moduleContent');
    if(!items.length){c.innerHTML=`<div class="empty-state"><div class="empty-icon">📝</div><p>还没有备忘</p></div>`;return;}
    items.sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
    let h='';
    items.forEach(item=>{
      const tl=item.type==='image'?'图片':item.type==='link'?'链接':'文字';
      h+=`<div class="note-card"><span class="note-type-badge">${tl}</span>`;
      if(item.type==='image'&&item.image){h+=`<img class="note-img" src="${item.image}">`;if(item.text)h+=`<div class="note-text">${U.esc(item.text)}</div>`;}
      else if(item.type==='link'){h+=`<a class="note-link" href="${U.esc(item.link)}" target="_blank">${U.esc(item.link)}</a>`;if(item.text)h+=`<div class="note-text">${U.esc(item.text)}</div>`;}
      else h+=`<div class="note-text">${U.esc(item.text)}</div>`;
      h+=`<div class="item-meta"><span class="tag">${U.fmtShort(item.createdAt)}</span></div><div class="actions" style="position:absolute;top:8px;right:8px"><button class="action-btn edit" onclick="MH.edit('notes','${item.id}')">编辑</button><button class="action-btn del" onclick="MH.del('notes','${item.id}')">删除</button></div></div>`;
    });
    c.innerHTML=h;
  },

  form_notes(item){
    this._img=item?.image||null;
    return`<div class="form-group"><label>类型</label><select id="f_type" onchange="MH.toggleNoteType(this)"><option value="text" ${item?.type==='text'||!item?.type?'selected':''}>文字</option><option value="image" ${item?.type==='image'?'selected':''}>图片</option><option value="link" ${item?.type==='link'?'selected':''}>链接</option></select></div>
    <div id="noteImgField" style="display:${item?.type==='image'?'block':'none'}"><div class="form-group"><label>图片</label><div class="img-upload" id="imgU" onclick="document.getElementById('imgF').click()">${item?.image?`<img src="${item.image}">`:'<span class="placeholder">点击上传</span>'}</div><input type="file" id="imgF" accept="image/*" style="display:none" onchange="MH.handleImg(this)"></div></div>
    <div id="noteLinkField" style="display:${item?.type==='link'?'block':'none'}"><div class="form-group"><label>链接</label><input type="url" id="f_link" value="${U.esc(item?.link||'')}" placeholder="https://..."></div></div>
    <div class="form-group"><label>文字内容</label><textarea id="f_text">${U.esc(item?.text||'')}</textarea></div>`;
  },

  toggleNoteType(s){document.getElementById('noteImgField').style.display=s.value==='image'?'block':'none';document.getElementById('noteLinkField').style.display=s.value==='link'?'block':'none';},

  async save_notes(){
    const t=document.getElementById('f_type').value;const d={type:t};
    d.text=document.getElementById('f_text').value.trim();
    if(t==='image')d.image=this._img;
    if(t==='link')d.link=document.getElementById('f_link').value.trim();
    if(!d.text&&!d.image&&!d.link){U.toast('请填写内容');return;}
    if(App.editId){d.id=App.editId;const ex=await DB.get('notes',App.editId);d.createdAt=ex.createdAt;await DB.put('notes',d);U.toast('已更新');}
    else{await DB.add('notes',d);U.toast('已添加');}
    App.closeModal();this.render('notes');App.updateBadges();
  },

  /* ===== 9. 行李清单 ===== */
  async render_packing(){
    const items=await DB.search('packing',this._q['packing']||'');
    const c=document.getElementById('moduleContent');
    let h=`<button class="header-btn" style="background:#f97316;margin-bottom:10px" onclick="MH.newPackingList('domestic')">📋 从国内模板新建</button>
    <button class="header-btn" style="background:#f59e0b;margin-bottom:10px" onclick="MH.newPackingList('international')">📋 从国外模板新建</button>`;
    if(!items.length){h+=`<div class="empty-state"><div class="empty-icon">🎒</div><p>还没有行李清单，从上方模板新建</p></div>`;}
    else{
      items.sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
      items.forEach(item=>{
        const list=item.items||[];const chk=list.filter(i=>i.checked).length;
        h+=`<div class="packing-list"><div class="pl-header"><div><span class="pl-title">${U.esc(item.listName)}</span><span class="pl-type-badge ${item.type||'domestic'}">${item.type==='international'?'国外':'国内'}</span></div><span class="pl-progress">${chk}/${list.length}</span></div>`;
        list.forEach((li,i)=>{
          h+=`<div class="packing-item ${li.checked?'checked':''}"><div class="check-box ${li.checked?'checked':''}" onclick="MH.togglePack('${item.id}',${i})"></div><span class="pi-name">${U.esc(li.name)}</span><button class="action-btn del" onclick="MH.delPack('${item.id}',${i})" style="padding:2px 6px;font-size:0.7rem">x</button></div>`;
        });
        h+=`<div class="packing-add"><input type="text" id="pa_${item.id}" placeholder="添加物品..." onkeypress="if(event.key==='Enter')MH.addPack('${item.id}')"><button onclick="MH.addPack('${item.id}')">添加</button></div>`;
        h+=`<div style="margin-top:8px;display:flex;gap:6px"><button class="action-btn edit" onclick="MH.editPacking('${item.id}')">重命名</button><button class="action-btn del" onclick="MH.del('packing','${item.id}')">删除清单</button></div></div>`;
      });
    }
    c.innerHTML=h;
  },

  async newPackingList(type){
    const tpl=PACKING_TEMPLATES[type]||PACKING_TEMPLATES.domestic;
    const items=tpl.map(name=>({name,checked:false}));
    const name=type==='international'?'国外旅行清单':'国内旅行清单';
    await DB.add('packing',{listName:name+' '+new Date().toLocaleDateString('zh-CN',{month:'short',day:'numeric'}),type,items});
    U.toast('已从模板创建清单');
    this.render('packing');App.updateBadges();
  },

  form_packing(item){return`<div class="form-group"><label>清单名称</label><input type="text" id="f_listName" value="${U.esc(item?.listName||'')}"></div>`;},

  async save_packing(){
    const n=document.getElementById('f_listName').value.trim();if(!n){U.toast('请填写名称');return;}
    if(App.editId){const ex=await DB.get('packing',App.editId);ex.listName=n;await DB.put('packing',ex);U.toast('已更新');}
    else{await DB.add('packing',{listName:n,items:[]});U.toast('已添加');}
    App.closeModal();this.render('packing');App.updateBadges();
  },

  async editPacking(id){const item=await DB.get('packing',id);App.editId=id;App.openModal('重命名清单',this.form_packing(item));},

  async addPack(id){const inp=document.getElementById('pa_'+id);const n=inp.value.trim();if(!n)return;const l=await DB.get('packing',id);l.items.push({name:n,checked:false});await DB.put('packing',l);this.render('packing');},
  async togglePack(id,i){const l=await DB.get('packing',id);l.items[i].checked=!l.items[i].checked;await DB.put('packing',l);this.render('packing');},
  async delPack(id,i){App.askConfirm('删除这个物品？',async()=>{const l=await DB.get('packing',id);l.items.splice(i,1);await DB.put('packing',l);this.render('packing');});},

  /* ===== 10. 读书清单 ===== */
  async render_books(){
    const tab=this._subTab['books']||'mine';
    const c=document.getElementById('moduleContent');
    let h=`<div class="sub-tabs"><button class="sub-tab ${tab==='mine'?'active':''}" onclick="MH._subTab['books']='mine';MH.render('books')">我的书单</button><button class="sub-tab ${tab==='top250'?'active':''}" onclick="MH._subTab['books']='top250';MH.render('books')">豆瓣 Top250</button></div>`;
    if(tab==='mine'){
      const items=await DB.search('books',this._q['books']||'');
      if(!items.length){h+=`<div class="empty-state"><div class="empty-icon">📚</div><p>还没有书，去 Top250 选几本加入吧</p></div>`;}
      else{
        items.sort((a,b)=>(a.done===b.done)?(b.createdAt||0)-(a.createdAt||0):(a.done?1:-1));
        items.forEach(item=>{
          h+=`<div class="checklist-item ${item.done?'done':''}"><div class="ci-check ${item.done?'checked':''}" onclick="MH.toggleBook('${item.id}')"></div><div><div class="ci-name">${U.esc(item.name)}</div>${item.author?`<div class="ci-meta">${U.esc(item.author)}</div>`:''}</div><button class="action-btn del" onclick="MH.del('books','${item.id}')">删除</button></div>`;
        });
      }
    } else {
      const q=(this._q['books']||'').toLowerCase();
      const list=DOUBAN_BOOKS.filter(b=>!q||b.name.toLowerCase().includes(q)||b.author.toLowerCase().includes(q));
      h+='<div class="top250-list">';
      const myBooks=await DB.all('books');
      const readCount=myBooks.filter(b=>b.done).length;
      h+=`<div class="top250-progress"><span>已读 ${readCount} / ${list.length}</span><div class="progress-bar"><div class="progress-fill" style="width:${(readCount/list.length*100).toFixed(1)}%"></div></div></div>`;
      list.forEach((b,i)=>{
        const added=myBooks.find(mb=>mb.name===b.name);
        const read=added&&added.done;
        h+=`<div class="top250-item ${read?'watched':''}"><div class="top250-check ${read?'checked':''} ${added?'':'disabled'}" onclick="MH.toggleTop250('books','${U.esc(b.name)}','${U.esc(b.author)}')"></div><span class="rank">${i+1}</span><div class="top250-info"><div class="top250-name">${U.esc(b.name)}</div><div class="top250-meta">${U.esc(b.author)}</div></div><span class="top250-rating">${b.rating}</span><button class="top250-btn ${added?'added':''}" onclick="MH.addFromTop250('books','${U.esc(b.name)}','${U.esc(b.author)}')">${added?'已加入':'加入'}</button></div>`;
      });
      h+='</div>';
    }
    c.innerHTML=h;
  },

  async addFromTop250(store,name,author){
    const items=await DB.all(store);
    if(items.find(i=>i.name===name)){U.toast('已在清单中');return;}
    await DB.add(store,{name,author,done:false});
    U.toast('已加入清单');
    this.render(store);App.updateBadges();
  },

  async toggleTop250(store,name,author){
    const items=await DB.all(store);
    const ex=items.find(i=>i.name===name);
    if(!ex){
      U.toast(store==='movies'?'请先点右侧"加入"加入片单':'请先点右侧"加入"加入书单');
      return;
    }
    ex.done=!ex.done;
    await DB.put(store,ex);
    U.toast(ex.done?(store==='movies'?'已标记为已看':'已标记为已读'):'已取消标记');
    this.render(store);App.updateBadges();
  },

  async toggleBook(id){const b=await DB.get('books',id);b.done=!b.done;await DB.put('books',b);this.render('books');App.updateBadges();},
  form_books(item){return`<div class="form-group"><label>书名</label><input type="text" id="f_name" value="${U.esc(item?.name||'')}"></div><div class="form-group"><label>作者</label><input type="text" id="f_author" value="${U.esc(item?.author||'')}"></div><div class="form-group"><label>状态</label><select id="f_done"><option value="false" ${!item?.done?'selected':''}>想读</option><option value="true" ${item?.done?'selected':''}>已读</option></select></div>`;},
  async save_books(){const n=document.getElementById('f_name').value.trim();if(!n){U.toast('请填写书名');return;}const d={name:n,author:document.getElementById('f_author').value.trim(),done:document.getElementById('f_done').value==='true'};if(App.editId){d.id=App.editId;const ex=await DB.get('books',App.editId);d.createdAt=ex.createdAt;await DB.put('books',d);U.toast('已更新');}else{await DB.add('books',d);U.toast('已添加');}App.closeModal();this.render('books');App.updateBadges();},

  /* ===== 11. 电影清单 ===== */
  async render_movies(){
    const tab=this._subTab['movies']||'mine';
    const c=document.getElementById('moduleContent');
    let h=`<div class="sub-tabs"><button class="sub-tab ${tab==='mine'?'active':''}" onclick="MH._subTab['movies']='mine';MH.render('movies')">我的片单</button><button class="sub-tab ${tab==='top250'?'active':''}" onclick="MH._subTab['movies']='top250';MH.render('movies')">豆瓣 Top250</button></div>`;
    if(tab==='mine'){
      const items=await DB.search('movies',this._q['movies']||'');
      if(!items.length){h+=`<div class="empty-state"><div class="empty-icon">🎬</div><p>还没有电影，去 Top250 选几部加入吧</p></div>`;}
      else{
        items.sort((a,b)=>(a.done===b.done)?(b.createdAt||0)-(a.createdAt||0):(a.done?1:-1));
        items.forEach(item=>{
          h+=`<div class="checklist-item ${item.done?'done':''}"><div class="ci-check ${item.done?'checked':''}" onclick="MH.toggleMovie('${item.id}')"></div><div><div class="ci-name">${U.esc(item.name)}</div>${item.director?`<div class="ci-meta">${U.esc(item.director)} ${item.year||''}</div>`:''}</div><button class="action-btn del" onclick="MH.del('movies','${item.id}')">删除</button></div>`;
        });
      }
    } else {
      const q=(this._q['movies']||'').toLowerCase();
      const list=DOUBAN_MOVIES.filter(m=>!q||m.name.toLowerCase().includes(q)||m.director.toLowerCase().includes(q));
      h+='<div class="top250-list">';
      const myM=await DB.all('movies');
      const watchedCount=myM.filter(m=>m.done).length;
      h+=`<div class="top250-progress"><span>已看 ${watchedCount} / ${list.length}</span><div class="progress-bar"><div class="progress-fill" style="width:${(watchedCount/list.length*100).toFixed(1)}%"></div></div></div>`;
      list.forEach((m,i)=>{
        const added=myM.find(mm=>mm.name===m.name);
        const watched=added&&added.done;
        h+=`<div class="top250-item ${watched?'watched':''}"><div class="top250-check ${watched?'checked':''} ${added?'':'disabled'}" onclick="MH.toggleTop250('movies','${U.esc(m.name)}','${U.esc(m.director)}')"></div><span class="rank">${i+1}</span><div class="top250-info"><div class="top250-name">${U.esc(m.name)}</div><div class="top250-meta">${U.esc(m.director)} ${m.year}</div></div><span class="top250-rating">${m.rating}</span><button class="top250-btn ${added?'added':''}" onclick="MH.addMovieFromTop250('${U.esc(m.name)}','${U.esc(m.director)}',${m.year})">${added?'已加入':'加入'}</button></div>`;
      });
      h+='</div>';
    }
    c.innerHTML=h;
  },

  async addMovieFromTop250(name,director,year){
    const items=await DB.all('movies');
    if(items.find(i=>i.name===name)){U.toast('已在清单中');return;}
    await DB.add('movies',{name,director,year:String(year),done:false});
    U.toast('已加入片单');
    this.render('movies');App.updateBadges();
  },

  async toggleMovie(id){const m=await DB.get('movies',id);m.done=!m.done;await DB.put('movies',m);this.render('movies');App.updateBadges();},
  form_movies(item){return`<div class="form-group"><label>电影名</label><input type="text" id="f_name" value="${U.esc(item?.name||'')}"></div><div class="form-group"><label>导演</label><input type="text" id="f_director" value="${U.esc(item?.director||'')}"></div><div class="form-group"><label>年份</label><input type="text" id="f_year" value="${U.esc(item?.year||'')}"></div><div class="form-group"><label>状态</label><select id="f_done"><option value="false" ${!item?.done?'selected':''}>想看</option><option value="true" ${item?.done?'selected':''}>已看</option></select></div>`;},
  async save_movies(){const n=document.getElementById('f_name').value.trim();if(!n){U.toast('请填写电影名');return;}const d={name:n,director:document.getElementById('f_director').value.trim(),year:document.getElementById('f_year').value.trim(),done:document.getElementById('f_done').value==='true'};if(App.editId){d.id=App.editId;const ex=await DB.get('movies',App.editId);d.createdAt=ex.createdAt;await DB.put('movies',d);U.toast('已更新');}else{await DB.add('movies',d);U.toast('已添加');}App.closeModal();this.render('movies');App.updateBadges();},

  /* ===== 12. 购物清单 ===== */
  async render_shopping(){
    const items=await DB.search('shopping',this._q['shopping']||'');
    const c=document.getElementById('moduleContent');
    let h='<div class="map-legend" style="justify-content:flex-start"><span>✓ = 已买</span></div>';
    if(!items.length){h+=`<div class="empty-state"><div class="empty-icon">🛒</div><p>还没有要买的东西</p></div>`;}
    else{
      items.sort((a,b)=>(a.done===b.done)?(b.createdAt||0)-(a.createdAt||0):(a.done?1:-1));
      const todo=items.filter(i=>!i.done),done=items.filter(i=>i.done);
      if(todo.length){h+='<div class="section-title">待买</div>';todo.forEach(item=>{h+=`<div class="checklist-item"><div class="ci-check" onclick="MH.toggleShop('${item.id}')"></div><div><div class="ci-name">${U.esc(item.name)}</div>${item.note?`<div class="ci-meta">${U.esc(item.note)}</div>`:''}</div><button class="action-btn del" onclick="MH.del('shopping','${item.id}')">删除</button></div>`;});}
      if(done.length){h+='<div class="section-title">已买</div>';done.forEach(item=>{h+=`<div class="checklist-item done"><div class="ci-check checked" onclick="MH.toggleShop('${item.id}')"></div><div><div class="ci-name">${U.esc(item.name)}</div></div><button class="action-btn del" onclick="MH.del('shopping','${item.id}')">删除</button></div>`;});}
    }
    c.innerHTML=h;
  },

  form_shopping(item){return`<div class="form-group"><label>名称</label><input type="text" id="f_name" value="${U.esc(item?.name||'')}" placeholder="要买什么..."></div><div class="form-group"><label>备注</label><textarea id="f_note">${U.esc(item?.note||'')}</textarea></div><div class="form-group"><label>状态</label><select id="f_done"><option value="false" ${!item?.done?'selected':''}>待买</option><option value="true" ${item?.done?'selected':''}>已买</option></select></div>`;},
  async save_shopping(){const n=document.getElementById('f_name').value.trim();if(!n){U.toast('请填写名称');return;}const d={name:n,note:document.getElementById('f_note').value.trim(),done:document.getElementById('f_done').value==='true'};if(App.editId){d.id=App.editId;const ex=await DB.get('shopping',App.editId);d.createdAt=ex.createdAt;await DB.put('shopping',d);U.toast('已更新');}else{await DB.add('shopping',d);U.toast('已添加');}App.closeModal();this.render('shopping');App.updateBadges();},
  async toggleShop(id){const s=await DB.get('shopping',id);s.done=!s.done;await DB.put('shopping',s);this.render('shopping');App.updateBadges();}
};

/* ===== Init ===== */
document.addEventListener('DOMContentLoaded',()=>App.init());
