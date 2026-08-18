/* GK Advisory — Phase 5 client-side auth prototype.
   Production note: replace localStorage auth with a real backend (OIDC/Supabase/Firebase/etc.). */
(function(){
  const KEY='gk_session_v1';
  const USERS={
    'demo@gkadvisory.com':{name:'Demo User',role:'client',plan:'Professional',password:'demo1234',licenses:['tms29','dcf','workingcapital']},
    'admin@gkadvisory.com':{name:'GK Advisory Admin',role:'admin',plan:'Enterprise',password:'admin1234',licenses:['tms29','dcf','tfrs16','ecl','workingcapital','hedge','tms19']}
  };
  window.GKAuth={
    users:USERS,
    login(email,password){
      const u=USERS[String(email||'').toLowerCase()];
      if(!u || u.password!==password) return {ok:false,error:'E-posta veya şifre hatalı.'};
      const s={email:String(email).toLowerCase(),name:u.name,role:u.role,plan:u.plan,licenses:u.licenses,loginAt:new Date().toISOString()};
      localStorage.setItem(KEY,JSON.stringify(s)); return {ok:true,user:s};
    },
    logout(){localStorage.removeItem(KEY);},
    current(){try{return JSON.parse(localStorage.getItem(KEY))||null}catch(e){return null}},
    require(){const u=this.current(); if(!u){location.href='login.html?next='+encodeURIComponent(location.pathname+location.search);return null} return u;},
    can(id){const u=this.current(); return !!u && (id==='financial-cockpit'||u.role==='admin'||u.licenses.includes(id));}
  };
})();
