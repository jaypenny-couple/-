// UI gate only. Database Security Rules remain the authorization boundary.
export function createAuthGate(app, sdk, { access, roles, onReady, onStop }) {
  const auth = sdk.getAuth(app);
  const gate = document.createElement('section');
  gate.id = 'aliceAuthGate';
  gate.innerHTML = `<form id="aliceAuthForm"><h1>ALICE 員工登入</h1>
    <label>電子郵件<input name="email" type="email" autocomplete="username" required></label>
    <label>密碼<input name="password" type="password" autocomplete="current-password" required></label>
    <button type="submit">登入</button><p id="aliceAuthMessage" role="alert" aria-live="polite"></p></form>`;
  document.body.prepend(gate);
  const bar = document.createElement('div');
  bar.id = 'aliceAuthBar';
  bar.hidden = true;
  bar.innerHTML = '<span>已授權登入</span><button type="button">登出</button>';
  document.body.append(bar);
  const networkStatus = document.createElement('div');
  networkStatus.id = 'aliceNetworkStatus';
  networkStatus.textContent = '網路中斷，資料操作暫停；連線恢復後請確認畫面資料。';
  networkStatus.setAttribute('role', 'status');
  document.body.append(networkStatus);
  const view = document.defaultView;
  const updateNetwork = () => {
    const offline = !view.navigator.onLine;
    document.body.classList.toggle('alice-offline', offline);
    for (const child of document.body.children) {
      if (![gate, bar, networkStatus].includes(child) && child.tagName !== 'SCRIPT') child.inert = offline;
    }
  };
  view.addEventListener('online', updateNetwork);
  view.addEventListener('offline', updateNetwork);
  updateNetwork();
  const message = gate.querySelector('#aliceAuthMessage');
  const form = gate.querySelector('form');
  let authorized = false;
  let generation = 0;

  function stop() {
    authorized = false;
    onStop?.();
    document.body.classList.add('auth-pending');
    gate.hidden = false;
    bar.hidden = true;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    message.textContent = '';
    const button = form.querySelector('button');
    button.disabled = true;
    try {
      await sdk.signInWithEmailAndPassword(auth, form.elements.email.value.trim(), form.elements.password.value);
      form.elements.password.value = '';
    } catch (error) {
      console.warn('ALICE sign-in failed', error.code);
      message.textContent = error.code === 'auth/network-request-failed'
        ? '網路中斷，請確認連線後再試。' : '登入失敗，請檢查帳號與密碼。';
    } finally {
      button.disabled = false;
    }
  });
  bar.querySelector('button').addEventListener('click', () => sdk.signOut(auth));

  sdk.onAuthStateChanged(auth, async (user) => {
    const current = ++generation;
    stop();
    if (!user) return;
    try {
      const { claims } = await sdk.getIdTokenResult(user, true);
      if (current !== generation) return;
      if (claims.aliceApp !== access || !roles.includes(claims.aliceRole) ||
          (claims.aliceRole === 'designer' && !claims.aliceDesigner)) {
        message.textContent = '此帳號沒有本系統的使用權限，請聯絡管理者。';
        await sdk.signOut(auth);
        return;
      }
      authorized = true;
      gate.hidden = true;
      bar.hidden = false;
      document.body.classList.remove('auth-pending');
      onReady(claims);
    } catch (error) {
      message.textContent = '無法驗證權限，請檢查網路後重新整理。';
      await sdk.signOut(auth);
    }
  });
  return { isAuthorized: () => authorized };
}
