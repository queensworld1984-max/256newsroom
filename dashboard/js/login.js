import { api, ApiError } from './api.js';

const tabLogin = document.getElementById('tab-login');
const tabRegister = document.getElementById('tab-register');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');

function showTab(which) {
  const isLogin = which === 'login';
  tabLogin.classList.toggle('active', isLogin);
  tabRegister.classList.toggle('active', !isLogin);
  loginForm.hidden = !isLogin;
  registerForm.hidden = isLogin;
}
tabLogin.addEventListener('click', () => showTab('login'));
tabRegister.addEventListener('click', () => showTab('register'));

function redirectToDashboard() {
  const params = new URLSearchParams(window.location.search);
  window.location.href = params.get('next') || '/dashboard/';
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const errorEl = document.getElementById('login-error');
  errorEl.textContent = '';
  try {
    await api.post('/auth/login', {
      email: document.getElementById('login-email').value,
      password: document.getElementById('login-password').value,
    });
    redirectToDashboard();
  } catch (err) {
    errorEl.textContent = err instanceof ApiError ? err.message : 'Something went wrong. Please try again.';
  }
});

registerForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const errorEl = document.getElementById('register-error');
  errorEl.textContent = '';
  try {
    await api.post('/auth/register', {
      displayName: document.getElementById('register-name').value,
      email: document.getElementById('register-email').value,
      password: document.getElementById('register-password').value,
    });
    redirectToDashboard();
  } catch (err) {
    errorEl.textContent = err instanceof ApiError ? err.message : 'Something went wrong. Please try again.';
  }
});

(async () => {
  try {
    const { user } = await api.get('/auth/me');
    if (user) redirectToDashboard();
  } catch {
    // not logged in — stay on login page
  }
})();
