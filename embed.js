/**
 * QuizWin Embed Widget v1.8 (+ серверный прогресс/resume для step-режима)
 * Требует: <script src="https://cdn.jsdelivr.net/npm/@fingerprintjs/fingerprintjs@3/dist/fp.min.js"></script>
 * CDN: https://cdn.jsdelivr.net/gh/WondigoStudio/quizwin-embed@latest/embed.js
 * Использование:
 *   <div data-qw-poll="123456" data-qw-key="qwk_ваш_ключ"></div>
 *   <script src="https://quizwin.free.nf/embed.js" defer></script>
 *
 * ── История изменений ────────────────────────────────────────────────────
 * v1.8 — Прогресс прохождения (quiz/test/vote) теперь сохраняется на
 *        сервере по каждому вопросу (final:false в /vote, без капчи и
 *        без завершающей логики), а не только в памяти браузера. При
 *        повторном открытии страницы GET /polls/{id}/progress (раньше не
 *        существовал) возвращает зафиксированный question_order (с учётом
 *        shuffle_q для этой попытки) и номер следующего неотвеченного
 *        вопроса — виджет резюмирует ровно с того места, где прервались,
 *        вместо того чтобы начинать заново. survey и tierlist не затронуты
 *        — у survey нет промежуточного состояния (шлётся одним пакетом в
 *        конце, как и раньше), у tierlist своя логика через tl_status.
 * v1.7 — timer_q/timer_total теперь реально работают (раньше не отдавались
 *        публичным API вообще): по истечении timer_q — принудительный переход
 *        дальше без ответа; по истечении timer_total — принудительная отправка
 *        всего собранного. "Пройти ещё раз" (pres_show_refill) теперь работает
 *        как Premium-restart на сайте — через restart:true в /vote, который
 *        api/pub/polls/vote.php обходит one_per_user ТОЛЬКО если владелец
 *        опроса явно разрешил pres_show_refill (раньше кнопка была доступна
 *        лишь при one_per_user=0 — не работала именно там, где нужнее всего).
 * v1.6 — Tier List через виджет теперь настоящий турнир на выбывание с
 *        картинками (tlStart/_tlRender/_tlPick/_tlRenderResult), как на
 *        сайте (poll.html), а не текстовый реордеринг ↑/↓ без картинок.
 *        Ходит в новые эндпоинты api/pub/polls/tierlist_start|match|result.php
 *        (их не было в публичном API вообще). Стандартная проверка /voted
 *        пропускается для типа tierlist — у него своя логика возобновления/
 *        завершения турнира через tl_status.
 * v1.5 — приведено в соответствие с тем, что делает основной сайт (poll.html),
 *        используя новые поля api/pub/polls/get.php:
 *        - is_18plus: гейт с датой рождения перед показом опроса (как на сайте)
 *        - type === 'survey': все вопросы одним списком + одна кнопка отправки,
 *          вместо пошагового режима (который остаётся для quiz/test/vote)
 *        - pres_show_progress / pres_show_q_num / pres_allow_back: виджет
 *          теперь реально их соблюдает, а не показывает всё безусловно
 *        - theme_color / cover_url: применяются к виджету
 *        - confirm_text: кастомный текст благодарности вместо жёстко
 *          зашитого "Спасибо!"
 *        - pres_show_refill / refill_btn_text: кнопка "пройти ещё раз"
 *          (работает только если у опроса выключен one_per_user — backend
 *          публичного API пока не поддерживает принудительный restart,
 *          который есть на сайте через Premium)
 *        - show_correct: после отправки квиза/теста показывается разбор
 *          правильных/неправильных ответов, используя новое поле `results`
 *          в ответе POST /vote (раньше сервер вообще не отдавал is_correct)
 *        - require_auth: понятное сообщение вместо попытки анонимно
 *          пройти опрос, который сервер теперь блокирует (403 auth_required)
 * v1.4 — добавлена отрисовка типов вопросов, которых не было в v1.3:
 *        text_line, dropdown, date, time, info_title, info_image,
 *        info_video, tierlist. Раньше при встрече с ними виджет показывал
 *        "(неизвестный тип вопроса)" и блокировал прохождение опроса,
 *        если вопрос был обязательным — пройти дальше было невозможно.
 *        Также убран мёртвый код для типа 'file' (this._pendingFiles нигде
 *        не заполнялся) — теперь file-вопросы явно помечены как
 *        неподдерживаемые и не блокируют прохождение опроса.
 */
(function () {
  'use strict';

  const API_BASE = 'https://muddy-cell-5e80.windigo505official.workers.dev';

  // Типы вопросов, которые не требуют ответа от пользователя — это просто
  // информационные слайды. Даже если backend вернёт required=true (что не
  // должно случаться, но на всякий случай не доверяем чужому вводу), они
  // никогда не блокируют переход "Далее".
  const INFO_TYPES = ['info_title', 'info_image', 'info_video'];

  // Типы, для которых у виджета пока нет полноценной реализации ввода.
  // Показываем предупреждение и не блокируем прохождение опроса, даже если
  // вопрос помечен как обязательный на стороне создателя опроса.
  const UNSUPPORTED_TYPES = ['file'];

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
    .qw-input { width: 100%; border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px 12px; font-size: 14px; outline: none; font-family: inherit; color: #111827; transition: border-color .15s; background: #fff; }
    .qw-input:focus { border-color: #6366f1; }
    .qw-select { width: 100%; border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px 12px; font-size: 14px; outline: none; font-family: inherit; color: #111827; background: #fff; cursor: pointer; transition: border-color .15s; }
    .qw-select:focus { border-color: #6366f1; }
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
    .qw-info-image { width: 100%; border-radius: 10px; display: block; max-height: 320px; object-fit: cover; }
    .qw-info-video { width: 100%; border-radius: 10px; display: block; aspect-ratio: 16/9; border: none; }
    .qw-info-note  { font-size: 12px; color: #9ca3af; margin-top: 10px; text-align: center; }
    .qw-unsupported { font-size: 13px; color: #9ca3af; border: 1px dashed #e5e7eb; border-radius: 8px; padding: 14px; text-align: center; }
    .qw-tl-topbar { display: flex; justify-content: space-between; font-size: 12px; color: #6b7280; margin-bottom: 8px; }
    .qw-tl-duel { display: flex; align-items: center; gap: 10px; margin-top: 16px; }
    .qw-tl-card { flex: 1; cursor: pointer; border: 1px solid #e5e7eb; border-radius: 10px; overflow: hidden; transition: border-color .15s, transform .15s; background: #fff; }
    .qw-tl-card:hover { border-color: #6366f1; transform: translateY(-2px); }
    .qw-tl-img-wrap { width: 100%; aspect-ratio: 3/4; overflow: hidden; background: #f3f4f6; }
    .qw-tl-img-wrap img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .qw-tl-caption { padding: 8px 10px; font-size: 13px; color: #374151; text-align: center; }
    .qw-tl-vs { font-size: 13px; font-weight: 700; color: #9ca3af; flex-shrink: 0; }
    .qw-tl-result-row { display: flex; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px solid #f3f4f6; }
    .qw-tl-result-row:last-child { border-bottom: none; }
    .qw-tl-rank { font-size: 13px; font-weight: 700; color: #6366f1; width: 30px; flex-shrink: 0; text-align: center; }
    .qw-tl-result-img { width: 36px; height: 48px; object-fit: cover; border-radius: 6px; flex-shrink: 0; }
    .qw-tl-result-title { font-size: 13px; color: #374151; }
    .qw-cover { width: 100%; max-height: 200px; object-fit: cover; display: block; }
    .qw-age-gate { padding: 32px 24px; text-align: center; }
    .qw-age-gate .qw-age-emoji { font-size: 32px; display: block; margin-bottom: 10px; }
    .qw-age-gate h3 { font-size: 16px; color: #111827; margin-bottom: 6px; }
    .qw-age-gate p { font-size: 13px; color: #6b7280; margin-bottom: 16px; }
    .qw-age-gate input { max-width: 220px; margin: 0 auto 12px; display: block; }
    .qw-age-error { font-size: 12px; color: #ef4444; margin-top: 8px; display: none; }
    .qw-age-error.visible { display: block; }
    .qw-survey-block { margin-bottom: 24px; padding-bottom: 20px; border-bottom: 1px solid #f3f4f6; }
    .qw-survey-block:last-of-type { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
    .qw-survey-num { font-size: 12px; color: #9ca3af; margin-bottom: 4px; }
    .qw-refill-btn { margin-top: 14px; width: 100%; padding: 10px; border: 1px solid #e5e7eb; background: #fff; color: #6366f1; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; }
    .qw-refill-btn:hover { background: #f5f3ff; }
    .qw-score-box { text-align: center; padding: 14px; background: #f5f3ff; border-radius: 10px; margin-bottom: 16px; }
    .qw-score-box .qw-score-num { font-size: 22px; font-weight: 700; color: #6366f1; }
    .qw-timer-wrap { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; color: #9ca3af; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 999px; padding: 3px 10px; margin-bottom: 10px; }
    .qw-timer-wrap.qw-timer-warn { color: #d97706; border-color: #fde68a; background: #fffbeb; }
    .qw-timer-wrap.qw-timer-danger { color: #ef4444; border-color: #fecaca; background: #fef2f2; }
    .qw-total-timer-wrap { display: flex; justify-content: flex-end; margin-bottom: 8px; }
    .qw-review-row { display: flex; align-items: flex-start; gap: 8px; padding: 8px 0; font-size: 13px; }
    .qw-review-row .qw-review-ico { flex-shrink: 0; }
    .qw-review-correct { color: #059669; }
    .qw-review-wrong { color: #ef4444; text-decoration: line-through; }
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

  // Извлекаем YouTube/Vimeo id для встраивания через iframe. Если ссылка
  // не распознана — просто отдаём её как есть (сработает для прямых mp4 и т.п.
  // через <video>, тоже поддержано ниже).
  function _toEmbedVideoUrl(url) {
    if (!url) return null;
    const yt = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{6,})/);
    if (yt) return 'https://www.youtube.com/embed/' + yt[1];
    const vimeo = url.match(/vimeo\.com\/(\d+)/);
    if (vimeo) return 'https://player.vimeo.com/video/' + vimeo[1];
    return null;
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
      // theme_color — раньше игнорировался, виджет всегда был фиолетовым
      // независимо от настройки на сайте.
      if (this.poll && this.poll.theme_color) {
        const header = wrap.querySelector('.qw-header');
        if (header) header.style.background = this.poll.theme_color;
        wrap.querySelectorAll('.qw-btn-primary').forEach(btn => { btn.style.background = this.poll.theme_color; });
        wrap.querySelectorAll('.qw-progress-fill, .qw-result-fill').forEach(bar => { bar.style.background = this.poll.theme_color; });
      }
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
          if (rawData.error === 'auth_required') {
            this.render(h('div', { className: 'qw-body' },
              h('div', { className: 'qw-error' }, '🔒 ' + (rawData.message || 'Этот опрос доступен только авторизованным пользователям на quizwin.free.nf'))
            ));
            return;
          }
          throw new Error(rawData.error || ('HTTP ' + rawRes.status));
        }

        this.poll = rawData;

        // Проверка "уже проходил" — три разных механики под разные режимы:
        //  - tierlist: пропускаем полностью, своя логика через tl_status
        //    внутри POST /tierlist/start.
        //  - survey: как раньше, /voted (весь опрос шлётся одним пакетом
        //    в конце, промежуточного серверного прогресса нет).
        //  - quiz/test/vote (step-режим): /progress — раньше не
        //    использовался вообще, виджет всегда начинал с нуля, даже если
        //    часть ответов уже сохранена на сервере (например вкладку
        //    закрыли на середине). Теперь резюмируем ровно с того вопроса,
        //    на котором остановились — question_order фиксируется на
        //    сервере (учитывает shuffle_q) и заменяет случайный порядок,
        //    который для показа мог быть отдан отдельно на каждый /polls/{id}.
        const identity = await getIdentity();
        this._identity = identity;

        if (this.poll.type === 'tierlist') {
          // ничего — обрабатывается в tlStart()
        } else if (this.poll.type === 'survey') {
          const params = new URLSearchParams({
            fp_id: identity.fpId || '', ls_key: identity.lsKey || '',
            cookie_key: identity.cookieKey || '', simple_fp: identity.simpleFp || '',
          });
          try {
            const checkRes = await fetch(
              API_BASE + '/polls/' + this.pollId + '/voted?' +
              params.toString() + '&api_key=' + encodeURIComponent(this.apiKey)
            );
            const checkData = await checkRes.json();
            if (checkData.voted) { this.renderThanks(true); return; }
          } catch(_) {}
        } else {
          const params = new URLSearchParams({
            fp_id: identity.fpId || '', ls_key: identity.lsKey || '',
            cookie_key: identity.cookieKey || '', simple_fp: identity.simpleFp || '',
          });
          try {
            const progRes = await fetch(
              API_BASE + '/polls/' + this.pollId + '/progress?' +
              params.toString() + '&api_key=' + encodeURIComponent(this.apiKey)
            );
            const prog = await progRes.json();
            if (prog.is_complete) { this.renderThanks(true); return; }

            this._attemptId = prog.attempt_id || null;

            // Переупорядочиваем вопросы под зафиксированный на сервере
            // question_order (учитывает shuffle_q для ЭТОЙ попытки) —
            // иначе индекс шага не совпадёт с тем, что реально отвечено.
            if (Array.isArray(prog.question_order) && prog.question_order.length) {
              const byId = {};
              this.poll.questions.forEach(q => { byId[q.id] = q; });
              const reordered = prog.question_order.map(id => byId[id]).filter(Boolean);
              this.poll.questions.forEach(q => {
                if (!prog.question_order.includes(q.id)) reordered.push(q);
              });
              if (reordered.length === this.poll.questions.length) {
                this.poll.questions = reordered;
              }
            }

            if (prog.next_question_id != null) {
              const idx = this.poll.questions.findIndex(q => q.id === prog.next_question_id);
              if (idx >= 0) this.step = idx;
            } else if ((prog.answered_count || 0) > 0) {
              this.step = this.poll.questions.length - 1;
            }
          } catch(_) {}
        }

        // Гейт 18+ — раньше отсутствовал полностью (поле is_18plus не
        // приходило от сервера), теперь ведём себя как поль.html: спрашиваем
        // дату рождения перед показом контента, помним подтверждение в
        // sessionStorage чтобы не спрашивать повторно на той же вкладке.
        if (this.poll.is_18plus) {
          const allowed = await this._show18PlusGate();
          if (!allowed) return;
        }

        this._startRender();
      } catch (e) {
        this.render(this._error(e.message));
      }
    }

    // ── Гейт 18+ ──────────────────────────────────────────────────────────
    // Возвращает Promise<boolean> — true если можно показывать опрос.
    // Логика зеркалит show18PlusGate() из poll.html: спрашиваем дату
    // рождения, считаем возраст, при <18 блокируем полностью.
    _show18PlusGate() {
      return new Promise((resolve) => {
        const sessionKey = 'qw_18plus_ok_' + this.pollId;
        if (sessionStorage.getItem(sessionKey) === '1') { resolve(true); return; }

        const errEl = h('div', { className: 'qw-age-error' }, 'Укажите дату рождения');
        const input = h('input', { type: 'date', className: 'qw-input' });

        const confirmAge = () => {
          const val = input.value;
          if (!val) { errEl.textContent = 'Укажите дату рождения'; errEl.classList.add('visible'); return; }
          const dob = new Date(val + 'T00:00:00');
          if (isNaN(dob.getTime()) || dob > new Date()) {
            errEl.textContent = 'Некорректная дата'; errEl.classList.add('visible'); return;
          }
          const today = new Date();
          let age = today.getFullYear() - dob.getFullYear();
          const hadBirthday = (today.getMonth() > dob.getMonth()) ||
            (today.getMonth() === dob.getMonth() && today.getDate() >= dob.getDate());
          if (!hadBirthday) age--;

          if (age < 18) {
            this.render(h('div', { className: 'qw-body' },
              h('div', { className: 'qw-age-gate' },
                h('span', { className: 'qw-age-emoji' }, '🔞'),
                h('h3', {}, 'Доступ закрыт'),
                h('p', {}, 'Этот опрос содержит контент 18+ и недоступен пользователям младше 18 лет.')
              )
            ));
            resolve(false);
            return;
          }

          sessionStorage.setItem(sessionKey, '1');
          resolve(true);
        };

        this.render(h('div', { className: 'qw-body' },
          h('div', { className: 'qw-age-gate' },
            h('span', { className: 'qw-age-emoji' }, '🔞'),
            h('h3', {}, 'Этот опрос содержит контент 18+'),
            h('p', {}, 'Укажите дату рождения, чтобы продолжить'),
            input,
            h('button', { className: 'qw-btn qw-btn-primary', style: 'width:100%', onClick: confirmAge }, 'Подтвердить →'),
            errEl
          )
        ));
      });
    }

    // ── Точка входа в рендер после всех проверок (гео/18+/voted) ───────────
    // survey — все вопросы одним списком (как renderSurveyAll() на сайте),
    // quiz/test/vote (и всё остальное на всякий случай) — по одному вопросу,
    // как раньше. Раньше этой развилки не было вообще — виджет всегда шёл
    // пошагово, даже для survey, где на сайте ожидается список.
    _startRender() {
      // timer_total — раньше не было в виджете вообще. Запускаем один раз
      // (не для каждого шага — clearInterval внутри не трогаем при
      // переходах между вопросами). Не применяем к tierlist — как и на
      // сайте, общий таймер минут на "весь опрос" не имеет смысла для
      // турнирной сетки дуэлей.
      if (this.poll.timer_total > 0 && this.poll.type !== 'tierlist' && !this._totalTimerStarted) {
        this._totalTimerStarted = true;
        this._startTotalTimer(this.poll.timer_total * 60);
      }

      if (this.poll.type === 'tierlist') {
        this.tlStart();
      } else if (this.poll.type === 'survey') {
        this.renderSurveyAll();
      } else {
        this.renderStep();
      }
    }

    // Общий таймер на весь опрос. По истечении — принудительная отправка
    // всего, что уже собрано (как showResultsScreen() при обнулении
    // remaining на сайте). Элемент #qwTotalTimerVal ищется заново на
    // каждом тике — он переживает re-render, т.к. включён в разметку
    // и renderStep(), и renderSurveyAll() (см. _totalTimerBadge()).
    _startTotalTimer(seconds) {
      let timeLeft = seconds;
      clearInterval(this._totalTimerInt);
      const update = () => {
        const el = this.container.querySelector('#qwTotalTimerVal');
        if (el) {
          const m = Math.floor(timeLeft / 60), s = timeLeft % 60;
          el.textContent = m + ':' + String(s).padStart(2, '0');
        }
      };
      update();
      this._totalTimerInt = setInterval(() => {
        timeLeft--;
        update();
        if (timeLeft <= 0) {
          clearInterval(this._totalTimerInt);
          clearInterval(this._qTimerInt);
          if (!this.submitted) this.submit();
        }
      }, 1000);
    }

    _totalTimerBadge() {
      if (!(this.poll.timer_total > 0) || this.poll.type === 'tierlist') return null;
      return h('div', { className: 'qw-total-timer-wrap' },
        h('div', { className: 'qw-timer-wrap' }, '⏳ ', h('span', { id: 'qwTotalTimerVal' }, ''))
      );
    }

    renderStep() {
      const poll  = this.poll;
      const q     = poll.questions[this.step];
      const total = poll.questions.length;
      const pct   = Math.round((this.step / total) * 100);

      const header = h('div', {},
        poll.cover_url ? h('img', { className: 'qw-cover', src: poll.cover_url, alt: '' }) : null,
        h('div', { className: 'qw-header' },
          h('h2', {}, poll.title),
          poll.description ? h('p', {}, poll.description) : null
        )
      );

      const isLastStep = this.step === total - 1;
      // pres_show_progress / pres_show_q_num — раньше показывались всегда,
      // независимо от настройки в create_quiz.html. pres_allow_back — раньше
      // кнопка "Назад" была всегда доступна с шага 1, даже если владелец
      // опроса явно её выключил (например для честного прохождения теста).
      const showProgress = poll.pres_show_progress !== false;
      const showQNum     = poll.pres_show_q_num !== false;
      const allowBack     = poll.pres_allow_back === true;

      const timerEl = h('span', { className: 'qw-timer-val' }, '');
      const timerWrap = poll.timer_q > 0
        ? h('div', { className: 'qw-timer-wrap', id: 'qwTimerWrap' }, '⏱️ ', timerEl)
        : null;

      const body = h('div', { className: 'qw-body' },
        this._totalTimerBadge(),
        timerWrap,
        showProgress ? h('div', { className: 'qw-progress-bar' },
          h('div', { className: 'qw-progress-fill', style: 'width:' + pct + '%' })
        ) : null,
        showQNum ? h('div', { className: 'qw-step-label' }, 'Вопрос ' + (this.step + 1) + ' из ' + total) : null,
        !INFO_TYPES.includes(q.type) ? h('div', { className: 'qw-question' }, q.text) : null,
        this._renderInput(q),
        // Капча показывается только на последнем шаге если включена в опросе
        isLastStep && poll.captcha ? this._renderCaptcha(poll.captcha) : null,
        h('div', { className: 'qw-actions' },
          ...[
            (this.step > 0 && allowBack)
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

      // timer_q — раньше не было в виджете вообще. По истечении времени —
      // как на сайте (startTimer() в poll.html) — принудительно переходим
      // дальше, даже если вопрос не отвечен (required-проверка обходится
      // только для этого конкретного авто-перехода, не для ручного клика).
      if (poll.timer_q > 0) {
        this._startQuestionTimer(q.id, isLastStep);
      }
    }

    // Таймер на текущий вопрос. По истечении — принудительный переход
    // дальше (или отправка, если это был последний вопрос), даже если
    // ответа нет — так же ведёт себя startTimer() на сайте.
    _startQuestionTimer(qid, isLastStep) {
      clearInterval(this._qTimerInt);
      let timeLeft = this.poll.timer_q;
      const el = this.container.querySelector('#qwTimerWrap .qw-timer-val');
      const wrap = this.container.querySelector('#qwTimerWrap');
      const update = () => {
        if (el) el.textContent = timeLeft + 'с';
        if (wrap) {
          wrap.classList.toggle('qw-timer-warn', timeLeft <= 10 && timeLeft > 5);
          wrap.classList.toggle('qw-timer-danger', timeLeft <= 5);
        }
      };
      update();
      this._qTimerInt = setInterval(() => {
        timeLeft--;
        update();
        if (timeLeft <= 0) {
          clearInterval(this._qTimerInt);
          this.next(true); // force=true — переходим/отправляем даже без ответа
        }
      }, 1000);
    }

    // ── Survey-режим: все вопросы одним списком, одна кнопка отправки ──────
    // Раньше этого режима не было вообще — survey-опросы через виджет
    // всегда шли по шагам как quiz/test/vote, что не соответствует
    // поведению самого сайта (renderSurveyAll() в poll.html).
    renderSurveyAll() {
      const poll = this.poll;

      const header = h('div', {},
        poll.cover_url ? h('img', { className: 'qw-cover', src: poll.cover_url, alt: '' }) : null,
        h('div', { className: 'qw-header' },
          h('h2', {}, poll.title),
          poll.description ? h('p', {}, poll.description) : null
        )
      );

      const blocks = poll.questions.map((q, i) => h('div', { className: 'qw-survey-block' },
        !INFO_TYPES.includes(q.type) ? h('div', { className: 'qw-survey-num' }, (i + 1) + ' / ' + poll.questions.length) : null,
        !INFO_TYPES.includes(q.type) ? h('div', { className: 'qw-question' }, q.text) : null,
        this._renderInput(q)
      ));

      const body = h('div', { className: 'qw-body' },
        this._totalTimerBadge(),
        ...blocks,
        poll.captcha ? this._renderCaptcha(poll.captcha) : null,
        h('div', { className: 'qw-actions' },
          h('button', { className: 'qw-btn qw-btn-primary', onClick: () => this.submitSurvey() }, '✓ Отправить')
        )
      );

      this.render(h('div', {}, header, body));
      this._nextBtn = this.container.querySelector('.qw-btn-primary');
    }

    // Валидация + отправка для survey-режима — в отличие от next() в
    // пошаговом режиме, здесь нужно проверить ВСЕ вопросы сразу, а не один.
    submitSurvey() {
      for (const q of this.poll.questions) {
        if (INFO_TYPES.includes(q.type) || UNSUPPORTED_TYPES.includes(q.type)) continue;
        const ans = this.answers[q.id];
        const isEmpty = !ans || (
          (!ans.option_ids || ans.option_ids.length === 0) &&
          (!ans.text_value || ans.text_value.trim() === '')
        );
        if (q.required && isEmpty) {
          alert('Пожалуйста, ответьте на все обязательные вопросы.');
          return;
        }
      }
      if (this.poll.captcha && !this._captchaToken) {
        if (this._captchaErrorEl) this._captchaErrorEl.classList.add('visible');
        return;
      }
      this.submit();
    }

    // ═══════════════════════════════════════════════════════════════════
    // Tier List — настоящий турнир на выбывание с картинками, как на сайте
    // (tlRender/tlPick/tlRenderResult в poll.html). Раньше для type=tierlist
    // виджет использовал упрощённый текстовый реордеринг без картинок —
    // теперь ходит в специальные /tierlist/start|match|result эндпоинты
    // публичного API (их тоже не было — добавлены вместе с этим фиксом).
    // ═══════════════════════════════════════════════════════════════════

    // Общий helper для вызова /tierlist/* — учитывает прокси-режим (backendUrl)
    // так же, как submit() для обычного /vote.
    async _tlCall(subpath, method, body) {
      const fullPath = '/polls/' + this.pollId + subpath;
      if (this.backendUrl) {
        // fullPath может содержать свой собственный "?" (например
        // .../tierlist/result?attempt_id=73) — раньше он клеился в
        // ?path=... без экранирования, из-за чего получалось два "?" в
        // одном URL: .../result?attempt_id=73?api_key=...
        // PHP в этом случае парсит второй "?api_key=..." как ЧАСТЬ
        // значения attempt_id, а не отдельный параметр — сервер получал
        // пустой api_key и отвечал 401 "API-ключ не передан". Экранируем
        // весь путь целиком через encodeURIComponent — PHP сам корректно
        // раскодирует $_GET['path'] обратно в исходную строку с "?" внутри.
        const proxyUrl = this.backendUrl + '?path=' + encodeURIComponent(fullPath);
        const res = await fetch(proxyUrl, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: body ? JSON.stringify(body) : undefined,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Ошибка Tier List');
        return data;
      }
      return apiFetch(fullPath, this.apiKey, {
        method,
        body: body ? JSON.stringify(body) : undefined,
      });
    }

    async tlStart() {
      this.render(h('div', { className: 'qw-loader' }, '⏳ Готовим карточки...'));
      try {
        const identity = await getIdentity();
        const data = await this._tlCall('/tierlist/start', 'POST', {
          voter_id:   identity.voterId,
          fp_id:      identity.fpId,
          ls_key:     identity.lsKey,
          cookie_key: identity.cookieKey,
          simple_fp:  identity.simpleFp,
        });
        this.tlAttemptId = data.attempt_id;
        this._tlRender(data);
      } catch (e) {
        this.render(this._error(e.message));
      }
    }

    _tlRender(data) {
      if (data.status === 'finished') { this._tlRenderResult(data, !!data.already_participated); return; }

      const poll = this.poll;
      const pct  = Math.min(100, Math.round((data.round - 1) / Math.max(1, data.total_rounds) * 100));
      const [a, b] = data.pair;

      const header = h('div', {},
        poll.cover_url ? h('img', { className: 'qw-cover', src: poll.cover_url, alt: '' }) : null,
        h('div', { className: 'qw-header' }, h('h2', {}, poll.title))
      );

      const body = h('div', { className: 'qw-body' },
        h('div', { className: 'qw-tl-topbar' },
          h('span', {}, '🏆 Раунд ' + data.round + ' из ~' + data.total_rounds),
          h('span', {}, data.remaining_count + ' в игре')
        ),
        h('div', { className: 'qw-progress-bar' },
          h('div', { className: 'qw-progress-fill', style: 'width:' + pct + '%' })
        ),
        h('div', { className: 'qw-tl-duel' },
          h('div', { className: 'qw-tl-card', onClick: () => this._tlPick(a.id) },
            h('div', { className: 'qw-tl-img-wrap' }, h('img', { src: a.image_url, alt: a.title || '' })),
            a.title ? h('div', { className: 'qw-tl-caption' }, a.title) : null
          ),
          h('div', { className: 'qw-tl-vs' }, 'VS'),
          h('div', { className: 'qw-tl-card', onClick: () => this._tlPick(b.id) },
            h('div', { className: 'qw-tl-img-wrap' }, h('img', { src: b.image_url, alt: b.title || '' })),
            b.title ? h('div', { className: 'qw-tl-caption' }, b.title) : null
          )
        )
      );

      this.render(h('div', {}, header, body));
    }

    async _tlPick(winnerId) {
      if (this._tlChoosing) return;
      this._tlChoosing = true;
      try {
        const data = await this._tlCall('/tierlist/match', 'POST', {
          attempt_id: this.tlAttemptId,
          winner_id:  winnerId,
        });
        this._tlChoosing = false;
        this._tlRender(data);
      } catch (e) {
        this._tlChoosing = false;
        alert('Ошибка сохранения ответа: ' + e.message);
      }
    }

    async _tlRenderResult(data, alreadyParticipated) {
      const poll = this.poll;
      let res;
      try {
        res = await this._tlCall('/tierlist/result?attempt_id=' + this.tlAttemptId, 'GET');
      } catch (e) {
        this.render(this._error('Не удалось загрузить результат'));
        return;
      }

      const results = (res.personal && res.personal.results) || [];

      const header = h('div', {},
        poll.cover_url ? h('img', { className: 'qw-cover', src: poll.cover_url, alt: '' }) : null,
        h('div', { className: 'qw-header' }, h('h2', {}, poll.title))
      );

      const rows = results.map(r => h('div', { className: 'qw-tl-result-row' },
        h('span', { className: 'qw-tl-rank' }, '#' + r.place),
        r.image_url ? h('img', { className: 'qw-tl-result-img', src: r.image_url, alt: '' }) : null,
        h('span', { className: 'qw-tl-result-title' }, r.title || '')
      ));

      const body = h('div', { className: 'qw-body' },
        h('div', { className: 'qw-thanks' },
          h('h3', {}, alreadyParticipated ? '👋 Вы уже участвовали!' : '🎉 Турнир завершён!'),
          h('p', {}, 'Личный рейтинг участника, от лучшего к худшему')
        ),
        ...rows
      );

      this.render(h('div', {}, header, body));
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

      // dropdown — как radio, но одиночный выбор через <select>. Backend
      // (vote.php) хранит его так же как radio — через option_ids: [id].
      if (q.type === 'dropdown') {
        const sel = h('select', { className: 'qw-select',
          onChange: (e) => {
            const val = parseInt(e.target.value, 10);
            this.answers[q.id] = val ? { option_ids: [val] } : { option_ids: [] };
          }
        },
          h('option', { value: '' }, '— Выберите вариант —'),
          ...q.options.map(opt => {
            const optEl = h('option', { value: opt.id }, opt.text);
            if ((saved.option_ids || []).includes(opt.id)) optEl.setAttribute('selected', '');
            return optEl;
          })
        );
        return sel;
      }

      if (q.type === 'text') {
        const ta = h('textarea', { className: 'qw-textarea', placeholder: 'Ваш ответ...' });
        ta.value = saved.text_value || '';
        ta.addEventListener('input', () => { this.answers[q.id] = { text_value: ta.value }; });
        return ta;
      }

      // text_line — короткий однострочный ответ (email, имя, число и т.п.)
      if (q.type === 'text_line') {
        const inp = h('input', { type: 'text', className: 'qw-input', placeholder: 'Ваш ответ...' });
        inp.value = saved.text_value || '';
        inp.addEventListener('input', () => { this.answers[q.id] = { text_value: inp.value }; });
        return inp;
      }

      if (q.type === 'date') {
        const inp = h('input', { type: 'date', className: 'qw-input' });
        inp.value = saved.text_value || '';
        inp.addEventListener('input', () => { this.answers[q.id] = { text_value: inp.value }; });
        return inp;
      }

      if (q.type === 'time') {
        const inp = h('input', { type: 'time', className: 'qw-input' });
        inp.value = saved.text_value || '';
        inp.addEventListener('input', () => { this.answers[q.id] = { text_value: inp.value }; });
        return inp;
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

      // ── Информационные слайды — ответа не требуют, только "Далее" ────────
      if (q.type === 'info_title') {
        // Заголовок уже выводится через .qw-question в renderStep(),
        // здесь можно добавить только доп. подпись, если она есть.
        this.answers[q.id] = { text_value: 'ack' }; // помечаем как "просмотрено"
        return q.image_url
          ? h('div', {}, h('img', { className: 'qw-info-image', src: q.image_url, alt: '' }))
          : h('div', {});
      }

      if (q.type === 'info_image') {
        this.answers[q.id] = { text_value: 'ack' };
        return q.image_url
          ? h('img', { className: 'qw-info-image', src: q.image_url, alt: q.text || '' })
          : h('div', { className: 'qw-info-note' }, 'Изображение не задано');
      }

      if (q.type === 'info_video') {
        this.answers[q.id] = { text_value: 'ack' };
        const embedUrl = _toEmbedVideoUrl(q.image_url);
        if (embedUrl) {
          return h('iframe', {
            className: 'qw-info-video', src: embedUrl,
            allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture',
            allowfullscreen: 'true',
          });
        }
        if (q.image_url) {
          return h('video', { className: 'qw-info-video', src: q.image_url, controls: 'true' });
        }
        return h('div', { className: 'qw-info-note' }, 'Видео не задано');
      }

      // tierlist больше не обрабатывается здесь — для type='tierlist' весь
      // опрос целиком идёт через отдельный дуэльный флоу (tlStart() →
      // _tlRender() → _tlRenderResult()), минуя renderStep()/renderSurveyAll()
      // и, соответственно, _renderInput() — см. _startRender(). Раньше тут
      // был текстовый реордеринг-фолбэк без картинок; теперь настоящие
      // дуэли с картинками через /tierlist/start|match|result.

      // Неподдерживаемые пока типы (сейчас — file). Не блокируем прохождение
      // опроса: помечаем вопрос как формально отвеченный пустым значением,
      // чтобы required-проверка в next() его пропустила.
      if (UNSUPPORTED_TYPES.includes(q.type)) {
        return h('div', { className: 'qw-unsupported' },
          '⚠️ Этот тип вопроса пока не поддерживается встраиваемым виджетом и будет пропущен.'
        );
      }

      return h('div', { className: 'qw-unsupported' }, '⚠️ Неизвестный тип вопроса — будет пропущен.');
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

    async next(force) {
      clearInterval(this._qTimerInt);

      const q   = this.poll.questions[this.step];
      const ans = this.answers[q.id];

      // Информационные слайды и неподдерживаемые типы никогда не блокируют
      // переход дальше — на них физически нельзя дать ответ через виджет.
      // force=true — вопрос истёк по таймеру (timer_q), пропускаем
      // required-проверку так же, как делает startTimer() на сайте.
      const skipValidation = force || INFO_TYPES.includes(q.type) || UNSUPPORTED_TYPES.includes(q.type);

      const isEmpty = !skipValidation && (!ans || (
        (!ans.option_ids || ans.option_ids.length === 0) &&
        (!ans.text_value || ans.text_value.trim() === '')
      ));
      if (!skipValidation && q.required && isEmpty) {
        alert('Пожалуйста, ответьте на вопрос перед тем как продолжить.');
        return;
      }
      if (this.step === this.poll.questions.length - 1) {
        // Последний шаг — проверяем капчу если включена. Капчу НЕ пропускаем
        // даже при force=true (истёкший таймер) — это защита от ботов, а не
        // проверка заполненности, обходить её принудительным таймаутом
        // небезопасно, да и сервер всё равно отклонит отправку без токена.
        if (this.poll.captcha && !this._captchaToken) {
          if (this._captchaErrorEl) this._captchaErrorEl.classList.add('visible');
          return;
        }
        this.submit();
      } else {
        // Прогрессивное сохранение — раньше этого не было вообще, всё
        // копилось только в памяти браузера до самого конца. Если вкладку
        // закрывали на середине, весь прогресс терялся. Ошибку сохранения
        // не считаем блокирующей — не хотим ронять UX из-за временного
        // сбоя сети, финальная отправка на последнем шаге всё равно
        // пришлёт полный набор ответов ещё раз (upsert на сервере).
        if (!INFO_TYPES.includes(q.type) && !UNSUPPORTED_TYPES.includes(q.type) && ans) {
          try { await this._saveProgress(q.id, ans); } catch (_) {}
        }
        this.step++;
        this.renderStep();
      }
    }

    prev() {
      clearInterval(this._qTimerInt);
      if (this.step > 0) { this.step--; this.renderStep(); }
    }


    // Сохраняет ОДИН ответ на сервере без капчи и без завершающей логики
    // (final:false) — используется при переходе между вопросами в
    // step-режиме, чтобы прогресс не терялся при закрытии вкладки.
    // Раньше этого метода не было вообще.
    async _saveProgress(qid, ans) {
      const identity = this._identity || await getIdentity();
      const payload = {
        voter_id:   identity.voterId,
        fp_id:      identity.fpId,
        ls_key:     identity.lsKey,
        cookie_key: identity.cookieKey,
        simple_fp:  identity.simpleFp,
        final:      false,
        answers:    [Object.assign({ question_id: qid }, ans)],
      };
      if (this.backendUrl) {
        const proxyUrl = this.backendUrl + '?path=' + encodeURIComponent('/polls/' + this.pollId + '/vote');
        const res = await fetch(proxyUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Ошибка сохранения прогресса');
        return data;
      }
      return apiFetch('/polls/' + this.pollId + '/vote', this.apiKey, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
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

      // Информационные и неподдерживаемые слайды не шлём как ответы —
      // backend всё равно ждёт вопрос в answers только если есть что сохранить.
      const answers = Object.entries(this.answers)
        .filter(([qid]) => {
          const q = this.poll.questions.find(qq => String(qq.id) === String(qid));
          return q && !INFO_TYPES.includes(q.type) && !UNSUPPORTED_TYPES.includes(q.type);
        })
        .map(([qid, ans]) => Object.assign({ question_id: parseInt(qid) }, ans));

      let voteResponse = null;
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
              restart:       this._isRestart || undefined,
              answers,
            }),
          });
          const proxyData = await proxyRes.json();
          if (!proxyRes.ok) throw new Error(proxyData.error || 'Ошибка прокси');
          voteResponse = proxyData;
        } else {
          // Голосуем напрямую через Worker с публичным ключом
          voteResponse = await apiFetch('/polls/' + this.pollId + '/vote', this.apiKey, {
            method: 'POST',
            body: JSON.stringify({
              voter_id:      identity.voterId,
              fp_id:         identity.fpId,
              ls_key:        identity.lsKey,
              cookie_key:    identity.cookieKey,
              simple_fp:     identity.simpleFp,
              captcha_token: this._captchaToken || undefined,
              restart:       this._isRestart || undefined,
              answers,
            }),
          });
        }
        this._isRestart = false;
        clearInterval(this._qTimerInt);
        clearInterval(this._totalTimerInt);
        this.renderThanks(false, voteResponse);
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

    // Считает счёт квиза/теста, сравнивая ответы пользователя (this.answers)
    // с is_correct из results (приходит от vote.php только ПОСЛЕ отправки —
    // раньше этих данных не было в контракте вообще, см. api/pub/polls/vote.php).
    _computeScore(results) {
      const correctByOption = {};
      results.forEach(o => { correctByOption[o.id] = !!(+o.is_correct); });

      let correctCount = 0, gradableCount = 0;
      const review = [];

      this.poll.questions.forEach(q => {
        if (q.type !== 'radio' && q.type !== 'checkbox') return; // оценка только для choice-вопросов
        const ans = this.answers[q.id];
        const chosenIds = (ans && ans.option_ids) || [];
        const correctIds = q.options.filter(o => correctByOption[o.id]).map(o => o.id);
        if (correctIds.length === 0) return; // вопрос без правильного варианта — не оценивается
        gradableCount++;
        const isRight = chosenIds.length === correctIds.length &&
          chosenIds.every(id => correctIds.includes(id));
        if (isRight) correctCount++;
        review.push({
          text: q.text,
          isRight,
          chosenText: q.options.filter(o => chosenIds.includes(o.id)).map(o => o.text).join(', ') || '—',
          correctText: q.options.filter(o => correctIds.includes(o.id)).map(o => o.text).join(', '),
        });
      });

      return { correctCount, gradableCount, review };
    }

    async renderThanks(alreadyVoted, voteResponse) {
      alreadyVoted = alreadyVoted || false;
      const poll   = this.poll;
      const header = h('div', {},
        poll.cover_url ? h('img', { className: 'qw-cover', src: poll.cover_url, alt: '' }) : null,
        h('div', { className: 'qw-header' }, h('h2', {}, poll.title))
      );

      // confirm_text — раньше игнорировался, виджет всегда писал жёстко
      // зашитый текст независимо от того, что владелец опроса указал
      // в настройках презентации на сайте.
      const defaultText = alreadyVoted ? 'Результаты вашего голосования уже учтены.' : 'Ваш голос учтён.';
      const thanksText  = (!alreadyVoted && poll.confirm_text) ? poll.confirm_text : defaultText;

      // Разбор квиза/теста — только если сервер прислал results (см. submit())
      // и владелец опроса разрешил показывать правильные ответы.
      let scoreEl = null;
      const isGradable = (poll.type === 'quiz' || poll.type === 'test') && poll.show_correct;
      if (isGradable && voteResponse && Array.isArray(voteResponse.results)) {
        const { correctCount, gradableCount, review } = this._computeScore(voteResponse.results);
        if (gradableCount > 0) {
          scoreEl = h('div', {},
            h('div', { className: 'qw-score-box' },
              h('div', { className: 'qw-score-num' }, correctCount + ' / ' + gradableCount),
              h('div', { style: 'font-size:12px;color:#6b7280;margin-top:2px;' }, 'правильных ответов')
            ),
            poll.show_wrong ? h('div', {}, ...review.map(r => h('div', { className: 'qw-review-row' },
              h('span', { className: 'qw-review-ico' }, r.isRight ? '✅' : '❌'),
              h('span', {},
                h('div', { className: r.isRight ? 'qw-review-correct' : 'qw-review-wrong' }, r.chosenText),
                (!r.isRight && r.correctText) ? h('div', { style: 'font-size:12px;color:#6b7280;' }, 'Правильно: ' + r.correctText) : null
              )
            ))) : null
          );
        }
      }

      let resultsEl = null;
      if (poll.show_results && !scoreEl) {
        try {
          const r = await apiFetch('/polls/' + this.pollId + '/results', this.apiKey);
          resultsEl = this._renderResults(r);
        } catch (_) {}
      }

      // pres_show_refill — теперь работает так же, как на сайте: через
      // restart:true в теле /vote, который api/pub/polls/vote.php обходит
      // one_per_user ТОЛЬКО если у опроса реально включён pres_show_refill
      // (honesty-check на бэкенде, как в api/polls/answer.php). Раньше
      // кнопка была доступна только при one_per_user=0 — то есть де-факто
      // не работала именно там, где она нужнее всего (опрос "один раз на
      // человека", но с явным разрешением пройти ещё раз).
      const refillBtn = (poll.pres_show_refill && !alreadyVoted)
        ? h('button', { className: 'qw-refill-btn', onClick: () => this._restart() },
            poll.refill_btn_text || 'Пройти ещё раз')
        : null;

      const thanks = h('div', { className: 'qw-body' },
        h('div', { className: 'qw-thanks' },
          h('h3', {}, alreadyVoted ? '👋 Вы уже голосовали!' : '🎉 Спасибо!'),
          h('p', {}, thanksText)
        ),
        scoreEl || resultsEl || '',
        refillBtn
      );

      this.render(h('div', {}, header, thanks));
    }

    // Сбрасывает локальное состояние и запускает опрос заново с начала.
    // this._isRestart=true заставит submit() передать restart:true — сервер
    // (api/pub/polls/vote.php) обойдёт one_per_user и создаст новую попытку,
    // но только если владелец опроса разрешил pres_show_refill (иначе
    // сервер restart проигнорирует — см. комментарий там).
    _restart() {
      this.step = 0;
      this.answers = {};
      this.submitted = false;
      this._captchaToken = null;
      this._isRestart = true;
      clearInterval(this._qTimerInt);
      clearInterval(this._totalTimerInt);
      this._totalTimerStarted = false;
      this._startRender();
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
