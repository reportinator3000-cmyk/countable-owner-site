// THE OWNER PAGE: the owner's list of open items and the follow-ups to chase,
// changed from his phone (owner, Oct 11 2026).
//
// THE PAGE IS A WINDOW, NOT A GATE. Everything here is public source on a
// public site. It holds no secret: only the project's address and its
// publishable key, the same two values every copy of the app carries. What
// it may read and change is decided by the database, which asks who is
// signed in (the JWT) and lets only the owner's account through
// (owner_list_guard, migration 20261011180000_owner_list).
//
// SIGNING IN is the app's own sign-in: a code texted to the mobile number
// (phone-signin-start, phone-signin-verify with create:false, so this page
// can never make an account). The number is held in memory for those two
// calls and is never stored or logged; nothing on this page logs at all.
//
// A NEW SIGN-IN NEEDS HIS PHONE AND HIS EMAIL (owner, Oct 12 2026: "lets have
// two factor authentification if a new device is being used to log in or if
// password is reset"). The texted code makes a session; the database then
// refuses that session everything until a second code, emailed to him, has
// been typed here (owner-second-step). It is the database that refuses, not
// this page: a session made any other way (a password, an emailed link) is
// refused the same, and cannot ask for the emailed code at all, because the
// function will only send one to a sign-in that began with the texted code
// on this very device.
//
// A DEVICE THE PAGE RECOGNIZES STILL ASKS FOR THE TEXTED CODE (owner, the
// same evening: "for devices it recognizes, lets always have the iphone
// texted code as verification"). A device that has once passed both codes is
// remembered by the database, and a sign-in on it needs the texted code
// alone: no email. And no sign-in lasts: after SIGNIN_HOURS the database
// stops answering it and this page goes back to the sign-in. (Not at every
// open: texted codes are capped at six a day per number, shared with the
// app, so a code at every open would lock him out of both.)
//
// NO LIBRARY IS LOADED. A script from another site would run with the owner's
// session, so the few calls this page makes are written out below and the
// page's own policy (the meta tag in index.html) refuses any script, style or
// request that is not the page's own or the project's.
//
// NOTHING TYPED IS LOST. A sheet closes only after the database has answered
// yes. What is in a sheet is kept as a draft: through a question laid over it
// ("Delete this item?" then Cancel), through a save that could not get an
// answer, and through being signed out (it comes back after signing in).
//
// ACTIONS (owner, Oct 12 2026). Besides the list, the page can: mark an alarm
// seen with a note, ask for the health check now, record a top-up, set a
// spend tripwire, record yes / no / later on an item, ask to be told on a
// follow-up's day. Each is one database function that asks the same guard;
// none sends a text or moves money. (Handing a job to Claude from here was
// built and taken out on his word the same day: a page that can hand work to
// a session with a shell is a road into the Mac.)
//
// THE PEOPLE (owner, Oct 13 2026: "i dont see any information about 'People'
// or the copy invite link like your mock up"). One more read
// (owner_people_read): each account's name, plan, when it last opened the
// app, this week's planned and done days, and how many texts went each way.
// COUNTS ONLY: nobody's messages, numbers or addresses are read or shown.
// The read comes after the list and never in its way. The invite link comes
// with it from the database; it is not written in this public file.
//
// TWO HANDS, ONE ROW. A session on the Mac can change an item while it is open
// here. A save says when this page last saw the row; if the row has changed,
// the database refuses, the page reads the row again, keeps what was typed
// here, brings in what changed there, and asks for the save again. A new row
// is sent with an id made here, so a second try can never add it twice.
(function () {
  'use strict';

  // Never inside another site's frame: a frame could dress this page up.
  if (window.top !== window.self) { document.documentElement.hidden = true; return; }

  var API = 'https://kqvcpcxcmgafbhjdjnak.supabase.co';
  var KEY = 'sb_publishable_VQKUo6VW3ebwj8DrFWR2hg_rt8EIVMy';
  var STORE = 'countable-owner-session-v1';
  var DEVICE = 'countable-owner-device-v1';
  var OPEN = 'countable-owner-open-v1';
  // A sign-in is trusted this long, then a new texted code is needed. The
  // database decides (owner_signin_hours); this is only for the words.
  var SIGNIN_HOURS = 12;

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var fromIso = function (iso) { return new Date(String(iso).slice(0, 10) + 'T12:00:00'); };
  var day = function (d) { return MON[d.getMonth()] + ' ' + d.getDate(); };
  var daysUntil = function (iso) {
    var a = fromIso(iso), n = new Date();
    return Math.round((Date.UTC(a.getFullYear(), a.getMonth(), a.getDate()) - Date.UTC(n.getFullYear(), n.getMonth(), n.getDate())) / 86400000);
  };
  var isoPlus = function (days) {
    var d = new Date(Date.now() + days * 86400000), m = d.getMonth() + 1, dd = d.getDate();
    return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (dd < 10 ? '0' : '') + dd;
  };
  var clock = function (d) {
    var h = d.getHours(), m = d.getMinutes();
    return ((h % 12) || 12) + ':' + (m < 10 ? '0' : '') + m + ' ' + (h < 12 ? 'AM' : 'PM');
  };
  var usd = function (n) { return '$' + (Math.round(Number(n) * 100) / 100).toFixed(2); };
  // "about 3 days", as the watch's own emails say it.
  var daysPhrase = function (d) {
    if (d === null || d === undefined || !isFinite(d)) return '';
    if (d < 1) return 'less than a day';
    if (d < 1.5) return 'about a day';
    if (d < 14) return 'about ' + Math.round(d) + ' days';
    return 'about ' + Math.round(d / 7) + ' weeks';
  };
  var when = function (iso) {
    var d = new Date(iso), n = new Date();
    var same = d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
    return (same ? 'Today' : day(d)) + ' ' + clock(d);
  };
  var reduced = function () { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); };
  var randomHex = function (n) {
    var bytes = new Uint8Array(n);
    (window.crypto || window.msCrypto).getRandomValues(bytes);
    return Array.prototype.map.call(bytes, function (b) { return (b < 16 ? '0' : '') + b.toString(16); });
  };
  // An id for a row this page is about to add (a version-4 UUID).
  var newId = function () {
    var h = randomHex(16);
    h[6] = '4' + h[6].charAt(1);
    h[8] = '89ab'.charAt(parseInt(h[8].charAt(0), 16) % 4) + h[8].charAt(1);
    return h.slice(0, 4).join('') + '-' + h.slice(4, 6).join('') + '-' + h.slice(6, 8).join('') + '-' + h.slice(8, 10).join('') + '-' + h.slice(10).join('');
  };

  /* ---------- the session ---------- */
  var session = null;
  var gen = 0;   // goes up at every sign-out; an answer from before it is ignored
  function readStore(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
  function writeStore(key, value) {
    try { if (value == null) localStorage.removeItem(key); else localStorage.setItem(key, value); } catch (e) { /* kept in memory only */ }
  }
  function storedSession() {
    try { var raw = readStore(STORE); var s = raw ? JSON.parse(raw) : null; return s && s.access_token && s.refresh_token ? s : null; }
    catch (e) { return null; }
  }
  function keepSession(s) {
    session = s && s.access_token && s.refresh_token ? {
      access_token: s.access_token,
      refresh_token: s.refresh_token,
      expires_at: s.expires_at || Math.floor(Date.now() / 1000) + (s.expires_in || 3600)
    } : null;
    writeStore(STORE, session ? JSON.stringify(session) : null);
  }
  // One id for this browser. The texted code and the emailed code must come
  // from the same one, so it is also kept in memory: where storage is refused
  // it still stays the same for as long as the page is open.
  var device = null;
  function deviceId() {
    if (device) return device;
    var id = readStore(DEVICE);
    if (!(id && id.length >= 16)) { id = randomHex(16).join(''); writeStore(DEVICE, id); }
    device = id;
    return id;
  }

  /* ---------- the four kinds of call ---------- */
  // Every answer comes back as { ok, status, data }. status 0 = no answer came
  // back at all (no connection, or one that dropped part-way). It never throws.
  function post(path, body, token) {
    return fetch(API + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': KEY, 'Authorization': 'Bearer ' + (token || KEY) },
      body: JSON.stringify(body || {}),
      cache: 'no-store',
      credentials: 'omit',
      referrerPolicy: 'no-referrer'
    }).then(function (res) {
      return res.text().then(function (t) {
        var data = null;
        try { data = t ? JSON.parse(t) : null; } catch (e) { data = null; }
        return { ok: res.ok, status: res.status, data: data };
      });
    }).catch(function () { return { ok: false, status: 0, data: null }; });
  }
  // A new access token from the refresh token. true = the session is good;
  // false = it is over (signed out); null = could not tell (no answer, or the
  // service is busy), so the session is kept.
  var renewing = null;
  function renew() {
    if (renewing) return renewing;
    if (!session) return Promise.resolve(false);
    // Another tab may have renewed already; a refresh token is good once.
    var other = storedSession();
    if (other && other.refresh_token !== session.refresh_token) {
      session = other;
      if (session.expires_at - 60 > Date.now() / 1000) return Promise.resolve(true);
    }
    var mine = gen;
    renewing = post('/auth/v1/token?grant_type=refresh_token', { refresh_token: session.refresh_token }).then(function (r) {
      renewing = null;
      if (mine !== gen) return false;          // signed out while this was in the air: do not bring the session back
      if (r.ok && r.data && r.data.access_token) { keepSession(r.data); return true; }
      if (r.status === 400 || r.status === 401 || r.status === 403) { keepSession(null); return false; }
      return null;
    });
    return renewing;
  }
  // A call as the signed-in account, with a fresh token when the old one is
  // about to run out.
  function authed(path, body) {
    if (!session) return Promise.resolve({ ok: false, status: 401, data: null });
    var go = function () {
      if (!session) return Promise.resolve({ ok: false, status: 401, data: null });
      return post(path, body || {}, session.access_token);
    };
    var soon = session.expires_at - 60 < Date.now() / 1000;
    return (soon ? renew() : Promise.resolve(true)).then(function (fresh) {
      if (fresh === false) return { ok: false, status: 401, data: null };
      return go().then(function (r) {
        if (r.status !== 401) return r;
        return renew().then(function (again) { return again ? go() : { ok: false, status: again === false ? 401 : 0, data: null }; });
      });
    });
  }
  // One of the list's database functions.
  function rpc(name, args) { return authed('/rest/v1/rpc/' + name, args); }
  // The second step: 'start' emails the code, 'verify' checks it.
  function second(action, code) { return authed('/functions/v1/owner-second-step', { action: action, code: code || null, device: deviceId() }); }
  var NOT_OWNER = function (r) { return r.status === 403 || !!(r.data && r.data.code === '42501'); };
  // The database's own refusal of a sign-in that has not passed the second step.
  var SECOND = function (r) { return r.status === 428 || !!(r.data && r.data.code === 'PT428'); };
  // The row changed since this page read it (PT409), or the id is already taken (23505).
  var CHANGED = function (r) { return r.status === 409 || !!(r.data && (r.data.code === 'PT409' || r.data.code === '23505')); };
  function why(r, typed) {
    if (r.status === 0) return typed ? 'No answer came back. Your text is still here: tap Save again.' : 'No answer came back. Check the list, then try again.';
    if (r.status === 401) return 'You are signed out. Sign in again.';
    if (NOT_OWNER(r)) return 'This account is not the owner.';
    // 22023 is the list's own refusal, written as a sentence for this page.
    if (r.data && r.data.code === '22023' && r.data.message) return String(r.data.message);
    return typed ? 'That did not go through. Your text is still here.' : 'That did not go through. Nothing was changed.';
  }

  /* ---------- what the page knows ---------- */
  var S = {
    stage: 'opening',          // opening | signin | code | second | list | notowner | offline
    phone: '',                 // memory only, for the two sign-in calls
    note: '', noteKind: '',
    busy: false,
    list: null, asOf: null,
    pending: null,             // a sheet with typing in it, kept across being signed out
    sec: {}, fopen: {}, showDone: false, showGone: false, showSeen: false,
    asked: {},                 // the id of a top-up still in the air, so a second tap counts once
    sending: false,            // the database is being asked about this sign-in (and, on a new device, to email the code)
    codeSent: false,           // a code was emailed for this sign-in: show the box to type it in
    people: null               // the people and the invite link, read after the list (null = not read yet)
  };
  try { S.sec = JSON.parse(readStore(OPEN) || '{}') || {}; } catch (e) { S.sec = {}; }
  var stack = [];

  /* ---------- sign-in ---------- */
  function viewSignIn() {
    var note = S.note ? '<p class="msg-line ' + esc(S.noteKind) + '" role="alert">' + esc(S.note) + '</p>' : '';
    if (S.stage === 'code') {
      return '<section class="card"><h1 class="card-title">Enter the code</h1>' +
        '<p class="fine center">Six digits, texted to your number. It is good for ten minutes.</p>' +
        '<label class="field" for="code"><span class="micro muted">The code</span>' +
        '<input class="well code" id="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="000000"></label>' + note +
        '<button class="btn amber wide" data-act="verify"' + (S.busy ? ' disabled' : '') + '>' + (S.busy ? 'Signing in' : 'Sign in') + '</button>' +
        '<button class="link" data-act="again">Use a different number</button></section>';
    }
    return '<section class="card"><h1 class="card-title">Owner sign-in</h1>' +
      '<p class="fine center">This page is for the owner of CountAble. Sign in with your mobile number, the same way as the app.</p>' +
      '<label class="field" for="phone"><span class="micro muted">Your mobile number</span>' +
      '<input class="well" id="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="(555) 555-0100" value="' + esc(S.phone) + '"></label>' + note +
      '<button class="btn amber wide" data-act="start"' + (S.busy ? ' disabled' : '') + '>' + (S.busy ? 'Texting' : 'Text me a code') + '</button></section>';
  }
  function viewSecond() {
    var note = S.note ? '<p class="msg-line ' + esc(S.noteKind) + '" role="alert">' + esc(S.note) + '</p>' : '';
    var out = '<button class="link" data-act="signoutgo">Sign out</button></section>';
    // The database is being asked about this device. On one it has seen
    // before, the texted code was enough: the list opens and nothing is typed.
    if (!S.codeSent && S.sending) {
      return '<section class="card"><h1 class="card-title">One moment</h1><p class="fine center">Checking this device.</p>' + out;
    }
    // Nothing was sent (the database refused, or there was no answer).
    if (!S.codeSent) {
      return '<section class="card"><h1 class="card-title">One more step</h1>' + note +
        '<button class="btn wide" data-act="secondagain">Try again</button>' + out;
    }
    return '<section class="card"><h1 class="card-title">One more step</h1>' +
      '<p class="fine center">This device is new here, so it needs your email as well as your phone. A six-digit code was sent to your email address. It is good for ten minutes. After this, this device needs only the texted code.</p>' +
      '<label class="field" for="scode"><span class="micro muted">The code from the email</span>' +
      '<input class="well code" id="scode" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="000000"></label>' + note +
      '<button class="btn amber wide" data-act="secondgo"' + (S.busy ? ' disabled' : '') + '>' + (S.busy ? 'Checking' : 'Open the page') + '</button>' +
      '<button class="link" data-act="secondagain"' + (S.sending ? ' disabled' : '') + '>' + (S.sending ? 'Sending' : 'Send it again') + '</button>' + out;
  }
  function say(text, kind) { S.note = text || ''; S.noteKind = kind || ''; }
  // What the second step said, in his words.
  var SECOND_WORDS = {
    no_phone_proof: 'This sign-in cannot be finished. Sign out, then sign in again with your mobile number on this device.',
    too_many: 'Too many codes were asked for. Wait an hour, then try again.',
    email_failed: 'The email could not be sent. Tap Send it again in a minute.',
    bad_code: 'That code is not right. Check the newest email.',
    code_expired: 'That code has run out. Tap Send it again.',
    no_active_code: 'That code has run out. Tap Send it again.',
    too_many_tries: 'Too many tries on that code. Tap Send it again.'
  };
  function secondSays(r) {
    if (r.status === 0) return 'No connection. Try again.';
    return SECOND_WORDS[r.data && r.data.error] || 'That did not work. Try again in a moment.';
  }
  // This sign-in's time is up (or its trust was ended somewhere else). The
  // page goes back to the sign-in; typing in an open sheet is kept, as it is
  // through any sign-out it did not ask for.
  var ENDED = function (r) { return !!(r.data && r.data.error === 'signin_ended'); };
  function ended() {
    var token = session && session.access_token;
    signedOut('This page asks for a new texted code every ' + SIGNIN_HOURS + ' hours. Sign in again.');
    if (token) post('/auth/v1/logout?scope=local', {}, token);
  }
  // Ask the database about this sign-in. On a device it has seen before the
  // answer is "trusted" and the list opens. On a new one a code is emailed.
  // Asked once when the step appears, and again only when he taps a button.
  function secondStart() {
    if (S.sending) return;
    S.sending = true; drawPage();
    var mine = gen;
    second('start').then(function (r) {
      S.sending = false;
      if (mine !== gen) return;
      if (ENDED(r)) { ended(); return; }
      if (r.status === 401) { signedOut('You are signed out. Sign in again.'); return; }
      if (r.status === 403) { S.stage = 'notowner'; drawPage(); return; }
      if (r.ok && r.data && r.data.trusted) { S.stage = 'opening'; say(''); drawPage(); load(); return; }
      if (r.ok && r.data && r.data.ok) { S.codeSent = true; say('The code was sent. Check your email.', ''); }
      else say(secondSays(r), 'warn');
      if (S.stage === 'second') drawPage();
    });
  }
  // The database refused this sign-in until the second step is done. Typing
  // in an open sheet is kept by whoever called this (S.pending).
  function needSecond() {
    var first = S.stage !== 'second';
    S.list = null; S.people = null; S.stage = 'second'; S.busy = false;
    stack.length = 0; drawSheet();
    if (first) { S.codeSent = false; say(''); drawPage(); secondStart(); } else drawPage();
  }
  // The session is over. Anything being typed is kept and comes back after signing in.
  function signedOut(text) {
    keepSession(null); S.list = null; S.people = null; S.stage = 'signin'; S.busy = false;
    say(text || 'You are signed out. Sign in again.', 'warn');
    stack.length = 0; drawSheet(); drawPage();
  }

  /* ---------- the list ---------- */
  function dueChip(iso) {
    var d = daysUntil(iso);
    if (d < 0) return '<span class="chip bad num">Overdue ' + (-d) + ' d</span>';
    if (d === 0) return '<span class="chip bad">Due today</span>';
    return '<span class="chip num' + (d <= 2 ? ' warn' : '') + '">' + day(fromIso(iso)) + ' · ' + d + ' d</span>';
  }
  // What each alarm is, in the words of the email that announced it.
  var ALARMS = {
    silence: 'A customer\u2019s text was answered with silence',
    credits: 'AI credits ran out: every AI feature was down',
    ai_balance: 'The AI balance is low',
    weekly_review: 'A weekly review used up its retries and never ran',
    delivery: 'Texts are not reaching phones',
    report: 'The twice-daily report is not landing',
    spend_tripwire: 'Today\u2019s AI spend passed your tripwire'
  };
  function alarmTitle(a) {
    if (a.condition === 'followup_due') {
      var all = (S.list.followups || []).concat(S.list.followups_done || []);
      var f = all.filter(function (x) { return 'F' + x.ref_no === a.ref; })[0];
      return 'To chase: ' + (f ? f.title : 'a follow-up was due');
    }
    return ALARMS[a.condition] || 'An alarm (' + text(a.condition) + ')';
  }
  // An alarm whose email failed is the one he was never told about: say so.
  function alarmLine(a) { return (a.unsent ? 'Its email did not go out: ' : '') + alarmTitle(a); }
  function viewToday() {
    var L = S.list, alarms = L.alarms || [];
    var fresh = alarms.filter(function (a) { return !a.seen_at; }), seen = alarms.filter(function (a) { return a.seen_at; });
    var rows = fresh.map(function (a) {
      return '<div class="row"><span class="grow"><b>' + esc(alarmLine(a)) + '</b><small>' + esc(when(a.at)) + '</small></span>' +
        '<button class="btn small amber" data-act="seen" data-id="' + esc(a.id) + '">Seen</button></div>';
    }).join('');
    var older = '';
    if (seen.length) {
      older = '<button class="link" data-act="showseen">' + (S.showSeen ? 'Hide seen' : 'Seen · ' + seen.length) + '</button>';
      if (S.showSeen) older += '<div class="list">' + seen.map(function (a) {
        return '<div class="row"><span class="grow"><b>' + esc(alarmLine(a)) + '</b><small>' + esc(when(a.at)) + (a.note ? ' · ' + esc(a.note) : '') + '</small></span></div>';
      }).join('') + '</div>';
    }
    return '<section class="card' + (fresh.length ? ' verdict' : '') + '"><h2 class="card-title">Today</h2>' +
      (fresh.length
        ? '<p class="stat">' + fresh.length + (fresh.length === 1 ? ' alarm to look at' : ' alarms to look at') + '</p><div class="list">' + rows + '</div>'
        : '<p class="stat calm">No new alarm</p><p class="fine center">Nothing new is waiting for you here. The watch emails each kind of problem once a day, so a second one of the same kind today does not show again: read the email too.</p>') +
      '<button class="btn wide" data-act="check">Run the health check</button>' +
      (L.checked_at ? '<p class="fine center">Last asked ' + esc(when(L.checked_at)) + '.</p>' : '') + older + '</section>';
  }
  function viewMoney() {
    var m = S.list.money || {};
    var body;
    if (m.recorded_usd === null || m.recorded_usd === undefined) {
      body = '<p class="stat calm">No balance recorded</p><p class="fine center">Tell the page what the AI billing page shows, and it will estimate how long it lasts.</p>';
    } else {
      var left = Math.max(0, Number(m.remaining_usd));
      var pace = daysPhrase(m.days_left);
      body = '<p class="stat' + (m.low ? '' : ' calm') + '">' + (left <= 0 ? 'Empty' : (pace || usd(left) + ' left')) + '</p>' +
        '<div class="list">' +
          '<div class="kv"><span>Left, by estimate</span><b>about ' + usd(left) + '</b></div>' +
          '<div class="kv"><span>Pace, last 7 days</span><b>' + usd(m.burn_per_day_usd || 0) + ' a day</b></div>' +
          '<div class="kv"><span>Recorded</span><b>' + usd(m.recorded_usd) + ' · ' + esc(day(new Date(m.as_of))) + '</b></div>' +
        '</div><p class="fine">The amount you recorded, minus what the app has priced since. It is not read from the provider, so check the real number when it matters.</p>';
    }
    var trip = m.tripwire_usd === null || m.tripwire_usd === undefined
      ? '<div class="kv"><span>Tripwire</span><b>off</b></div>'
      : '<div class="kv"><span>Tripwire</span><b' + (m.tripwire_passed ? ' class="hot"' : '') + '>' + usd(m.tripwire_usd) + ' a day' + (m.tripwire_passed ? ' · passed' : '') + '</b></div>';
    return '<section class="card"><h2 class="card-title">AI balance</h2>' + body +
      '<div class="list"><div class="kv"><span>Spent today</span><b>' + usd(m.today_usd || 0) + '</b></div>' + trip + '</div>' +
      '<div class="pair"><button class="btn amber" data-act="topup">I topped up</button><button class="btn" data-act="tripwire">Tripwire</button></div>' +
      '<button class="link" data-act="balance">The billing page says a different number</button></section>';
  }

  /* ---------- the people ---------- */
  // Whole calendar days from one day to another (both are the database's
  // Eastern dates, so "yesterday" means the same thing here and there).
  var dayNum = function (iso) { var d = fromIso(iso); return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000); };
  function daysBetween(fromDay, toDay) { return dayNum(toDay) - dayNum(fromDay); }
  function agoWords(n) { return n <= 0 ? 'today' : n === 1 ? 'yesterday' : n + ' days ago'; }
  // HOW IT IS GOING, from what the tables say and nothing else. The first rule
  // that fits wins:
  //   on hold    the app has stopped texting them (a carrier refused a text)
  //   new        not set up yet, or joined in the last 7 days
  //   quiet      has not opened the app for 7 days or more (or ever)
  //   on track   every planned day of this week is done
  //   slipping   under half of this week's planned days done AND away 3 days or more
  //   steady     everyone else
  var ORDER = ['blocked', 'slipping', 'quiet', 'new', 'steady', 'thriving'];
  var STATUS_WORDS = { blocked: 'On hold', slipping: 'Slipping', quiet: 'Quiet', new: 'New', steady: 'Steady', thriving: 'On track' };
  function personStatus(p, today) {
    var joined = daysBetween(text(p.joined_at).slice(0, 10), today);
    var away = p.last_active ? daysBetween(p.last_active, today) : null;
    if (p.texts_paused) return 'blocked';
    if (!p.setup_done || joined <= 7) return 'new';
    if (away === null || away >= 7) return 'quiet';
    if (p.week_planned >= 1 && p.week_done >= p.week_planned) return 'thriving';
    if (p.week_planned >= 2 && p.week_done * 2 < p.week_planned && away >= 3) return 'slipping';
    return 'steady';
  }
  function personLine(p, today) {
    var away = p.last_active ? daysBetween(p.last_active, today) : null;
    var opened = away === null ? 'Has not opened the app yet.' : 'Opened ' + agoWords(away) + '.';
    if (p.texts_paused) return 'Texts on hold. ' + opened;
    if (!p.setup_done) return 'Setup not finished. ' + opened;
    return (p.week_planned > 0 ? p.week_done + ' of ' + p.week_planned + ' this week. ' : 'No plan this week. ') + opened;
  }
  var TIERS = { free: 'Free', basic: 'Basic', premium: 'Premium' };
  var PLAN_FROM = { test: 'tester', trial: 'trial', promo: 'code' };
  var SMS_WORDS = { opted_in: 'On', verified_sms_off: 'Off', phone_unverified: 'Number not confirmed', phone_missing: 'No number', opted_out: 'Said STOP' };
  function textsWord(p) { return p.texts_paused ? 'On hold' : (SMS_WORDS[p.sms_status] || text(p.sms_status) || 'Not known'); }
  function personName(p) { return (p.name || 'No name yet') + (p.you ? ' (you)' : ''); }

  // Read after the list, and never in its way: if this read fails the page
  // still shows the list, and says the people could not be read.
  var peopleTurn = 0;
  function loadPeople() {
    var mine = gen, turn = ++peopleTurn;
    rpc('owner_people_read', {}).then(function (r) {
      if (mine !== gen || turn !== peopleTurn) return;      // signed out, or a newer read is in the air
      if (r.ok && r.data && r.data.people) S.people = r.data;
      else if (!S.people) S.people = { failed: true, missing: r.status === 404 };
      if (S.stage === 'list') drawPage();
    });
  }
  function viewPeople() {
    var P = S.people;
    if (!P || P.missing) return '';
    if (P.failed) return '<section class="card"><h2 class="card-title">People</h2><p class="fine center">The people could not be read just now. The list below is not affected.</p></section>';
    var today = text(P.today), counts = {};
    var rows = P.people.map(function (p, i) { return { p: p, s: personStatus(p, today), i: i }; });
    rows.sort(function (a, b) { return (ORDER.indexOf(a.s) - ORDER.indexOf(b.s)) || (a.i - b.i); });
    rows.forEach(function (x) { counts[x.s] = (counts[x.s] || 0) + 1; });
    var tally = ORDER.filter(function (k) { return counts[k]; }).map(function (k) {
      return '<span class="chip"><i class="dot s-' + k + '"></i>' + counts[k] + ' ' + STATUS_WORDS[k] + '</span>';
    }).join('');
    var list = rows.map(function (x) {
      var q = x.p;
      return '<button class="row" data-act="person" data-id="' + esc(q.id) + '"><i class="dot s-' + x.s + '"></i><span class="grow"><b>' + esc(personName(q)) + '</b><small>' + esc(personLine(q, today)) + '</small></span>' +
        '<span class="chip' + (q.tier === 'premium' ? ' gold' : '') + '">' + esc(TIERS[q.tier] || text(q.tier)) + '</span><i class="chev"></i></button>';
    }).join('');
    return '<section class="card"><h2 class="card-title">People · ' + P.people.length + '</h2>' +
      (tally ? '<div class="chips mid">' + tally + '</div>' : '') +
      (list ? '<div class="list">' + list + '</div>' : '<p class="fine center">Nobody has an account yet.</p>') +
      '<p class="fine center">How each person is doing, by the numbers. Nobody’s messages are shown here.</p></section>';
  }
  function viewInvite() {
    var inv = S.people && S.people.invite;
    if (!inv || !inv.link) return '';
    return '<section class="card"><h2 class="card-title">Add a tester</h2>' +
      '<p class="fine center">Send a friend this link. They install the app and sign in with their own mobile number. You enter nothing.' +
      (inv.cap ? ' The link lets in ' + esc(inv.cap) + ' people in all.' : '') + '</p>' +
      '<button class="btn wide" data-act="invite">Copy invite link</button></section>';
  }

  function viewList() {
    var L = S.list;
    var due = L.followups.filter(function (f) { return daysUntil(f.check_on) <= 0; }).length;
    var follow = L.followups.map(function (f) {
      var open = !!S.fopen[f.id];
      return '<li class="sug' + (open ? ' open' : '') + '"><div class="sug-head">' +
        '<button class="grow" data-act="ftoggle" data-id="' + esc(f.id) + '" aria-expanded="' + open + '"><span class="ttl">' + esc(f.title) + '</span><span class="ev">Waiting on ' + esc(f.waiting_on) + '</span></button>' + dueChip(f.check_on) + '</div>' +
        '<div class="sug-body"><div><div class="sug-in">' + (f.note ? '<p>' + esc(f.note) + '</p>' : '') +
        '<div class="acts"><button class="btn small" data-act="fedit" data-id="' + esc(f.id) + '">Edit</button><button class="btn small" data-act="fchecked" data-id="' + esc(f.id) + '">Checked</button>' +
        '<button class="btn small amber" data-act="fdone" data-id="' + esc(f.id) + '">Done</button><button class="btn small red" data-act="fdel" data-id="' + esc(f.id) + '">Delete</button></div>' +
        '<button class="btn small wide' + (f.notify ? ' on' : '') + '" data-act="fnotify" data-id="' + esc(f.id) + '" data-on="' + (f.notify ? '1' : '') + '">' + (f.notify ? 'Emailing you that morning' : 'Email me that morning') + '</button></div></div></div></li>';
    }).join('');
    var done = '';
    if (L.followups_done.length) {
      done = '<button class="link" data-act="fshowdone">' + (S.showDone ? 'Hide done' : 'Done · ' + L.followups_done.length) + '</button>';
      if (S.showDone) done += '<div class="list">' + L.followups_done.map(function (f) {
        return '<div class="row"><span class="grow"><b>' + esc(f.title) + '</b><small>Done ' + day(new Date(f.done_at)) + '</small></span><button class="btn small" data-act="fundone" data-id="' + esc(f.id) + '">Bring back</button></div>';
      }).join('') + '</div>';
    }
    var groups = L.sections.map(function (s) {
      var its = L.items.filter(function (it) { return it.section === s.key; }), open = !!S.sec[s.key];
      var rows = its.length ? its.map(function (it) {
        return '<button class="row" data-act="iedit" data-id="' + esc(it.id) + '"><span class="grow"><span>' + esc(it.body) + '</span>' +
          (it.decision ? '<small>You said ' + esc(it.decision) + (it.decision_note ? ': ' + esc(it.decision_note) : '') + '</small>' : '') + '</span>' +
          (it.decision ? '<span class="chip on">' + esc(it.decision) + '</span>' : '') + '<i class="chev"></i></button>';
      }).join('') : '<p class="fine">Nothing open here.</p>';
      return '<div class="grp' + (open ? ' open' : '') + '"><button class="grp-head" data-act="sec" data-id="' + esc(s.key) + '" aria-expanded="' + open + '"><span class="rank">' + esc(s.key) + '</span><span class="grow"><span class="ttl">' + esc(s.title) + '</span></span><span class="chip num">' + its.length + '</span></button>' +
        '<div class="sug-body"><div><div class="list grp-in">' + rows + '</div></div></div></div>';
    }).join('');
    var gone = '';
    if (L.removed.length) {
      gone = '<button class="link" data-act="ishowgone">' + (S.showGone ? 'Hide removed' : 'Removed · ' + L.removed.length) + '</button>';
      if (S.showGone) gone += '<div class="list">' + L.removed.map(function (it) {
        return '<div class="row"><span class="grow"><small>' + esc(it.body) + '</small></span><button class="btn small" data-act="irestore" data-id="' + esc(it.id) + '">Bring back</button></div>';
      }).join('') + '</div>';
    }
    return '' +
      viewToday() + viewMoney() + viewPeople() + viewInvite() +
      '<h1 class="day">The list <span>' + L.items.length + ' open · ' + L.followups.length + ' to chase' + (due ? ' · ' + due + ' due' : '') + '</span></h1>' +
      '<section class="card' + (due ? ' verdict' : '') + '"><h2 class="card-title">Follow-ups · ' + L.followups.length + '</h2>' +
        '<p class="fine center">Things to chase on a day. On that day it turns red here.</p>' +
        (follow ? '<ol class="sugs">' + follow + '</ol>' : '<p class="fine center">Nothing to chase.</p>') +
        '<button class="btn wide" data-act="fadd">Add a follow-up</button>' + done + '</section>' +
      '<section class="card"><h2 class="card-title">Open items · ' + L.items.length + '</h2>' +
        '<p class="fine center">This is the real list. A change here is kept at once, and the sessions on the Mac read the same one and keep a copy, so leave people\u2019s names and numbers out of it.</p>' +
        '<button class="btn amber wide" data-act="iadd">Add an item</button><div class="sugs">' + groups + '</div>' + gone + '</section>' +
      '<button class="link" data-act="signout">Sign out</button>';
  }

  /* ---------- what a sheet holds ---------- */
  // An editing sheet is an ENTRY: the row as it was when the sheet opened
  // (orig, with the moment it was last seen), and what has been typed since
  // (draft). The sheet is always drawn from the draft when there is one, so a
  // redraw never loses typing.
  var ITEM_FIELDS = ['body', 'section', 'detail'];
  var FOLLOW_FIELDS = ['title', 'waiting_on', 'check_on', 'note'];
  var text = function (v) { return v == null ? '' : String(v); };
  function find(listName, id) { return ((S.list && S.list[listName]) || []).filter(function (x) { return x.id === id; })[0]; }
  function itemOrig(it) {
    return { body: text(it.body), section: text(it.section), detail: text(it.detail), seen: it.updated_at || null, ref_no: it.ref_no, updated_at: it.updated_at, updated_by: it.updated_by };
  }
  function followOrig(f) {
    return { title: text(f.title), waiting_on: text(f.waiting_on), check_on: text(f.check_on).slice(0, 10), note: text(f.note), seen: f.updated_at || null };
  }
  function itemEntry(id) {
    if (!id) {
      var keys = S.list.sections.map(function (s) { return s.key; });
      return { kind: 'item', id: null, newId: newId(), draft: null, orig: { body: '', section: keys.indexOf('H') >= 0 ? 'H' : text(keys[keys.length - 1]), detail: '', seen: null } };
    }
    var it = find('items', id);
    return it ? { kind: 'item', id: it.id, newId: null, draft: null, orig: itemOrig(it) } : null;
  }
  function followEntry(id) {
    if (!id) return { kind: 'follow', id: null, newId: newId(), draft: null, orig: { title: '', waiting_on: '', check_on: isoPlus(2), note: '', seen: null } };
    var f = find('followups', id);
    return f ? { kind: 'follow', id: f.id, newId: null, draft: null, orig: followOrig(f) } : null;
  }
  // What is in the open sheet's fields, kept on its entry.
  function capture() {
    var top = stack.length ? stack[stack.length - 1] : null;
    if (!top) return null;
    if (top.kind === 'item' && $('#itext')) top.draft = { body: val('#itext'), section: val('#isec') || top.orig.section, detail: val('#idetail') };
    if (top.kind === 'follow' && $('#ft')) top.draft = { title: val('#ft'), waiting_on: val('#fwho'), check_on: val('#fdate'), note: val('#fnote') };
    return top;
  }

  // What can be done to an item besides rewording it.
  function itemActions(a) {
    var it = find('items', a.id) || {};
    var said = function (v, label) {
      return '<button class="btn small' + (it.decision === v ? ' on' : '') + '" data-act="decide" data-id="' + esc(a.id) + '" data-answer="' + v + '">' + label + '</button>';
    };
    return '<div class="box"><span class="micro">Your call' + (it.decision ? ': ' + esc(it.decision) : '') + '</span>' +
        '<label class="field" for="dnote"><input class="well" id="dnote" maxlength="1000" placeholder="A word on why (optional)" value="' + esc(it.decision_note || '') + '"></label>' +
        '<div class="three">' + said('yes', 'Yes') + said('no', 'No') + said('later', 'Later') + '</div>' +
        (it.decision ? '<button class="link" data-act="decide" data-id="' + esc(a.id) + '" data-answer="">Take the decision back</button>' : '') + '</div>' +
      '<button class="btn red wide" data-act="idel" data-id="' + esc(a.id) + '">Delete item</button>';
  }
  // True when the open item sheet holds typing that has not been saved.
  function unsaved() {
    var top = capture();
    if (!top || top.kind !== 'item' || !top.draft) return false;
    return ITEM_FIELDS.some(function (f) { return text(top.draft[f]).trim() !== text(top.orig[f]).trim(); });
  }

  /* ---------- sheets: one at a time ---------- */
  function pop(title, body, inner) {
    return '<div class="pop swap" role="dialog" aria-modal="true" aria-label="' + esc(title) + '"><h2>' + esc(title) + '</h2>' + (body ? '<p class="body">' + esc(body) + '</p>' : '') + inner + '</div>';
  }
  var cancel = '<button class="btn" data-act="close">Cancel</button>';
  var SHEETS = {
    item: function (a) {
      var v = a.draft || a.orig;
      var last = a.id && a.orig.updated_at ? '<p class="fine">#' + esc(a.orig.ref_no) + ' · last changed ' + day(new Date(a.orig.updated_at)) + ' ' + (a.orig.updated_by === 'owner' ? 'by you' : 'by a session') + '</p>' : '';
      return { full: true, html: '<div class="sheet swap" role="dialog" aria-modal="true" aria-label="' + (a.id ? 'Edit item' : 'New item') + '">' +
        '<h2 class="name">' + (a.id ? 'Edit item' : 'New item') + '</h2>' + last +
        '<label class="field" for="itext"><span class="micro muted">What is open</span><textarea class="well" id="itext" maxlength="600" placeholder="One plain sentence.">' + esc(v.body) + '</textarea></label>' +
        '<label class="field" for="isec"><span class="micro muted">Section</span><select class="well" id="isec">' + S.list.sections.map(function (s) {
          return '<option value="' + esc(s.key) + '"' + (s.key === v.section ? ' selected' : '') + '>' + esc(s.key) + '. ' + esc(s.title) + '</option>';
        }).join('') + '</select></label>' +
        '<label class="field" for="idetail"><span class="micro muted">The longer record (optional)</span><textarea class="well tall" id="idetail" maxlength="8000" placeholder="What was measured, what was ruled out, where it is written down.">' + esc(v.detail) + '</textarea></label>' +
        '<div class="pair">' + cancel + '<button class="btn amber" data-act="isave">Save</button></div>' +
        (a.id ? itemActions(a) : '') + '</div>' };
    },
    idel: function (a) {
      return { html: pop('Delete this item?', 'It moves to Removed, where you can bring it back.',
        '<div class="pair">' + cancel + '<button class="btn red" data-act="idelgo" data-id="' + esc(a.id) + '">Delete</button></div>') };
    },
    follow: function (a) {
      var v = a.draft || a.orig;
      return { html: pop(a.id ? 'Edit follow-up' : 'New follow-up', '',
        '<label class="field" for="ft"><span class="micro muted">What are you waiting for</span><input class="well" id="ft" maxlength="300" value="' + esc(v.title) + '" placeholder="The answer you need"></label>' +
        '<label class="field" for="fwho"><span class="micro muted">Waiting on</span><input class="well" id="fwho" maxlength="80" value="' + esc(v.waiting_on) + '" placeholder="A company, a person, you"></label>' +
        '<label class="field" for="fdate"><span class="micro muted">Check again on</span><input class="well" id="fdate" type="date" value="' + esc(v.check_on) + '"></label>' +
        '<label class="field" for="fnote"><span class="micro muted">Note</span><textarea class="well" id="fnote" maxlength="2000" placeholder="Ticket number, what it holds up">' + esc(v.note) + '</textarea></label>' +
        '<div class="pair">' + cancel + '<button class="btn amber" data-act="fsave">Save</button></div>') };
    },
    fnext: function (a) {
      var f = find('followups', a.id);
      if (!f) return null;
      return { html: pop('Still waiting?', 'Pick the next day to check on ' + f.waiting_on + '.',
        '<label class="field" for="fnext"><span class="micro muted">Check again on</span><input class="well" id="fnext" type="date" value="' + isoPlus(2) + '"></label>' +
        '<div class="pair">' + cancel + '<button class="btn amber" data-act="fnextsave" data-id="' + esc(a.id) + '">Save</button></div>') };
    },
    fdel: function (a) {
      return { html: pop('Delete this follow-up?', 'It will stop showing here. A session can still find it on the record.',
        '<div class="pair">' + cancel + '<button class="btn red" data-act="fdelgo" data-id="' + esc(a.id) + '">Delete</button></div>') };
    },
    seen: function (a) {
      var al = (S.list.alarms || []).filter(function (x) { return x.id === a.id; })[0];
      if (!al) return null;
      return { html: pop('Seen', alarmLine(al),
        '<label class="field" for="snote"><span class="micro muted">What you did about it (optional)</span><textarea class="well" id="snote" maxlength="1000" placeholder="Kept with the alarm."></textarea></label>' +
        '<div class="pair">' + cancel + '<button class="btn amber" data-act="seengo" data-id="' + esc(a.id) + '">Seen</button></div>') };
    },
    topup: function () {
      return { html: pop('I topped up', 'How much did you add on the AI billing page?',
        '<div class="three"><button class="btn small amber" data-act="topupgo" data-usd="25">$25</button><button class="btn small amber" data-act="topupgo" data-usd="50">$50</button><button class="btn small amber" data-act="topupgo" data-usd="100">$100</button></div>' +
        '<label class="field" for="tother"><span class="micro muted">Or another amount</span><input class="well" id="tother" inputmode="decimal" placeholder="40"></label>' +
        '<div class="pair">' + cancel + '<button class="btn" data-act="topupgo" data-usd="">Add it</button></div>') };
    },
    balance: function () {
      return { html: pop('The exact balance', 'Type what the AI billing page shows right now. The estimate starts again from it.',
        '<label class="field" for="bexact"><span class="micro muted">Dollars</span><input class="well code" id="bexact" inputmode="decimal" placeholder="60.00"></label>' +
        '<div class="pair">' + cancel + '<button class="btn amber" data-act="balancego">Save</button></div>') };
    },
    tripwire: function () {
      var m = S.list.money || {};
      return { html: pop('Tripwire', 'Email me if one day\u2019s AI spend passes this. It warns and stops nothing. 0 turns it off.',
        '<label class="field" for="twire"><span class="micro muted">Dollars a day</span><input class="well code" id="twire" inputmode="decimal" placeholder="5.00" value="' + esc(m.tripwire_usd === null || m.tripwire_usd === undefined ? '' : m.tripwire_usd) + '"></label>' +
        '<div class="pair">' + cancel + '<button class="btn amber" data-act="tripwirego">Save</button></div>') };
    },
    // One person, read only. Everything here came from owner_people_read.
    person: function (a) {
      var P = S.people, q = P && P.people ? P.people.filter(function (x) { return x.id === a.id; })[0] : null;
      if (!q) return null;
      var today = text(P.today), st = personStatus(q, today);
      var kv = function (k, v) { return '<div class="kv"><span>' + esc(k) + '</span><b>' + esc(v) + '</b></div>'; };
      var plan = (TIERS[q.tier] || text(q.tier)) + (PLAN_FROM[q.plan_source] ? ' \u00b7 ' + PLAN_FROM[q.plan_source] : '');
      var left = Math.max(0, (q.credit_granted_cents || 0) - (q.ai_spent_cents || 0));
      return { full: true, html: '<div class="sheet swap" role="dialog" aria-modal="true" aria-label="Person">' +
        '<h2 class="name">' + esc(personName(q)) + '</h2>' +
        '<div class="chips"><span class="chip"><i class="dot s-' + st + '"></i>' + STATUS_WORDS[st] + '</span></div>' +
        '<p class="fine">' + esc(personLine(q, today)) + '</p>' +
        '<div class="list">' +
          kv('This week', q.week_planned > 0 ? q.week_done + ' of ' + q.week_planned + ' planned days' : 'no plan') +
          kv('Last opened', q.last_active ? agoWords(daysBetween(q.last_active, today)) : 'never') +
          kv('Days opened, last 7', text(q.active_days_7)) +
          kv('Joined', day(new Date(q.joined_at))) +
          kv('Plan', plan) + (q.plan_until ? kv('Plan runs to', day(new Date(q.plan_until))) : '') +
          kv('Texts', textsWord(q)) +
          kv('Texts, last 7 days', q.texts_out_7d + ' from the coach \u00b7 ' + q.texts_in_7d + ' from them') +
          kv('AI cost, last 7 days', usd((q.ai_spent_7d_cents || 0) / 100)) +
          kv('AI cost, all time', usd((q.ai_spent_cents || 0) / 100)) +
          (q.credit_granted_cents ? kv('AI credit given', usd(q.credit_granted_cents / 100)) + kv('Credit left', usd(left / 100)) : '') +
          kv('Teams', (q.teams || []).length ? q.teams.join(', ') : 'none') +
        '</div>' +
        '<p class="fine">Their messages are not shown here.</p>' +
        '<button class="btn wide" data-act="close">Close</button></div>' };
    },
    // Copying was refused by the browser: show the link to press and hold.
    invitelink: function () {
      var inv = S.people && S.people.invite;
      if (!inv || !inv.link) return null;
      return { html: pop('Invite link', 'Copying was refused here. Press and hold the link to copy it.',
        '<label class="field" for="linktext"><input class="well" id="linktext" readonly value="' + esc(inv.link) + '"></label>' +
        '<button class="btn" data-act="close">Close</button>') };
    },
    signout: function () {
      return { html: pop('Sign out?', 'You will need a texted code to open this page again on this device.',
        '<div class="pair">' + cancel + '<button class="btn red" data-act="signoutgo">Sign out</button></div>' +
        '<p class="fine center">If you think someone else has your sign-in, end it everywhere. Every device is forgotten, so each will need a texted code and an emailed code again, and the app on your phone will ask for a code again too.</p>' +
        '<button class="btn red wide" data-act="signoutgo" data-all="1">Sign out of every device</button>') };
    }
  };
  var leaveTimer = null;
  function drawSheet() {
    var root = $('#sheet');
    clearTimeout(leaveTimer);
    var top = stack.length ? stack[stack.length - 1] : null;
    var s = top && S.list ? SHEETS[top.kind](top) : null;
    if (top && !s) { stack.length = 0; top = null; }
    if (!s) {
      document.documentElement.classList.remove('locked');
      if (root.hidden) return;
      if (root.firstElementChild) { root.firstElementChild.classList.remove('still'); root.firstElementChild.classList.add('leaving'); }
      leaveTimer = setTimeout(function () { root.hidden = true; root.innerHTML = ''; }, reduced() ? 0 : 800);
      return;
    }
    var was = !root.hidden && root.firstElementChild && !root.firstElementChild.classList.contains('leaving');
    root.hidden = false;
    root.innerHTML = '<div class="veil' + (s.full ? ' full' : '') + (was ? ' still' : '') + '" data-veil>' + s.html + '</div>';
    document.documentElement.classList.add('locked');
    var first = root.querySelector('input,textarea');
    // A new row asks for typing at once; an existing one is read first.
    if (first && !top.draft && (!top.id || top.kind === 'seen')) { try { first.focus({ preventScroll: true }); } catch (e) { /* no focus, no harm */ } }
  }
  function openEntry(entry) { if (entry) { stack.push(entry); drawSheet(); } }
  function openSheet(kind, args) { var a = args || {}; a.kind = kind; stack.push(a); drawSheet(); }
  function closeSheet() { stack.pop(); drawSheet(); }
  function closeAll() { stack.length = 0; drawSheet(); }

  var toastTimer = null;
  function toast(msg) {
    var t = $('#toast');
    clearTimeout(toastTimer);
    t.classList.remove('leaving'); t.hidden = false; t.innerHTML = '<span>' + esc(msg) + '</span>';
    toastTimer = setTimeout(function () {
      t.classList.add('leaving');
      toastTimer = setTimeout(function () { t.hidden = true; }, reduced() ? 0 : 800);
    }, 4200);
  }

  /* ---------- drawing ---------- */
  function drawPage() {
    var v = $('#view'), asof = $('#asof'), fresh = $('#refresh');
    fresh.hidden = S.stage !== 'list';
    asof.textContent = S.stage === 'list' && S.asOf ? 'As of ' + clock(S.asOf) : 'Private';
    if (S.stage === 'opening') v.innerHTML = '<p class="fine center">Opening.</p>';
    else if (S.stage === 'offline') v.innerHTML = '<section class="card"><h1 class="card-title">No connection</h1><p class="fine center">The list could not be reached. Nothing is lost: it is kept in the database.</p><button class="btn wide" data-act="reload">Try again</button></section>';
    else if (S.stage === 'notowner') v.innerHTML = '<section class="card"><h1 class="card-title">Not the owner</h1><p class="fine center">This page opens only for the owner of CountAble. The account you signed in with is not it.</p><button class="btn wide" data-act="signoutgo">Sign out</button></section>';
    else if (S.stage === 'second') v.innerHTML = viewSecond();
    else if (S.stage === 'list' && S.list) v.innerHTML = viewList();
    else v.innerHTML = viewSignIn();
  }

  /* ---------- reading ---------- */
  var loading = null;
  function load(quiet) {
    // A read already in the air may have left before the last change landed:
    // wait for it, then read again.
    if (loading) return loading.then(function () { return load(quiet); });
    var mine = gen;
    loading = rpc('owner_list_read', {}).then(function (r) {
      loading = null;
      if (mine !== gen) return r;              // signed out while this was in the air: draw nothing
      if (r.ok && r.data && r.data.sections) {
        S.list = r.data; S.asOf = new Date(); S.stage = 'list';
        loadPeople();
        // Typing that was kept across a sign-out comes back.
        if (S.pending) { var kept = S.pending; S.pending = null; stack.length = 0; stack.push(kept); drawSheet(); }
      } else if (r.status === 401) {
        signedOut(quiet ? '' : 'You are signed out. Sign in again.');
        return r;
      } else if (SECOND(r)) {
        needSecond();
        return r;
      } else if (NOT_OWNER(r)) {
        S.list = null; S.stage = 'notowner'; stack.length = 0; drawSheet();
      } else if (!S.list) {
        S.stage = 'offline';
      } else if (!quiet) {
        toast(why(r));
      }
      drawPage();
      return r;
    });
    return loading;
  }

  /* ---------- writing ---------- */
  var val = function (sel) { var el = $(sel); return el ? String(el.value || '') : ''; };
  var isDay = function (v) { return /^\d{4}-\d{2}-\d{2}$/.test(v || ''); };
  function hold(el) {
    var label = el ? el.textContent : '';
    S.busy = true;
    if (el) { el.disabled = true; el.textContent = 'Saving'; }
    return function () { S.busy = false; if (el) { el.disabled = false; el.textContent = label; } };
  }

  // SAVE A SHEET. The sheet closes only on a yes. On anything else the entry
  // (and so everything typed) is kept.
  function save(el, entry, name, args, okText, after) {
    if (S.busy) return;
    var release = hold(el), mine = gen;
    var finish = function () { S.busy = false; closeAll(); if (after) after(); toast(okText); };
    rpc(name, args).then(function (r) {
      if (mine !== gen) { S.busy = false; return; }
      if (r.ok) { finish(); load(true); return; }
      if (r.status === 401) {
        // Signed out with typing in the sheet: keep it for after the sign-in.
        S.pending = entry;
        signedOut('You were signed out. What you typed is kept: sign in and it comes back.');
        return;
      }
      // This sign-in is no longer trusted (it was ended from another device):
      // the typing is kept the same way, for after the second step.
      if (SECOND(r)) { S.pending = entry; needSecond(); return; }
      if (!CHANGED(r)) { release(); toast(why(r, true)); return; }
      // THE ROW CHANGED SOMEWHERE ELSE. Read it again and work out what to keep.
      load(true).then(function () {
        if (mine !== gen || !S.list) { S.busy = false; return; }
        var theirs = find(entry.kind === 'item' ? 'items' : 'followups', args._id);
        if (!theirs) { release(); toast('This is no longer on the list. Your text is still here.'); return; }
        var fields = entry.kind === 'item' ? ITEM_FIELDS : FOLLOW_FIELDS;
        var now = entry.kind === 'item' ? itemOrig(theirs) : followOrig(theirs);
        var merged = {}, same = true, clash = false;
        fields.forEach(function (f) {
          var typed = text(entry.draft[f]).trim(), was = text(entry.orig[f]).trim(), there = text(now[f]).trim();
          merged[f] = typed === was ? there : typed;        // what was not touched here takes what is there now
          if (typed !== was && there !== was && there !== typed) clash = true;
          if (merged[f] !== there) same = false;
        });
        // The row already says what this save was saying (an earlier try landed).
        if (same) { finish(); drawPage(); return; }
        entry.id = theirs.id; entry.newId = null; entry.orig = now; entry.draft = merged;
        release(); drawSheet();
        toast(clash
          ? 'The same part was changed somewhere else. Yours is shown. Check it, then save again.'
          : 'This was changed somewhere else while you had it open. Theirs is in, yours is kept. Save again.');
      });
    });
  }

  // CHANGE A ROW FROM THE LIST (done, bring back, delete, the next day). `again`
  // gives the arguments once more from the row as it now is, for one more try
  // when the row had changed.
  function change(el, name, args, okText, after, again) {
    if (S.busy) return;
    var release = hold(el), mine = gen;
    var done = function () { S.busy = false; if (after) after(); toast(okText); load(true); };
    rpc(name, args).then(function (r) {
      if (mine !== gen) { S.busy = false; return; }
      if (r.ok) { done(); return; }
      if (r.status === 401) { signedOut('You are signed out. Sign in again.'); return; }
      if (SECOND(r)) { needSecond(); return; }
      if (CHANGED(r) && again) {
        load(true).then(function () {
          var fresh = mine === gen && S.list ? again() : null;
          if (!fresh) { release(); toast('That changed somewhere else. Look at it again.'); return; }
          rpc(name, fresh).then(function (r2) {
            if (mine !== gen) { S.busy = false; return; }
            if (r2.ok) { done(); return; }
            release(); toast(why(r2)); load(true);
          });
        });
        return;
      }
      release(); toast(why(r));
      if (r.status === 0) load(true);          // it may have landed: show what is true
    });
  }

  /* ---------- actions ---------- */
  var ACT = {
    start: function () {
      if (S.busy) return;
      var phone = val('#phone').trim();
      if (phone.replace(/\D/g, '').length < 10) { say('Type your mobile number with its area code.', 'warn'); drawPage(); return; }
      S.phone = phone; S.busy = true; say(''); drawPage();
      post('/functions/v1/phone-signin-start', { phone: phone, country: 'US', device: deviceId() }).then(function (r) {
        S.busy = false;
        if (r.ok && r.data && r.data.ok) { S.stage = 'code'; say(''); }
        else say(r.status === 0 ? 'No connection. No code was sent.' : (r.data && r.data.message) || 'The code could not be sent. Try again in a moment.', 'warn');
        drawPage();
        var c = $('#code'); if (c) { try { c.focus(); } catch (e) { /* fine */ } }
      });
    },
    verify: function () {
      if (S.busy) return;
      var code = val('#code').replace(/\D/g, '');
      if (code.length !== 6) { say('The code is six digits.', 'warn'); drawPage(); return; }
      S.busy = true; say(''); drawPage();
      var mine = gen;
      // create:false — this page signs an account in and never makes one.
      post('/functions/v1/phone-signin-verify', { phone: S.phone, country: 'US', code: code, create: false }).then(function (r) {
        if (!(r.ok && r.data && r.data.ok && r.data.token_hash)) {
          S.busy = false;
          say(r.status === 0 ? 'No connection. Try again.' : (r.data && r.data.message) || 'That did not work. Try again.', 'warn');
          drawPage();
          return;
        }
        // The one-time token is traded for the session, exactly as the app does.
        post('/auth/v1/verify', { type: 'magiclink', token_hash: r.data.token_hash }).then(function (t) {
          S.busy = false; S.phone = '';
          if (mine !== gen) return;
          if (t.ok && t.data && t.data.access_token) {
            keepSession(t.data); say(''); S.stage = 'opening'; drawPage(); load();
          } else {
            S.stage = 'signin'; say('Signing in did not finish. Ask for a new code.', 'warn'); drawPage();
          }
        });
      });
    },
    again: function () { S.stage = 'signin'; S.phone = ''; say(''); drawPage(); },
    // The second step: the code from the email.
    secondgo: function () {
      if (S.busy) return;
      var code = val('#scode').replace(/\D/g, '');
      if (code.length !== 6) { say('The code is six digits.', 'warn'); drawPage(); return; }
      S.busy = true; say(''); drawPage();
      var mine = gen;
      second('verify', code).then(function (r) {
        S.busy = false;
        if (mine !== gen) return;
        if (ENDED(r)) { ended(); return; }
        if (r.status === 401) { signedOut('You are signed out. Sign in again.'); return; }
        if (r.status === 403) { S.stage = 'notowner'; drawPage(); return; }
        if (r.ok && r.data && r.data.ok) { say(''); S.stage = 'opening'; drawPage(); load(); return; }
        say(secondSays(r), 'warn'); drawPage();
      });
    },
    secondagain: function () { say(''); secondStart(); },
    reload: function () { S.stage = 'opening'; drawPage(); load(); },
    refresh: function () { load().then(function (r) { if (r.ok) toast('Up to date'); }); },
    signout: function () { openSheet('signout'); },
    signoutgo: function (d) {
      var token = session && session.access_token, everywhere = !!(d && d.all);
      gen++;                                   // every call still in the air is now too late to matter
      keepSession(null); S.list = null; S.people = null; S.phone = ''; S.pending = null; S.busy = false; S.stage = 'signin'; say('');
      stack.length = 0; drawSheet(); drawPage();
      if (!token) return;
      // First the database forgets that this sign-in passed (or, for every
      // device, every sign-in AND every remembered device), so a token still
      // good for an hour opens nothing. Then
      // the sign-in itself ends: "local" is this page's, "global" is every
      // session of the account.
      post('/rest/v1/rpc/owner_sessions_revoke', { _all: everywhere }, token).then(function () {
        post(everywhere ? '/auth/v1/logout?scope=global' : '/auth/v1/logout?scope=local', {}, token);
      });
    },
    close: function () { closeSheet(); },

    sec: function (d, el) {
      S.sec[d.id] = !S.sec[d.id];
      writeStore(OPEN, JSON.stringify(S.sec));
      el.closest('.grp').classList.toggle('open', S.sec[d.id]);
      el.setAttribute('aria-expanded', String(S.sec[d.id]));
    },
    iadd: function () { openEntry(itemEntry(null)); },
    iedit: function (d) { openEntry(itemEntry(d.id)); },
    isave: function (d, el) {
      var top = capture();
      if (!top || top.kind !== 'item') return;
      var v = top.draft, body = v.body.trim();
      if (!body) { toast('Type the item first'); return; }
      save(el, top, 'owner_item_save', { _id: top.id || top.newId, _section: v.section, _body: body, _detail: v.detail.trim() || null, _seen: top.id ? top.orig.seen : null, _create: !top.id },
        top.id ? 'Item changed' : 'Item added', function () { S.sec[v.section] = true; writeStore(OPEN, JSON.stringify(S.sec)); });
    },
    // The question is laid over the sheet; what is in the sheet is kept first,
    // so Cancel gives it back as it was.
    idel: function (d) { capture(); openSheet('idel', { id: d.id }); },
    idelgo: function (d, el) { change(el, 'owner_item_remove', { _id: d.id, _removed: true }, 'Item removed', closeAll); },
    irestore: function (d, el) { change(el, 'owner_item_remove', { _id: d.id, _removed: false }, 'Item is back'); },
    ishowgone: function () { S.showGone = !S.showGone; drawPage(); },

    ftoggle: function (d, el) {
      S.fopen[d.id] = !S.fopen[d.id];
      el.closest('.sug').classList.toggle('open', S.fopen[d.id]);
      el.setAttribute('aria-expanded', String(S.fopen[d.id]));
    },
    fadd: function () { openEntry(followEntry(null)); },
    fedit: function (d) { openEntry(followEntry(d.id)); },
    fsave: function (d, el) {
      var top = capture();
      if (!top || top.kind !== 'follow') return;
      var v = top.draft, title = v.title.trim();
      if (!title) { toast('Say what you are waiting for'); return; }
      if (!isDay(v.check_on)) { toast('Pick a day to check'); return; }
      save(el, top, 'owner_followup_save', { _id: top.id || top.newId, _title: title, _waiting_on: v.waiting_on.trim() || 'someone', _check_on: v.check_on, _note: v.note.trim() || null, _seen: top.id ? top.orig.seen : null, _create: !top.id },
        top.id ? 'Follow-up changed' : 'Follow-up added');
    },
    fchecked: function (d) { openSheet('fnext', { id: d.id }); },
    fnextsave: function (d, el) {
      var v = val('#fnext');
      if (!isDay(v)) { toast('Pick a day to check'); return; }
      // Only the day is his; the rest is sent as the row now has it.
      var args = function () {
        var f = find('followups', d.id);
        return f ? { _id: f.id, _title: f.title, _waiting_on: f.waiting_on, _check_on: v, _note: f.note || null, _seen: f.updated_at || null, _create: false } : null;
      };
      var first = args();
      if (!first) { closeSheet(); return; }
      change(el, 'owner_followup_save', first, 'Next check ' + day(fromIso(v)), closeAll, args);
    },
    fdone: function (d, el) { change(el, 'owner_followup_done', { _id: d.id, _done: true }, 'Marked done'); },
    fundone: function (d, el) { change(el, 'owner_followup_done', { _id: d.id, _done: false }, 'Back on the list'); },
    fshowdone: function () { S.showDone = !S.showDone; drawPage(); },
    fdel: function (d) { openSheet('fdel', { id: d.id }); },
    fdelgo: function (d, el) { change(el, 'owner_followup_remove', { _id: d.id, _removed: true }, 'Follow-up deleted', closeAll); },
    fnotify: function (d, el) {
      var on = !d.on;
      change(el, 'owner_followup_notify', { _id: d.id, _on: on }, on ? 'You will get an email that morning' : 'No email for this one');
    },

    // A person, and the link to hand a friend.
    person: function (d) { openSheet('person', { id: d.id }); },
    invite: function () {
      var inv = S.people && S.people.invite;
      if (!inv || !inv.link) return;
      try {
        navigator.clipboard.writeText(inv.link).then(function () { toast('Invite link copied'); }, function () { openSheet('invitelink'); });
      } catch (e) { openSheet('invitelink'); }
    },

    // An alarm, seen.
    seen: function (d) { openSheet('seen', { id: d.id }); },
    seengo: function (d, el) { change(el, 'owner_alarm_mark_seen', { _event_id: d.id, _note: val('#snote').trim() || null }, 'Marked seen', closeAll); },
    showseen: function () { S.showSeen = !S.showSeen; drawPage(); },
    // The health check, now. Its answer arrives as an alarm (or as nothing).
    check: function (d, el) {
      change(el, 'owner_health_check', {}, 'Asked. Anything it finds shows here within a minute, and is emailed.', function () {
        setTimeout(function () { if (S.stage === 'list' && !stack.length && !S.busy) load(true); }, 20000);
      });
    },

    // The AI balance.
    topup: function () { openSheet('topup'); },
    topupgo: function (d, el) {
      var n = d.usd ? Number(d.usd) : parseFloat(val('#tother').replace(/[^0-9.]/g, ''));
      if (!(n >= 1 && n <= 5000)) { toast('Type an amount between $1 and $5,000'); return; }
      // The id is made here and kept until the answer comes back, so a second
      // tap after a lost answer is the SAME top-up and is counted once.
      var slot = 'topup:' + n;
      if (!S.asked[slot]) S.asked[slot] = newId();
      change(el, 'owner_ai_topup', { _add_usd: n, _id: S.asked[slot] }, 'Added ' + usd(n) + ' to the estimate', function () { delete S.asked[slot]; closeAll(); });
    },
    balance: function () { openSheet('balance'); },
    balancego: function (d, el) {
      var n = parseFloat(val('#bexact').replace(/[^0-9.]/g, ''));
      if (!(n >= 0 && n <= 100000)) { toast('Type the dollar amount the billing page shows'); return; }
      change(el, 'owner_ai_balance_set', { _usd: n }, 'Balance recorded', closeAll);
    },
    tripwire: function () { openSheet('tripwire'); },
    tripwirego: function (d, el) {
      var raw = val('#twire').replace(/[^0-9.]/g, ''), n = raw === '' ? 0 : parseFloat(raw);
      if (!(n >= 0 && n <= 1000)) { toast('A tripwire is between $0 and $1,000 a day'); return; }
      change(el, 'owner_tripwire_set', { _usd: n }, n > 0 ? 'Tripwire set at ' + usd(n) + ' a day' : 'Tripwire off', closeAll);
    },

    // Yes / no / later on an item, recorded for the sessions.
    decide: function (d, el) {
      if (unsaved()) { toast('Save or cancel your changes to this item first'); return; }
      var answer = d.answer || null;
      change(el, 'owner_item_decide', { _id: d.id, _answer: answer, _note: answer ? (val('#dnote').trim() || null) : null },
        answer ? 'Recorded: ' + answer : 'Decision taken back', closeAll);
    }
  };

  document.addEventListener('click', function (e) {
    var el = e.target.closest ? e.target.closest('[data-act]') : null;
    if (el) { if (el.disabled) return; var fn = ACT[el.dataset.act]; if (fn) fn(el.dataset, el); return; }
    // A tap on the dimmed page closes a question, never a sheet with typing in it.
    if (e.target.hasAttribute && e.target.hasAttribute('data-veil') && !e.target.querySelector('input,textarea,select')) closeSheet();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.target && e.target.id === 'phone') { e.preventDefault(); ACT.start(); }
    if (e.key === 'Enter' && e.target && e.target.id === 'code') { e.preventDefault(); ACT.verify(); }
    if (e.key === 'Enter' && e.target && e.target.id === 'scode') { e.preventDefault(); ACT.secondgo(); }
  });
  // Coming back to the page: read the list again, unless something is being typed.
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState !== 'visible' || S.stage !== 'list' || stack.length || S.busy) return;
    if (!S.asOf || Date.now() - S.asOf.getTime() > 30000) load(true);
  });

  session = storedSession();
  if (session) { S.stage = 'opening'; drawPage(); load(true); }
  else { S.stage = 'signin'; drawPage(); }
})();
