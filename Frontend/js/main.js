document.getElementById('navToggle').addEventListener('click', () => {
    document.querySelector('.header__nav').classList.toggle('open');
    });
    
    // 通用 fetch 封装
    async function apiGet(path) {
    const res = await fetch(path);
    if (!res.ok) throw new Error(res.statusText);
    return res.json();
    }
    
    // 页面初始化
    window.addEventListener('DOMContentLoaded', () => {
    const page = document.body.id;
    if (page && window.pageInit && window.pageInit[page]) {
    window.pageInitpage;
    }
    });
    
    /* pages/catalog.js */
    window.pageInit = window.pageInit || {};
    window.pageInit.catalog = async function() {
    try {
    const books = await apiGet('/api/books');
    // populate table
    } catch (e) { console.error(e); }
    };
    
    /* pages/authors.js */
    window.pageInit.authors = async function() {
    const authors = await apiGet('/api/authors');
    };

    // ===== Login/Register Modals =====
const loginBtn = document.getElementById('loginBtn');
const registerBtn = document.getElementById('registerBtn');
const loginModal = document.getElementById('loginModal');
const registerModal = document.getElementById('registerModal');
const loginClose = document.getElementById('loginClose');
const registerClose = document.getElementById('registerClose');

loginBtn.addEventListener('click', () => loginModal.style.display = 'flex');
registerBtn.addEventListener('click', () => registerModal.style.display = 'flex');
loginClose.addEventListener('click', () => loginModal.style.display = 'none');
registerClose.addEventListener('click', () => registerModal.style.display = 'none');

// 点击空白处关闭
[loginModal, registerModal].forEach(modal => {
  modal.addEventListener('click', e => {
    if (e.target === modal) modal.style.display = 'none';
  });
});

// ===== 登录表单提交 =====
document.getElementById('loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  const email = e.target.loginEmail.value;
  const pass  = e.target.loginPassword.value;
  try {
    const user = await apiPost('/api/login', { email, pass });
    loginModal.style.display = 'none';
    onLoginSuccess(user);
  } catch(err) { alert('Login failed: ' + err.message); }
});

// ===== 注册表单提交 =====
document.getElementById('registerForm').addEventListener('submit', async e => {
  e.preventDefault();
  const data = {
    name: e.target.regName.value,
    email: e.target.regEmail.value,
    pass:  e.target.regPassword.value
  };
  try {
    const user = await apiPost('/api/register', data);
    registerModal.style.display = 'none';
    onLoginSuccess(user);
  } catch(err) { alert('Register failed: ' + err.message); }
});

// ===== 登录成功回调 =====
function onLoginSuccess(user) {
  // 更新导航
  document.querySelector('.header__auth').innerHTML = `
    <span>Welcome, ${user.name}</span>
    <button id="logoutBtn" class="btn btn--outline">Logout</button>`;
  document.getElementById('logoutBtn').addEventListener('click', () => {
    apiPost('/api/logout').then(() => location.reload());
  });
  // 如果是员工，显示面板
  if (user.role === 'employee') {
    document.getElementById('admin').style.display = 'block';
  }
}

// 通用 POST 封装
async function apiPost(path, body) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type':'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
