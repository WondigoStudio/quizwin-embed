/**
 * QuizWin Embed Widget v1.3 (checkbox для всех 3 провайдеров)
 * Требует: <script src="https://cdn.jsdelivr.net/npm/@fingerprintjs/fingerprintjs@3/dist/fp.min.js"></script>
 * CDN: https://cdn.jsdelivr.net/gh/WondigoStudio/quizwin-embed@latest/embed.js
 * Использование:
 *   <div data-qw-poll="123456" data-qw-key="qwk_ваш_ключ"></div>
 *   <script src="https://quizwin.free.nf/embed.js" defer></script>
 */
(function () {
  'use strict';

  const API_BASE = 'https://muddy-cell-5e80.windigo505official.workers.dev';

  const CSS = `
    .qw-widget * { box-sizing: border-box; margin: 0; padding: 0; }
    .qw-widget {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 560px;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      overflow: hidden;
      background: #fff;
      box-shadow: 0 2px 12px rgba(0,0,0,.08);
    }
    .qw-header { background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #fff; padding: 18px 22px; }
    .qw-header h2 { font-size: 17px; font-weight: 600; line-height: 1.4; }
    .qw-header p  { font-size: 13px; opacity: .85; margin-top: 4px; }
    .qw-body      { padding: 22px; }
    .qw-progress-bar { height: 4px; background: #e5e7eb; border-radius: 2px; margin-bottom: 20px; }
    .qw-progress-fill { height: 100%; background: #6366f1; border-radius: 2px; transition: width .3s ease; }
    .qw-step-label { font-size: 12px; color: #9ca3af; margin-bottom: 14px; }
    .qw-question { font-size: 15px; font-weight: 500; color: #111827; margin-bottom: 14px; }
    .qw-options  { display: flex; flex-direction: column; gap: 8px; }
    .qw-option   { display: flex; align-items: center; gap: 10px; border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px 14px; cursor: pointer; transition: border-color .15s, background .15s; }
    .qw-option:hover { border-color: #6366f1; background: #f5f3ff; }
    .qw-option.selected { border-color: #6366f1; background: #ede9fe; }
    .qw-option input   { accent-color: #6366f1; width: 16px; height: 16px; flex-shrink: 0; }
    .qw-option-text    { font-size: 14px; color: #374151; }
    .qw-textarea { width: 100%; border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px 12px; font-size: 14px; resize: vertical; min-height: 80px; outline: none; font-family: inherit; color: #111827; transition: border-color .15s; }
    .qw-textarea:focus { border-color: #6366f1; }
    .qw-scale { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 4px; }
    .qw-scale-btn { width: 40px; height: 40px; border: 1px solid #e5e7eb; border-radius: 8px; background: #fff; cursor: pointer; font-size: 14px; font-weight: 500; color: #374151; transition: all .15s; }
    .qw-scale-btn:hover, .qw-scale-btn.selected { background: #6366f1; border-color: #6366f1; color: #fff; }
    .qw-scale-labels { display: flex; justify-content: space-between; font-size: 11px; color: #9ca3af; margin-top: 6px; }
    .qw-actions { display: flex; gap: 10px; margin-top: 22px; }
    .qw-btn { flex: 1; padding: 11px; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; transition: opacity .15s; }
    .qw-btn:hover { opacity: .85; }
    .qw-btn-primary { background: #6366f1; color: #fff; }
    .qw-btn-ghost   { background: #f3f4f6; color: #374151; flex: 0 0 auto; padding: 11px 16px; }
    .qw-btn:disabled { opacity: .5; cursor: not-allowed; }
    .qw-results { display: flex; flex-direction: column; gap: 18px; }
    .qw-result-q  { font-size: 14px; font-weight: 500; color: #374151; margin-bottom: 10px; }
    .qw-result-bar-wrap { display: flex; flex-direction: column; gap: 6px; }
    .qw-result-row { display: flex; align-items: center; gap: 10px; }
    .qw-result-label { font-size: 13px; color: #374151; min-width: 80px; max-width: 180px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex-shrink: 0; }
    .qw-result-track { flex: 1; height: 8px; background: #e5e7eb; border-radius: 4px; overflow: hidden; }
    .qw-result-fill  { height: 100%; background: #6366f1; border-radius: 4px; transition: width .5s ease; }
    .qw-result-pct   { font-size: 12px; color: #9ca3af; width: 36px; text-align: right; }
    .qw-footer { text-align: center; padding: 12px; font-size: 11px; color: #c4b5fd; border-top: 1px solid #f3f4f6; }
    .qw-footer a { color: #6366f1; text-decoration: none; }
    .qw-loader { text-align: center; padding: 32px; color: #9ca3af; font-size: 14px; }
    .qw-error  { text-align: center; padding: 32px; color: #ef4444; font-size: 14px; }
    .qw-thanks { text-align: center; padding: 28px; }
    .qw-thanks h3 { font-size: 20px; color: #6366f1; margin-bottom: 8px; }
    .qw-thanks p  { font-size: 14px; color: #6b7280; }
    .qw-captcha-wrap { margin-top: 18px; display: flex; flex-direction: column; align-items: flex-start; gap: 8px; }
    .qw-captcha-label { font-size: 12px; color: #9ca3af; }
    .qw-captcha-error { font-size: 12px; color: #ef4444; margin-top: 4px; display: none; }
    .qw-captcha-error.visible { display: block; }
  `;

  if (!document.getElementById('qw-styles')) {
    const style = document.createElement('style');
    style.id = 'qw-styles';
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  // ── Идентификация — те же ключи что в poll.html ────────────────────────────
  // localStorage: qw_anon_key, cookie: qw_anon — синхронизированы с основным сайтом
  function _getSimpleFingerprint() {
    const d = [
      navigator.userAgent, navigator.language,
      screen.width + 'x' + screen.height, screen.colorDepth,
      new Date().getTimezoneOffset(),
      navigator.hardwareConcurrency || '',
      navigator.platform || ''
    ].join('|');
    let h = 0;
    for (let i = 0; i < d.length; i++) { h = ((h << 5) - h) + d.charCodeAt(i); h |= 0; }
    return 'sfp_' + Math.abs(h).toString(36);
  }

  function _getCookie(name) {
    const m = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return m ? m[2] : null;
  }

  function _setCookie(name, val, days) {
    const exp = new Date(Date.now() + days * 86400000).toUTCString();
    document.cookie = name + '=' + val + '; expires=' + exp + '; path=/; SameSite=Lax';
  }

  // Ждём пока FingerprintJS появится в window (может грузиться параллельно с embed.js)
  function waitForFP(timeout) {
    timeout = timeout || 3000;
    return new Promise(function(resolve) {
      if (typeof FingerprintJS !== 'undefined') { resolve(); return; }
      const start = Date.now();
      const t = setInterval(function() {
        if (typeof FingerprintJS !== 'undefined') { clearInterval(t); resolve(); return; }
        if (Date.now() - start > timeout)         { clearInterval(t); resolve(); return; }
      }, 50);
    });
  }

  function _getCanvasFingerprint() {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillStyle = '#f60';
      ctx.fillRect(125, 1, 62, 20);
      ctx.fillStyle = '#069';
      ctx.fillText('QuizWin fp', 2, 15);
      ctx.fillStyle = 'rgba(102,204,0,0.7)';
      ctx.fillText('QuizWin fp', 4, 17);
      const data = canvas.toDataURL();
      // Хешируем строку в число
      let h = 0;
      for (let i = 0; i < data.length; i++) { h = ((h << 5) - h) + data.charCodeAt(i); h |= 0; }
      return 'cfp_' + Math.abs(h).toString(36);
    } catch(e) {
      return 'cfp_nocanvas';
    }
  }

  async function getIdentity() {
    // fp_id — canvas fingerprint (стабильный, без внешних зависимостей)
    // Пробуем FingerprintJS если доступен, иначе canvas
    let fpId = '';
    try {
      await waitForFP(1500); // ждём не более 1.5с
      if (typeof FingerprintJS !== 'undefined') {
        const fp = await FingerprintJS.load();
        fpId = (await fp.get()).visitorId;
      }
    } catch(e) {}
    // Fallback на canvas если FingerprintJS не дал результат
    if (!fpId) fpId = _getCanvasFingerprint();

    // ls_key — тот же ключ qw_anon_key что в poll.html
    let lsKey = localStorage.getItem('qw_anon_key');
    if (!lsKey) {
      lsKey = 'ls_' + Date.now() + '_' + Math.random().toString(36).slice(2);
      localStorage.setItem('qw_anon_key', lsKey);
    }

    // cookie_key — тот же cookie qw_anon что в poll.html
    let cookieKey = _getCookie('qw_anon');
    if (!cookieKey) {
      cookieKey = 'ck_' + Date.now() + '_' + Math.random().toString(36).slice(2);
      _setCookie('qw_anon', cookieKey, 365);
    }

    const simpleFp = _getSimpleFingerprint();

    return {
      voterId:   lsKey,       // voter_id = ls_key для совместимости
      fpId:      fpId,
      lsKey:     lsKey,
      cookieKey: cookieKey,
      simpleFp:  simpleFp,
    };
  }

  // ── API ────────────────────────────────────────────────────────────────────
  async function apiFetch(path, apiKey, options) {
    options = options || {};
    const sep = path.includes('?') ? '&' : '?';
    const url = API_BASE + path + sep + 'api_key=' + encodeURIComponent(apiKey);
    const res = await fetch(url, Object.assign({}, options, {
      headers: Object.assign({ 'Content-Type': 'application/json' }, options.headers || {}),
    }));
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Ошибка API');
    return json;
  }

  // ── DOM helper ─────────────────────────────────────────────────────────────
  function h(tag, attrs) {
    attrs = attrs || {};
    const children = Array.prototype.slice.call(arguments, 2);
    const el = document.createElement(tag);
    for (const k in attrs) {
      const v = attrs[k];
      if (k === 'className') el.className = v;
      else if (k.indexOf('on') === 0) el.addEventListener(k.slice(2).toLowerCase(), v);
      else el.setAttribute(k, v);
    }
    (function append(list) {
      list.forEach(function(ch) {
        if (ch == null) return;
        if (Array.isArray(ch)) { append(ch); return; }
        el.appendChild(typeof ch === 'string' ? document.createTextNode(ch) : ch);
      });
    })(children);
    return el;
  }

  // ── Widget ─────────────────────────────────────────────────────────────────
  class QwWidget {
    constructor(container, pollId, apiKey, backendUrl) {
      this.container  = container;
      this.pollId     = pollId;
      this.apiKey     = apiKey;
      this.backendUrl = backendUrl || null; // URL прокси на сервере пользователя
      this.poll       = null;
      this.step       = 0;
      this.answers    = {};
      this.submitted  = false;
      this._captchaToken = null;  // токен капчи, заполняется после прохождения
      this.render(this._loader());
      this.load();
    }

    render(el) {
      this.container.innerHTML = '';
      const wrap = h('div', { className: 'qw-widget' }, el,
        h('div', { className: 'qw-footer' },
          'Powered by ', h('a', { href: 'https://quizwin.free.nf', target: '_blank' }, 'QuizWin')
        )
      );
      this.container.appendChild(wrap);
    }

    _loader() { return h('div', { className: 'qw-loader' }, '⏳ Загрузка опроса...'); }
    _error(msg) { return h('div', { className: 'qw-body' }, h('div', { className: 'qw-error' }, '⚠️ ' + msg)); }

    async load() {
      try {
        // apiFetch бросит ошибку при не-200. При geo_blocked (403) и
        // captcha_required нам нужно поймать специфичный код — делаем
        // сырой fetch чтобы читать тело при любом статусе.
        const rawRes = await fetch(
          API_BASE + '/polls/' + this.pollId + '?api_key=' + encodeURIComponent(this.apiKey)
        );
        const rawData = await rawRes.json();

        if (!rawRes.ok) {
          if (rawData.error === 'geo_blocked') {
            this.render(h('div', { className: 'qw-body' },
              h('div', { className: 'qw-error' }, '🌍 Опрос недоступен в вашем регионе')
            ));
            return;
          }
          throw new Error(rawData.error || ('HTTP ' + rawRes.status));
        }

        this.poll = rawData;

        // Проверяем — голосовал ли уже этот пользователь
        const identity = await getIdentity();
        const params = new URLSearchParams({
          fp_id:      identity.fpId      || '',
          ls_key:     identity.lsKey     || '',
          cookie_key: identity.cookieKey || '',
          simple_fp:  identity.simpleFp  || '',
        });
        try {
          const checkRes = await fetch(
            API_BASE + '/polls/' + this.pollId + '/voted?' +
            params.toString() + '&api_key=' + encodeURIComponent(this.apiKey)
          );
          const checkData = await checkRes.json();
          if (checkData.voted) {
            this.renderThanks(true);
            return;
          }
        } catch(_) {}

        this.renderStep();
      } catch (e) {
        this.render(this._error(e.message));
      }
    }

    renderStep() {
      const poll  = this.poll;
      const q     = poll.questions[this.step];
      const total = poll.questions.length;
      const pct   = Math.round((this.step / total) * 100);

      const header = h('div', { className: 'qw-header' },
        h('h2', {}, poll.title),
        poll.description ? h('p', {}, poll.description) : null
      );

      const isLastStep = this.step === total - 1;

      const body = h('div', { className: 'qw-body' },
        h('div', { className: 'qw-progress-bar' },
          h('div', { className: 'qw-progress-fill', style: 'width:' + pct + '%' })
        ),
        h('div', { className: 'qw-step-label' }, 'Вопрос ' + (this.step + 1) + ' из ' + total),
        h('div', { className: 'qw-question' }, q.text),
        this._renderInput(q),
        // Капча показывается только на последнем шаге если включена в опросе
        isLastStep && poll.captcha ? this._renderCaptcha(poll.captcha) : null,
        h('div', { className: 'qw-actions' },
          ...[
            this.step > 0
              ? h('button', { className: 'qw-btn qw-btn-ghost', onClick: () => this.prev() }, '← Назад')
              : null,
            h('button', { className: 'qw-btn qw-btn-primary', onClick: () => this.next() },
              isLastStep ? '✓ Отправить' : 'Далее →'
            ),
          ].filter(Boolean)
        )
      );

      this.render(h('div', {}, header, body));
      this._nextBtn = this.container.querySelector('.qw-btn-primary');
    }

    _renderInput(q) {
      const saved = this.answers[q.id] || {};

      if (q.type === 'radio') {
        const wrap = h('div', { className: 'qw-options' });
        q.options.forEach(opt => {
          const isSel = (saved.option_ids || []).includes(opt.id);
          const row = h('label', { className: 'qw-option' + (isSel ? ' selected' : '') },
            h('input', { type: 'radio', name: 'q_' + q.id, value: opt.id,
              onChange: () => {
                this.answers[q.id] = { option_ids: [opt.id] };
                wrap.querySelectorAll('.qw-option').forEach(el => el.classList.remove('selected'));
                row.classList.add('selected');
              }
            }),
            h('span', { className: 'qw-option-text' }, opt.text)
          );
          if (isSel) row.querySelector('input').setAttribute('checked', '');
          wrap.appendChild(row);
        });
        return wrap;
      }

      if (q.type === 'checkbox') {
        const selected = new Set(saved.option_ids || []);
        const wrap = h('div', { className: 'qw-options' });
        q.options.forEach(opt => {
          const isSel = selected.has(opt.id);
          const row = h('label', { className: 'qw-option' + (isSel ? ' selected' : '') },
            h('input', { type: 'checkbox', value: opt.id,
              onChange: (e) => {
                if (e.target.checked) { selected.add(opt.id); row.classList.add('selected'); }
                else { selected.delete(opt.id); row.classList.remove('selected'); }
                this.answers[q.id] = { option_ids: [...selected] };
              }
            }),
            h('span', { className: 'qw-option-text' }, opt.text)
          );
          if (isSel) row.querySelector('input').setAttribute('checked', '');
          wrap.appendChild(row);
        });
        return wrap;
      }

      if (q.type === 'text') {
        const ta = h('textarea', { className: 'qw-textarea', placeholder: 'Ваш ответ...' });
        ta.value = saved.text_value || '';
        ta.addEventListener('input', () => { this.answers[q.id] = { text_value: ta.value }; });
        return ta;
      }

      if (q.type === 'yn') {
        const wrap = h('div', { className: 'qw-options' });
        ['Да', 'Нет'].forEach(label => {
          const isSel = saved.text_value === label;
          const row = h('label', { className: 'qw-option' + (isSel ? ' selected' : '') },
            h('input', { type: 'radio', name: 'q_' + q.id,
              onChange: () => {
                this.answers[q.id] = { text_value: label };
                wrap.querySelectorAll('.qw-option').forEach(el => el.classList.remove('selected'));
                row.classList.add('selected');
              }
            }),
            h('span', { className: 'qw-option-text' }, label)
          );
          if (isSel) row.querySelector('input').setAttribute('checked', '');
          wrap.appendChild(row);
        });
        return wrap;
      }

      if (q.type === 'scale') {
        const wrap    = h('div', {});
        const buttons = h('div', { className: 'qw-scale' });
        for (let i = q.scale_min; i <= q.scale_max; i++) {
          const val = String(i);
          const btn = h('button', {
            className: 'qw-scale-btn' + (saved.text_value === val ? ' selected' : ''),
            onClick: () => {
              this.answers[q.id] = { text_value: val };
              buttons.querySelectorAll('.qw-scale-btn').forEach(b => b.classList.remove('selected'));
              btn.classList.add('selected');
            }
          }, val);
          buttons.appendChild(btn);
        }
        wrap.appendChild(buttons);
        if (q.scale_label_min || q.scale_label_max) {
          wrap.appendChild(h('div', { className: 'qw-scale-labels' },
            h('span', {}, q.scale_label_min || ''),
            h('span', {}, q.scale_label_max || '')
          ));
        }
        return wrap;
      }

      return h('div', {}, '(неизвестный тип вопроса)');
    }

    // ── Капча ─────────────────────────────────────────────────────────────────
    // captchaConfig = { type: 'hcaptcha'|'turnstile'|'recaptcha', site_key: '...' }
    // Все три типа рендерятся как видимый чекбокс-виджет (нужен ключ
    // reCAPTCHA именно типа "v2: Я не робот (Checkbox)" — v3/Invisible-ключи
    // Google не даёт рендерить через grecaptcha.render()).
    _renderCaptcha(captchaConfig) {
      const self = this;
      const wrap = h('div', { className: 'qw-captcha-wrap' });
      const label = h('div', { className: 'qw-captcha-label' }, '🛡️ Подтвердите, что вы не робот');
      const errorEl = h('div', { className: 'qw-captcha-error' }, 'Пройдите проверку перед отправкой');
      const widgetEl = h('div', { id: 'qw-captcha-widget-' + this.pollId });

      wrap.appendChild(label);
      wrap.appendChild(widgetEl);
      wrap.appendChild(errorEl);

      // Сохраняем ссылку чтобы submit мог показать ошибку
      this._captchaErrorEl = errorEl;

      // Загружаем скрипт капчи и инициализируем виджет после рендера
      setTimeout(() => self._initCaptchaWidget(captchaConfig, widgetEl), 0);

      return wrap;
    }

    _initCaptchaWidget(cfg, container) {
      const self = this;
      const type = cfg.type;
      const siteKey = cfg.site_key;

      if (!siteKey) {
        container.innerHTML = '<span style="font-size:12px;color:#ef4444">⚠️ captcha_site_key не настроен</span>';
        return;
      }

      const scriptUrls = {
        hcaptcha:  'https://js.hcaptcha.com/1/api.js?render=explicit',
        turnstile: 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit',
        recaptcha: 'https://www.google.com/recaptcha/api.js?render=explicit',
      };

      const scriptUrl = scriptUrls[type];
      if (!scriptUrl) return;

      // Коллбэк при получении токена
      const callbackName = '_qwCaptchaCb_' + self.pollId;
      window[callbackName] = function(token) {
        self._captchaToken = token;
        if (self._captchaErrorEl) self._captchaErrorEl.classList.remove('visible');
      };
      // Коллбэк при истечении токена
      const expiredName = '_qwCaptchaExp_' + self.pollId;
      window[expiredName] = function() { self._captchaToken = null; };

      const doRender = () => {
        try {
          if (type === 'hcaptcha' && window.hcaptcha) {
            window.hcaptcha.render(container, {
              sitekey: siteKey,
              callback: callbackName,
              'expired-callback': expiredName,
              theme: 'light',
            });
          } else if (type === 'turnstile' && window.turnstile) {
            window.turnstile.render(container, {
              sitekey: siteKey,
              callback: callbackName,
              'expired-callback': expiredName,
              theme: 'light',
            });
          } else if (type === 'recaptcha' && window.grecaptcha) {
            window.grecaptcha.ready(() => {
              try {
                window.grecaptcha.render(container, {
                  sitekey: siteKey,
                  callback: callbackName,
                  'expired-callback': expiredName,
                  theme: 'light',
                  size: 'normal',
                });
              } catch (renderErr) {
                // Самая частая причина — ключ не типа "v2 Checkbox"
                // (например v3/Invisible/Enterprise). Нужен другой ключ
                // из консоли Google, кодом это не обойти.
                console.error('QuizWin: reCAPTCHA render failed — проверьте, что site_key создан как "v2: Я не робот (Checkbox)"', renderErr);
                container.innerHTML = '<span style="font-size:12px;color:#ef4444">⚠️ Неверный тип ключа reCAPTCHA — нужен v2 Checkbox</span>';
              }
            });
          }
        } catch(e) {
          console.warn('QuizWin captcha render error:', e);
        }
      };

      // Если скрипт уже загружен — рендерим сразу
      const libReady = {
        hcaptcha:  () => !!window.hcaptcha,
        turnstile: () => !!window.turnstile,
        recaptcha: () => !!(window.grecaptcha && window.grecaptcha.render),
      };
      if (libReady[type] && libReady[type]()) {
        doRender();
        return;
      }

      // Иначе — подгружаем скрипт
      if (!document.querySelector('script[src*="' + (type === 'recaptcha' ? 'recaptcha' : type) + '"]')) {
        const s = document.createElement('script');
        s.src = scriptUrl;
        s.async = true;
        s.defer = true;
        s.onload = doRender;
        document.head.appendChild(s);
      } else {
        // Скрипт уже есть но API ещё не готово — ждём
        const t = setInterval(() => {
          if (libReady[type] && libReady[type]()) { clearInterval(t); doRender(); }
        }, 100);
        setTimeout(() => clearInterval(t), 5000);
      }
    }

    next() {
      const q   = this.poll.questions[this.step];
      const ans = this.answers[q.id];
      const hasPendingFile = q.type === 'file' && this._pendingFiles && this._pendingFiles[q.id];
      const isEmpty = !hasPendingFile && (!ans || (
        (!ans.option_ids || ans.option_ids.length === 0) &&
        (!ans.text_value || ans.text_value.trim() === '' || ans.text_value === 'pending')
      ));
      if (q.required && isEmpty) {
        alert('Пожалуйста, ответьте на вопрос перед тем как продолжить.');
        return;
      }
      if (this.step === this.poll.questions.length - 1) {
        // Последний шаг — проверяем капчу если включена
        if (this.poll.captcha && !this._captchaToken) {
          if (this._captchaErrorEl) this._captchaErrorEl.classList.add('visible');
          return;
        }
        this.submit();
      } else {
        this.step++;
        this.renderStep();
      }
    }

    prev() {
      if (this.step > 0) { this.step--; this.renderStep(); }
    }

    async submit() {
      if (this.submitted) return;
      this.submitted = true;
      if (this._nextBtn) {
        this._nextBtn.disabled = true;
        this._nextBtn.textContent = 'Отправка...';
      }

      // getIdentity — async, ждём FingerprintJS
      const identity = await getIdentity();
      const answers  = Object.entries(this.answers).map(([qid, ans]) =>
        Object.assign({ question_id: parseInt(qid) }, ans)
      );

      try {
        if (this.backendUrl) {
          // Голосуем через прокси пользователя (секретный ключ на его сервере)
          const proxyUrl = this.backendUrl + '?path=/polls/' + this.pollId + '/vote';
          const proxyRes = await fetch(proxyUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              voter_id:      identity.voterId,
              fp_id:         identity.fpId,
              ls_key:        identity.lsKey,
              cookie_key:    identity.cookieKey,
              simple_fp:     identity.simpleFp,
              captcha_token: this._captchaToken || undefined,
              answers,
            }),
          });
          const proxyData = await proxyRes.json();
          if (!proxyRes.ok) throw new Error(proxyData.error || 'Ошибка прокси');
        } else {
          // Голосуем напрямую через Worker с публичным ключом
          await apiFetch('/polls/' + this.pollId + '/vote', this.apiKey, {
            method: 'POST',
            body: JSON.stringify({
              voter_id:      identity.voterId,
              fp_id:         identity.fpId,
              ls_key:        identity.lsKey,
              cookie_key:    identity.cookieKey,
              simple_fp:     identity.simpleFp,
              captcha_token: this._captchaToken || undefined,
              answers,
            }),
          });
        }
        this.renderThanks();
      } catch (e) {
        this.submitted = false;
        if (this._nextBtn) {
          this._nextBtn.disabled = false;
          this._nextBtn.textContent = '✓ Отправить';
        }
        if (e.message.includes('уже проголосовал')) {
          this.renderThanks(true);
        } else {
          alert('Ошибка отправки: ' + e.message);
        }
      }
    }

    async renderThanks(alreadyVoted) {
      alreadyVoted = alreadyVoted || false;
      const poll   = this.poll;
      const header = h('div', { className: 'qw-header' }, h('h2', {}, poll.title));

      let resultsEl = null;
      if (poll.show_results) {
        try {
          const r = await apiFetch('/polls/' + this.pollId + '/results', this.apiKey);
          resultsEl = this._renderResults(r);
        } catch (_) {}
      }

      const thanks = h('div', { className: 'qw-body' },
        h('div', { className: 'qw-thanks' },
          h('h3', {}, alreadyVoted ? '👋 Вы уже голосовали!' : '🎉 Спасибо!'),
          h('p', {}, alreadyVoted ? 'Результаты вашего голосования уже учтены.' : 'Ваш голос учтён.')
        ),
        resultsEl || ''
      );

      this.render(h('div', {}, header, thanks));
    }

    _renderResults(r) {
      const wrap = h('div', { className: 'qw-results', style: 'margin-top:16px' });
      r.questions.forEach(q => {
        if (!q.options || q.options.length === 0) return;
        wrap.appendChild(h('div', {},
          h('div', { className: 'qw-result-q' }, q.text),
          h('div', { className: 'qw-result-bar-wrap' },
            ...q.options.map(opt =>
              h('div', { className: 'qw-result-row' },
                h('span', { className: 'qw-result-label', title: opt.text }, opt.text),
                h('div', { className: 'qw-result-track' },
                  h('div', { className: 'qw-result-fill', style: 'width:' + opt.percent + '%' })
                ),
                h('span', { className: 'qw-result-pct' }, opt.percent + '%')
              )
            )
          )
        ));
      });
      if (r.respondents) {
        wrap.appendChild(h('div', { style: 'text-align:center;font-size:12px;color:#9ca3af;margin-top:8px' },
          'Проголосовало: ' + r.respondents
        ));
      }
      return wrap;
    }
  }

  // ── Auto-init ──────────────────────────────────────────────────────────────
  function init() {
    document.querySelectorAll('[data-qw-poll]').forEach(el => {
      if (el.dataset.qwInit) return;
      el.dataset.qwInit = '1';
      const pollId = el.dataset.qwPoll;
      const apiKey = el.dataset.qwKey;
      if (!pollId || !apiKey) {
        el.textContent = 'QuizWin: укажите data-qw-poll и data-qw-key';
        return;
      }
      const backendUrl = el.dataset.qwBackend || null;
      new QwWidget(el, parseInt(pollId), apiKey, backendUrl);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
