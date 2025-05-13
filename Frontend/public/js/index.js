// public/js/index.js

// Modal 打开/关闭
function toggleModal(id, show) {
  document.getElementById(id)
    .classList[show ? 'add' : 'remove']('active');
}

// 绑定按钮
document.getElementById('loginBtn')
  .addEventListener('click', () => toggleModal('loginModal', true));
document.getElementById('registerBtn')
  .addEventListener('click', () => toggleModal('registerModal', true));

// 关闭 icon / 点击遮罩区
document.querySelectorAll('[data-modal-close]').forEach(el => {
  el.addEventListener('click', () =>
    toggleModal(el.closest('.modal').id, false)
  );
});
window.addEventListener('click', e => {
  if (e.target.classList.contains('modal')) {
    e.target.classList.remove('active');
  }
});

// 注册表单提交
const regForm = document.getElementById('registerForm');
regForm.addEventListener('submit', async e => {
  e.preventDefault();

  const data = {
    username:        regForm.username.value.trim(),
    fullName:        regForm.fullName.value.trim(),
    phone:           regForm.phone.value.trim(),
    idType:          regForm.idType.value,
    idNumber:        regForm.idNumber.value.trim(),
    email:           regForm.email.value.trim(),
    password:        regForm.password.value,
    confirmPassword: regForm.confirmPassword.value,
    role:            regForm.role.value
  };

  if (data.password !== data.confirmPassword) {
    return alert('Passwords do not match.');
  }

  try {
    const resp = await fetch('/api/users/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (resp.status === 404) {
      return alert('Registration endpoint not found (404).');
    }
    const body = await resp.json();
    if (body.success) {
      alert('Registration successful! Please log in.');
      toggleModal('registerModal', false);
      regForm.reset();
    } else {
      alert('Registration failed: ' + (body.error || 'Unknown error'));
    }
  } catch (err) {
    console.error(err);
    alert('Network error, please try again later.');
  }
});

// 登录表单提交
const loginForm = document.getElementById('loginForm');
loginForm.addEventListener('submit', async e => {
  e.preventDefault();

  const data = {
    email:    loginForm.email.value.trim(),
    password: loginForm.password.value
  };

  try {
    const resp = await fetch('/api/users/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (resp.status === 404) {
      return alert('Login endpoint not found (404).');
    }
    const body = await resp.json();
    if (body.success) {
      if (body.role === 'ADMIN') {
        window.location.href = '/admin';
      } else {
        window.location.href = '/browse.html';
      }
    } else {
      alert('Login failed: ' + (body.error || 'Invalid credentials'));
    }
  } catch (err) {
    console.error(err);
    alert('Network error, please try again later.');
  }
});
