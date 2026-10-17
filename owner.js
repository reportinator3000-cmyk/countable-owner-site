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
// The list of people is COUNTS ONLY: no message, number or address is in it.
// The read comes after the list and never in its way. The invite link comes
// with it from the database; it is not written in this public file.
//
// A PERSON'S TEXTS (owner, Oct 13 2026: "lets update the privacy documents
// and then put the individual texts inside the dashboard"). The privacy
// policy said so first. A person's texts with the coach are read ONE PERSON
// AT A TIME and only on a tap (owner_person_texts), the database records
// every opening, and the words are held in memory only: never in this
// browser's storage, and gone when the sheet closes or the sign-in ends.
//
// THE COACH TAB (owner, Oct 13 2026: "build out the coach tab as described").
// What ran (owner_coach_read: every model call the log holds, by job, model
// and person, with sizes and costs and never anyone's words), what the coach
// is made of (the function owner-coach: for each job, the model it resolves
// to right now and what it is shown), and one person's coach
// (owner_person_coach: their coach's voice and dials, and for the owner's own
// account the coach's notebook). Asked for when the tab or the sheet is
// opened, never before; held in memory only.
//
// THE COSTS AND MARKETING TABS (owner, Oct 14 2026: "putting the cost and
// marketing docs as tabs in the dashboard would be good"). Two of the
// business's own write-ups, one per tab. THEIR WORDS ARE NEVER IN THIS FILE,
// or in any file of this public page: they are rows of the database
// (owner_docs), read through owner_docs_read behind the same guard as the
// list, when one of the two tabs is opened and never before. Read only here:
// a new version is loaded from the Mac (./owner-docs put). Held in memory
// only, and forgotten at every sign-out. Each is drawn by the small
// Markdown reader below, which treats the stored words as data: every
// character is escaped before any tag is put round it.
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
    people: null,              // the people and the invite link, read after the list (null = not read yet)
    texts: null,               // ONE person's texts while their sheet is open; memory only, never stored
    tab: 'home',               // home | coach | cost | marketing; memory only
    coach: null,               // what ran and the sheet, read when the Coach tab is opened
    docs: null,                // the two documents, read when the Costs or Marketing tab is opened; memory only, never stored
    coachDays: 7, coachWho: null, coachIdle: false, coachAll: false,
    pcoach: null,              // ONE person's coach while their sheet is open; memory only, never stored
    trace: null                // ONE write's record while its sheet is open; memory only, never stored
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
    S.list = null; S.people = null; forgetTexts(); forgetCoach(); forgetTrace(); forgetCoachTab(); forgetDocs(); S.stage = 'second'; S.busy = false;
    stack.length = 0; drawSheet();
    if (first) { S.codeSent = false; say(''); drawPage(); secondStart(); } else drawPage();
  }
  // The session is over. Anything being typed is kept and comes back after signing in.
  function signedOut(text) {
    keepSession(null); S.list = null; S.people = null; forgetTexts(); forgetCoach(); forgetTrace(); forgetCoachTab(); forgetDocs(); S.stage = 'signin'; S.busy = false;
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
    coaching_credit: 'Your coaching credit is low',
    spend_tripwire: 'Today\u2019s AI spend passed your tripwire',
    inbound_flood: 'Texts flooded in to the coach\u2019s number'
  };
  // His own coaching credit is told at three marks, and the alarm carries
  // which one (owner, Oct 13 2026: "yes add the warning"; owner_alerts.ts).
  var CREDIT_MARKS = { low: 'Your coaching credit is low', nearly_spent: 'Your coaching credit is nearly spent', spent: 'Your coaching credit is spent' };
  function alarmTitle(a) {
    if (a.condition === 'coaching_credit' && Object.prototype.hasOwnProperty.call(CREDIT_MARKS, a.ref)) return CREDIT_MARKS[a.ref];
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
  //   paused     you paused their account (they are in the Paused fold)
  var ORDER = ['blocked', 'slipping', 'quiet', 'new', 'steady', 'thriving', 'paused'];
  var STATUS_WORDS = { blocked: 'On hold', slipping: 'Slipping', quiet: 'Quiet', new: 'New', steady: 'Steady', thriving: 'On track', paused: 'Paused' };
  function personStatus(p, today) {
    var joined = daysBetween(text(p.joined_at).slice(0, 10), today);
    var away = p.last_active ? daysBetween(p.last_active, today) : null;
    if (p.paused_at) return 'paused';
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
    if (p.paused_at) return 'Paused ' + day(new Date(p.paused_at)) + '. Bring them back from their sheet.';
    if (p.texts_paused) return 'Texts on hold. ' + opened;
    if (!p.setup_done) return 'Setup not finished. ' + opened;
    return (p.week_planned > 0 ? p.week_done + ' of ' + p.week_planned + ' this week. ' : 'No plan this week. ') + opened;
  }
  var TIERS = { free: 'Free', basic: 'Basic', premium: 'Premium' };
  var PLAN_FROM = { test: 'tester', trial: 'trial', promo: 'code' };
  var SMS_WORDS = { opted_in: 'On', verified_sms_off: 'Off', phone_unverified: 'Number not confirmed', phone_missing: 'No number', opted_out: 'Said STOP' };
  function textsWord(p) { return p.paused_at ? 'Off: account paused' : p.texts_paused ? 'On hold' : (SMS_WORDS[p.sms_status] || text(p.sms_status) || 'Not known'); }
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
      // The coupons are read after the people (they name them), and only when there are people.
      if (S.people && S.people.people) loadCoupons();
    });
  }
  function viewPeople() {
    var P = S.people;
    if (!P || P.missing) return '';
    if (P.failed) return '<section class="card"><h2 class="card-title">People</h2><p class="fine center">The people could not be read just now. The list below is not affected.</p></section>';
    var today = text(P.today), counts = {};
    var rows = P.people.map(function (p, i) { return { p: p, s: personStatus(p, today), i: i }; });
    rows.sort(function (a, b) { return (ORDER.indexOf(a.s) - ORDER.indexOf(b.s)) || (a.i - b.i); });
    // PAUSED PEOPLE (owner, Oct 14 2026) are folded away under the list, like
    // used coupons, and come back with one tap on their sheet.
    var paused = rows.filter(function (x) { return x.s === 'paused'; });
    rows = rows.filter(function (x) { return x.s !== 'paused'; });
    rows.forEach(function (x) { counts[x.s] = (counts[x.s] || 0) + 1; });
    var tally = ORDER.filter(function (k) { return counts[k]; }).map(function (k) {
      return '<span class="chip"><i class="dot s-' + k + '"></i>' + counts[k] + ' ' + STATUS_WORDS[k] + '</span>';
    }).join('');
    var row = function (x) {
      var q = x.p;
      return '<button class="row" data-act="person" data-id="' + esc(q.id) + '"><i class="dot s-' + x.s + '"></i><span class="grow"><b>' + esc(personName(q)) + '</b><small>' + esc(personLine(q, today)) + '</small></span>' +
        '<span class="chip' + (q.tier === 'premium' ? ' gold' : '') + '">' + esc(TIERS[q.tier] || text(q.tier)) + '</span><i class="chev"></i></button>';
    };
    var list = rows.map(row).join('');
    var fold = '';
    if (paused.length) {
      fold = '<button class="link" data-act="ppast">' + (S.showPaused ? 'Hide paused' : 'Paused · ' + paused.length) + '</button>';
      if (S.showPaused) fold += '<div class="list">' + paused.map(row).join('') + '</div>';
    }
    return '<section class="card"><h2 class="card-title">People · ' + rows.length + '</h2>' +
      (tally ? '<div class="chips mid">' + tally + '</div>' : '') +
      (list ? '<div class="list">' + list + '</div>' : '<p class="fine center">' + (paused.length ? 'Everyone is paused.' : 'Nobody has an account yet.') + '</p>') + fold +
      '<p class="fine center">Real people only: the accounts made for the films and for Apple’s review are left out. A person’s texts open only when you ask for them.</p></section>';
  }
  // ONE PERSON'S TEXTS WITH THE COACH, asked for by a tap and never before.
  // The database records each opening. The answer lives in S.texts only.
  var TEXTS_FIRST = 40, TEXTS_MORE = 100;
  var textsTurn = 0;
  // Forgetting also makes any answer still in the air too late to be shown.
  function forgetTexts() { textsTurn++; S.texts = null; }
  function loadTexts(id, limit) {
    var mine = gen, turn = ++textsTurn;
    S.texts = { id: id, loading: true, data: S.texts && S.texts.id === id ? S.texts.data : null };
    drawSheet();
    rpc('owner_person_texts', { _user: id, _limit: limit }).then(function (r) {
      // Too late: the sheet was closed, the sign-in ended, or a newer read is in the air.
      if (mine !== gen || turn !== textsTurn) return;
      if (r.status === 401) { signedOut('You are signed out. Sign in again.'); return; }
      if (SECOND(r)) { needSecond(); return; }
      if (r.ok && r.data && r.data.texts) S.texts = { id: id, data: r.data, fresh: limit === TEXTS_FIRST };
      else S.texts = { id: id, failed: textsWhy(r), data: null };
      drawSheet();
    });
  }
  var kindWord = function (k) { return text(k).replace(/_/g, ' '); };
  function textsWhy(r) {
    if (r.status === 0) return 'No answer came back. Try again.';
    if (NOT_OWNER(r)) return 'This account is not the owner.';
    if (r.data && r.data.code === '22023' && r.data.message) return String(r.data.message);
    return 'The texts could not be read. Try again in a moment.';
  }

  function viewInvite() {
    var inv = S.people && S.people.invite;
    if (!inv || !inv.link) return '';
    return '<section class="card"><h2 class="card-title">Add a tester</h2>' +
      '<p class="fine center">Send a friend this link. They install the app and sign in with their own mobile number. You enter nothing.' +
      (inv.cap ? ' The link lets in ' + esc(inv.cap) + ' people in all.' : '') + '</p>' +
      '<button class="btn wide" data-act="invite">Copy invite link</button></section>';
  }

  /* ---------- coupons ---------- */
  // COUPONS (owner, Oct 13 2026: "make it easy for me to create, track, and
  // send credit coupons to my testflight users"). A coupon is a code a
  // tester types in the app (the DATA tab, COUNTABLE PLANS, Redeem a code): it
  // becomes AI credit on THEIR account when THEY redeem it. This page makes
  // the code and never touches anybody's plan or credit.
  //   owner_coupons_read    the coupons, WITHOUT their codes. Read after the
  //                         people, and never in their way.
  //   owner_coupon_show     the code of one, asked for by a tap. The database
  //                         records each showing. The answer lives in S.cshow
  //                         only, and is forgotten when the sheet closes.
  // SENT FROM HIS OWN MESSAGES: "Text it" is a link that opens a text with
  // the words filled in. He picks the person. This page never reads, asks
  // for or keeps anybody's number.
  // The place, in the app's own words: the tab, the row, the section.
  var COUPON_WHERE = 'DATA > COUNTABLE PLANS > Redeem a code';
  var COUPON_WORDS = { unused: 'Unused', used: 'Used', ended: 'Ended', cancelled: 'Cancelled' };
  var dollars = function (cents) { var n = (Number(cents) || 0) / 100; return '$' + (n === Math.round(n) ? String(n) : n.toFixed(2)); };
  var couponsTurn = 0, cshowTurn = 0;
  // Memory only, never stored: the coupons (no codes), ONE coupon's code while
  // its sheet is open, and whether the used and ended ones are unfolded.
  S.coupons = null; S.cshow = null; S.showCoupons = false;
  function forgetCoupons() { couponsTurn++; S.coupons = null; }
  // Forgetting also makes any answer still in the air too late to be shown.
  function forgetCoupon() { cshowTurn++; S.cshow = null; }
  function loadCoupons() {
    var mine = gen, turn = ++couponsTurn;
    rpc('owner_coupons_read', {}).then(function (r) {
      if (mine !== gen || turn !== couponsTurn) return;     // signed out, or a newer read is in the air
      if (r.ok && r.data && r.data.coupons && r.data.rules) S.coupons = r.data;
      else if (!S.coupons) S.coupons = { failed: true, missing: r.ok || r.status === 404 };
      if (S.stage === 'list') drawPage();
      // An open coupon is drawn again from what is now true (sent, used, cancelled).
      if (stack.length && stack[stack.length - 1].kind === 'coupon') drawSheet();
    });
  }
  function couponWhy(r) {
    if (r.status === 0) return 'No answer came back. Try again.';
    if (NOT_OWNER(r)) return 'This account is not the owner.';
    if (r.data && r.data.code === '22023' && r.data.message) return String(r.data.message);
    return 'That did not work. Try again in a moment.';
  }
  function loadCouponCode(id) {
    var mine = gen, turn = ++cshowTurn;
    S.cshow = { id: id, loading: true };
    drawSheet();
    rpc('owner_coupon_show', { _id: id }).then(function (r) {
      // Too late: the sheet was closed, the sign-in ended, or a newer read is in the air.
      if (mine !== gen || turn !== cshowTurn) return;
      if (r.status === 401) { signedOut('You are signed out. Sign in again.'); return; }
      if (SECOND(r)) { needSecond(); return; }
      if (r.ok && r.data && r.data.id === id) S.cshow = { id: id, data: r.data };
      else S.cshow = { id: id, failed: couponWhy(r) };
      drawSheet();
    });
  }
  function couponOf(id) { var C = S.coupons; return C && C.coupons ? C.coupons.filter(function (x) { return x.id === id; })[0] || null : null; }
  function couponWho(c) { return text(c.label) || text(c.for_name) || (c.by_hand ? 'Made before this page' : 'Nobody named'); }
  function couponLine(c) {
    if (c.state === 'used') return 'Used by ' + (text(c.used_name) || 'someone') + (c.used_at ? ' on ' + day(new Date(c.used_at)) : '');
    if (c.state === 'cancelled') return 'Cancelled' + (c.cancelled_at ? ' ' + day(new Date(c.cancelled_at)) : '') + ', never used';
    if (c.state === 'ended') return 'Ended' + (c.ends_at ? ' ' + day(new Date(c.ends_at)) : '') + ', never used';
    // One made by hand before the page may have been handed out already: the page cannot know.
    return (c.sent_at ? 'Sent ' + day(new Date(c.sent_at)) : c.by_hand ? 'Made by hand ' + day(new Date(c.made_at)) : 'Not sent yet') + (c.ends_at ? ' · ends ' + day(new Date(c.ends_at)) : '');
  }
  // The text he sends. Its words name the place in the app as the app does.
  // SHORT, WITH THE CODE ON A LINE OF ITS OWN (owner, Oct 14 2026: "the text
  // for my friends is too long and it will be hard to copy and paste the
  // code. make sure it simply but clearly references where you can input the
  // codes"). The code is one six-letter word, easy to read and type. Where it
  // goes: in setup, I HAVE A CODE on the plan options; afterwards, the box in
  // DATA. His own note, if he wrote one, goes first. It is held with the open
  // sheet only: never sent to the database, never stored, gone when the sheet
  // closes.
  function couponMessage(c, code, link, note) {
    var lines = [], mine = text(note).trim();
    if (mine) lines.push(mine, '');
    lines.push('Here is ' + dollars(c.cents) + ' of CountAble Premium, on me!');
    if (link) lines.push('Get the app: ' + link);
    lines.push('Your code: ' + code + (c.ends_at ? ' (good until ' + day(new Date(c.ends_at)) + ')' : ''));
    lines.push('In setup, pick Premium, then tap I HAVE A CODE. Already set up? ' + COUPON_WHERE + '.');
    return lines.join('\n');
  }
  // The text as the open coupon sheet would send it: his note, and the
  // install link unless he took it off.
  function couponWords(top, c, code) {
    var inv = S.people && S.people.invite, link = !top.nolink && inv && inv.link ? text(inv.link) : '';
    return couponMessage(c, code, link, top.note);
  }
  // iOS wants `&body=` (the same shape the app's own invite uses).
  function smsLink(body) { return 'sms:&body=' + encodeURIComponent(body); }
  function couponRow(c) {
    return '<button class="row" data-act="coupon" data-id="' + esc(c.id) + '"><span class="grow"><b>' + esc(dollars(c.cents)) + ' · ' + esc(couponWho(c)) + '</b><small>' + esc(couponLine(c)) + '</small></span>' +
      '<span class="chip' + (c.state === 'unused' ? (c.sent_at ? ' on' : '') : c.state === 'used' ? ' gold' : '') + '">' + esc(c.state === 'unused' && c.sent_at ? 'Sent' : COUPON_WORDS[c.state] || text(c.state)) + '</span><i class="chev"></i></button>';
  }
  function viewCoupons() {
    var C = S.coupons;
    if (!C || C.missing || !(S.people && S.people.people)) return '';
    if (C.failed) return '<section class="card"><h2 class="card-title">Coupons</h2><p class="fine center">The coupons could not be read just now. Nothing else is affected.</p></section>';
    var R = C.rules, sum = function (list) { return list.reduce(function (n, c) { return n + (Number(c.cents) || 0); }, 0); };
    var open = C.coupons.filter(function (c) { return c.state === 'unused'; });
    var used = C.coupons.filter(function (c) { return c.state === 'used'; });
    var over = C.coupons.filter(function (c) { return c.state !== 'unused' && c.state !== 'used'; });
    var waiting = open.filter(function (c) { return !c.sent_at && !c.by_hand; }).length;
    var chips = '<span class="chip">' + open.length + ' unused · ' + esc(dollars(sum(open))) + '</span>' +
      (waiting ? '<span class="chip warn">' + waiting + ' not sent</span>' : '') +
      '<span class="chip gold">' + used.length + ' used · ' + esc(dollars(sum(used))) + '</span>';
    var past = used.concat(over), older = '';
    if (past.length) {
      older = '<button class="link" data-act="cpast">' + (S.showCoupons ? 'Hide used and ended' : 'Used and ended · ' + past.length) + '</button>';
      if (S.showCoupons) older += '<div class="list">' + past.map(couponRow).join('') + '</div>';
    }
    return '<section class="card"><h2 class="card-title">Coupons · ' + open.length + ' unused</h2>' +
      '<div class="chips mid">' + chips + '</div>' +
      '<p class="fine center">AI credit a tester adds in the app under ' + esc(COUPON_WHERE) + '. You send it from your own Messages.</p>' +
      (open.length ? '<div class="list">' + open.map(couponRow).join('') + '</div>' : '<p class="fine center">No unused coupons.</p>') +
      '<button class="btn amber wide" data-act="cmake">Make a coupon</button>' +
      '<p class="fine center">' + esc(dollars(R.room_cents)) + ' of room left: at most ' + esc(dollars(R.unused_cap_cents)) + ' of unused coupons can be out at once.</p>' +
      viewWords(R) + older + '</section>';
  }
  // TEN CODE WORDS AT A TIME (owner, Oct 15 2026: "just store 10 words codes
  // at a time for now but give me a button on the dashboard for minting 10
  // more"). How many are ready to go on coupons, never which: the words
  // themselves stay in the database until a coupon carries one. MINT 10 MORE
  // works once the ready ones are used.
  function viewWords(R) {
    if (R.words_ready == null) return '';
    var ready = Number(R.words_ready) || 0, batch = Number(R.words_batch) || 10;
    return '<p class="fine center">' + (ready ? esc(ready + ' of ' + batch + ' code words ready.') : esc('No code words ready. Mint ' + batch + ' more to make a coupon.')) + '</p>' +
      '<button class="btn wide" data-act="cmint"' + (ready ? ' disabled' : '') + '>' + esc('Mint ' + batch + ' more') + '</button>';
  }

  /* ---------- the coach ---------- */
  // THE COACH TAB (owner, Oct 13 2026: "a tab that in real time shows ... what
  // is in mpmaynard's coach harness and its capabilities"). Two reads, asked
  // for when the tab is opened and never before:
  //   owner_coach_read   WHAT RAN: every model call the log holds, by job, by
  //                      model, by person, with what it read, wrote and cost.
  //                      The log holds sizes and costs, never anyone's words.
  //   owner-coach        WHAT THE COACH IS MADE OF: for each job, the model it
  //                      resolves to right now and, in plain words, what it is
  //                      shown and what it may change.
  // The page then checks one against the other and says where they differ.
  var COACH_DAYS = [1, 7, 30];
  var coachTurn = 0;
  var grouped = function (n) { return Math.round(Number(n) || 0).toLocaleString('en-US'); };
  var compact = function (n) {
    n = Number(n) || 0;
    if (n >= 1000000) return (Math.round(n / 100000) / 10) + 'M';
    if (n >= 10000) return Math.round(n / 1000) + 'K';
    return grouped(n);
  };
  // A cost kept in cents, some of them fractions of one.
  var money = function (cents) {
    cents = Number(cents) || 0;
    if (cents > 0 && cents < 1) return 'under 1¢';
    return usd(cents / 100);
  };
  var secs = function (ms) { return ms == null ? '' : (Math.round(Number(ms) / 100) / 10) + ' s'; };
  var plural = function (n, one, many) { return grouped(n) + ' ' + (Number(n) === 1 ? one : many); };
  var sameModel = function (a, b) { a = text(a); b = text(b); return !!a && !!b && (a === b || a.indexOf(b) === 0 || b.indexOf(a) === 0); };
  // A job's name: the sheet's, or its label with the underscores taken out.
  function sheetJob(kind) {
    var sh = S.coach && S.coach.sheet;
    return sh && sh.jobs ? sh.jobs.filter(function (j) { return j.kind === kind; })[0] || null : null;
  }
  function jobName(kind) { var j = sheetJob(kind); return j ? j.name : text(kind).replace(/_/g, ' '); }
  // Why a call did not run, in his words.
  function reasonWords(reason) {
    var r = text(reason);
    if (r.indexOf('call_cap:') === 0) return 'Stopped by the daily limit on calls';
    if (r.indexOf('token_budget:') === 0) return 'Stopped by the day’s token allowance';
    if (r.indexOf('retrying:') === 0) return 'Failed once and was tried again';
    return {
      credits_exhausted: 'The AI account was out of credits',
      ai_paused: 'AI was paused by the kill switch',
      breaker_open: 'Paused after repeated failures',
      global_cap: 'Stopped by the limit across everyone',
      global_token_cap: 'Stopped by the token limit across everyone',
      ai_disabled: 'Live AI was switched off',
      exception: 'The function failed before the model answered',
      unknown: 'No reason was recorded'
    }[r] || r;
  }
  var STOP_WORDS = { end_turn: 'Finished', max_tokens: 'Ran out of room', length: 'Ran out of room', tool_use: 'Filled in its form', stop_sequence: 'Finished' };
  var RUNG_WORDS = { R0: 'Full', R1: 'Trimmed (half the day’s allowance used)', R2: 'Trimmed, on the lighter model', R3: 'No model' };

  function loadCoach() {
    var mine = gen, turn = ++coachTurn;
    var had = S.coach || {};
    S.coach = { loading: true, data: had.data || null, sheet: had.sheet || null, sheetState: had.sheetState || '' };
    if (S.stage === 'list') drawPage();
    rpc('owner_coach_read', { _user: S.coachWho || null, _days: S.coachDays }).then(function (r) {
      if (mine !== gen || turn !== coachTurn || !S.coach) return;
      if (r.status === 401) { signedOut('You are signed out. Sign in again.'); return; }
      if (SECOND(r)) { needSecond(); return; }
      S.coach.loading = false;
      if (r.ok && r.data && r.data.totals) { S.coach.data = r.data; S.coach.failed = ''; }
      else S.coach.failed = r.status === 404 ? 'missing' : (r.status === 0 ? 'No answer came back. Tap Refresh.' : 'What ran could not be read just now.');
      if (S.stage === 'list') drawPage();
    });
    // The sheet is asked for once, and again only when he taps Refresh: the
    // one already here stays on screen until the new one arrives.
    if (S.coach.sheet && !had.stale) return;
    authed('/functions/v1/owner-coach', {}).then(function (r) {
      if (mine !== gen || !S.coach) return;
      if (r.ok && r.data && r.data.sheet && r.data.sheet.jobs) { S.coach.sheet = r.data.sheet; S.coach.sheetState = ''; }
      else if (!S.coach.sheet) S.coach.sheetState = r.status === 404 ? 'missing' : 'failed';
      if (S.stage === 'list') { drawPage(); if (stack.length) drawSheet(); }
    });
  }
  function forgetCoachTab() { coachTurn++; S.coach = null; S.coachWho = null; }

  // Who a call was for. An account made for a film, a demo or a test is not
  // a person: the database sends its calls with no name and no id, and they
  // are shown as a demo account's. The dashboard names real people only.
  function callWho(c) { return c.who || (c.demo ? 'A demo account' : c.team ? 'A team' : (c.user ? 'No name yet' : 'The system')); }
  function callRow(c) {
    var who = callWho(c);
    var bad = c.outcome !== 'ok';
    var line = bad ? reasonWords(c.reason)
      : (c.model || 'no model') + ' · read ' + grouped(c.in) + ' · wrote ' + grouped(c.out) + ' · ' + money(c.cost_cents);
    return '<button class="row" data-act="call" data-id="' + esc(c.id) + '"><span class="grow"><b>' + esc(jobName(c.kind)) + ' · ' + esc(who) + '</b>' +
      '<small>' + esc(when(c.at)) + ' · ' + esc(line) + '</small></span>' +
      (c.outcome === 'error' ? '<span class="chip bad">Failed</span>' : c.outcome === 'blocked' ? '<span class="chip warn">Blocked</span>' : c.cut_short ? '<span class="chip warn">Cut short</span>' : '') +
      '<i class="chev"></i></button>';
  }
  // Where the log and the sheet disagree about a job's model, in this window.
  function modelNotes(D, sh) {
    if (!D || !sh || !sh.jobs) return [];
    return D.jobs.map(function (j) {
      var s = sh.jobs.filter(function (x) { return x.kind === j.kind; })[0];
      if (!s) return j.calls ? 'A job the sheet does not know ran: ' + text(j.kind).replace(/_/g, ' ') + '.' : '';
      var other = (j.models || []).filter(function (m) { return !sameModel(m, s.model) && !sameModel(m, s.model_lite); });
      return other.length ? s.name + ' also ran on ' + other.join(' and ') + '.' : '';
    }).filter(Boolean);
  }
  // The page's tabs, two to a row. Costs and Marketing (Oct 14 2026) are the
  // two documents, by the name each has in the database.
  var TABS = [{ id: 'home', name: 'Dashboard' }, { id: 'coach', name: 'Coach' }, { id: 'cost', name: 'Costs' }, { id: 'marketing', name: 'Marketing' }];
  var DOC_TABS = { cost: 'Costs', marketing: 'Marketing' };
  var isDocTab = function (id) { return Object.prototype.hasOwnProperty.call(DOC_TABS, id); };
  function viewTabs() {
    return '<div class="pair tabs">' + TABS.map(function (t) {
      return '<button class="btn small' + (S.tab === t.id ? ' on' : '') + '" data-act="tab" data-id="' + t.id + '">' + t.name + '</button>';
    }).join('') + '</div>';
  }
  function viewCoach() {
    var C = S.coach || {}, D = C.data, sh = C.sheet;
    if (!D) {
      if (C.failed === 'missing') return '<section class="card"><h2 class="card-title">The coach</h2><p class="fine center">This is not switched on yet.</p></section>';
      return '<section class="card"><h2 class="card-title">The coach</h2><p class="fine center">' + (C.failed ? esc(C.failed) : 'Reading.') + '</p></section>';
    }
    var T = D.totals, person = D.person;
    var span = '<div class="three">' + COACH_DAYS.map(function (n) {
      return '<button class="btn small' + (S.coachDays === n ? ' on' : '') + '" data-act="coachdays" data-id="' + n + '">' + (n === 1 ? '1 day' : n + ' days') + '</button>';
    }).join('') + '</div>';
    var chips = (T.errors ? '<span class="chip bad num">' + grouped(T.errors) + ' failed</span>' : '') +
      (T.blocked ? '<span class="chip warn num">' + grouped(T.blocked) + ' blocked</span>' : '') +
      (T.cut_short ? '<span class="chip warn num">' + grouped(T.cut_short) + ' cut short</span>' : '');
    var head = '<section class="card"><h2 class="card-title">The coach · last ' + (D.days === 1 ? 'day' : D.days + ' days') + '</h2>' + span +
      (person ? '<p class="fine center">Only ' + esc(person.name || 'this person') + '.</p><button class="link" data-act="coachall">Show everyone</button>' : '') +
      '<p class="stat' + (T.errors ? '' : ' calm') + '">' + esc(money(T.cost_cents)) + ' · ' + esc(plural(T.calls, 'call', 'calls')) + '</p>' +
      (chips ? '<div class="chips mid">' + chips + '</div>' : '') +
      '<p class="fine center">It read ' + esc(compact(T.tokens_in)) + ' tokens and wrote ' + esc(compact(T.tokens_out)) + '. A token is about three quarters of a word.</p>' +
      (D.demo && D.demo.calls ? '<p class="fine center">Of that, ' + esc(plural(D.demo.calls, 'call', 'calls')) + ' (' + esc(money(D.demo.cost_cents)) + ') were demo accounts: the ones the films are shot on and Apple’s reviewers sign in with. They are counted because they cost real money, and named nowhere.</p>' : '') +
      (C.failed ? '<p class="msg-line warn" role="alert">' + esc(C.failed) + '</p>' : '') + '</section>';

    var trouble = '';
    if (D.problems.length || T.cut_short) {
      var cut = D.jobs.filter(function (j) { return j.cut_short; }).map(function (j) { return jobName(j.kind) + ' ' + j.cut_short; });
      trouble = '<section class="card verdict"><h2 class="card-title">Needs a look</h2><div class="list">' +
        D.problems.map(function (p) {
          return '<div class="row"><span class="grow"><b>' + esc(reasonWords(p.reason)) + '</b><small>' + esc(plural(p.calls, 'time', 'times')) + ' · ' +
            esc((p.jobs || []).map(jobName).join(', ')) + ' · last ' + esc(when(p.last_at)) + '</small></span>' +
            '<span class="chip ' + (p.outcome === 'error' ? 'bad' : 'warn') + '">' + (p.outcome === 'error' ? 'Failed' : 'Blocked') + '</span></div>';
        }).join('') +
        (T.cut_short ? '<div class="row"><span class="grow"><b>Ran out of room before finishing</b><small>' + esc(cut.join(', ')) + '</small></span><span class="chip warn">Cut short</span></div>' : '') +
        '</div></section>';
    }

    var jobs = D.jobs.map(function (j) {
      var flag = j.errors ? '<span class="chip bad num">' + j.errors + ' failed</span>' : (j.blocked || j.cut_short) ? '<span class="chip warn num">' + (j.blocked ? j.blocked + ' blocked' : j.cut_short + ' cut short') + '</span>' : '';
      return '<button class="row" data-act="job" data-id="' + esc(j.kind) + '"><span class="grow"><b>' + esc(jobName(j.kind)) + '</b><small>' +
        esc(plural(j.calls, 'call', 'calls')) + ((j.models || []).length ? ' · ' + esc(j.models.join(', ')) : '') + ' · ' + esc(money(j.cost_cents)) + '</small></span>' + flag + '<i class="chev"></i></button>';
    }).join('');
    var ran = {};
    D.jobs.forEach(function (j) { ran[j.kind] = true; });
    var idle = sh && sh.jobs ? sh.jobs.filter(function (j) { return !ran[j.kind]; }) : [];
    var idleList = idle.length ? '<button class="link" data-act="coachidle">' + (S.coachIdle ? 'Hide the rest' : 'Jobs that did not run · ' + idle.length) + '</button>' +
      (S.coachIdle ? '<div class="list">' + idle.map(function (j) {
        return '<button class="row" data-act="job" data-id="' + esc(j.kind) + '"><span class="grow"><b>' + esc(j.name) + '</b><small>' + esc(j.family) + ' · ' + esc(j.model) + '</small></span><i class="chev"></i></button>';
      }).join('') + '</div>' : '') : '';
    var jobsCard = '<section class="card"><h2 class="card-title">Jobs · ' + D.jobs.length + '</h2>' +
      '<p class="fine center">Each thing the coach does, costliest first. Tap one to see what it is shown and what it may change.</p>' +
      (jobs ? '<div class="list">' + jobs + '</div>' : '<p class="fine center">Nothing ran in this time.</p>') + idleList + '</section>';

    var models = '';
    if (sh && sh.jobs) {
      var of = function (kind) { var j = sh.jobs.filter(function (x) { return x.kind === kind; })[0]; return j ? j.model : ''; };
      var lite = function (kind) { var j = sh.jobs.filter(function (x) { return x.kind === kind; })[0]; return j ? j.model_lite : ''; };
      var kv = function (k, v) { return v ? '<div class="kv"><span>' + esc(k) + '</span><b>' + esc(v) + '</b></div>' : ''; };
      var notes = modelNotes(D, sh);
      var set = (sh.switches || []).filter(function (x) { return x.set && x.name.indexOf('AI_MODEL') === 0 || x.set && x.name.indexOf('AI_EFFORT') === 0; });
      models = '<section class="card"><h2 class="card-title">Models right now</h2><div class="list">' +
        kv('Texts', of('reply')) + kv('Plans', of('plan')) + kv('The star', of('day_rework')) + kv('Weekly review', of('reflection')) + kv('Team texts', of('group_reply')) +
        kv('A reply trimmed to save', lite('reply')) + kv('Provider', sh.provider) +
        set.map(function (x) { return kv('Set on the dashboard: ' + x.name, x.value || 'set'); }).join('') + '</div>' +
        '<p class="fine center">' + (notes.length ? esc('In this time: ' + notes.join(' ')) : 'Checked against the log: every job ran on a model this sheet names.') + '</p>' +
        '<p class="fine center">Sheet ' + esc(sh.version) + ' · app facts ' + esc(sh.facts_version) + '</p></section>';
    } else if (C.sheetState === 'failed') {
      models = '<section class="card"><h2 class="card-title">Models right now</h2><p class="fine center">The sheet could not be read just now. What ran, above, is not affected.</p></section>';
    }

    var people = !person && D.people.length ? '<section class="card"><h2 class="card-title">Who it ran for</h2><div class="list">' + D.people.map(function (p) {
      return '<button class="row" data-act="coachwho" data-id="' + esc(p.id) + '"><span class="grow"><b>' + esc(p.name || 'No name yet') + '</b><small>' + esc(plural(p.calls, 'call', 'calls')) + '</small></span><span class="chip num">' + esc(money(p.cost_cents)) + '</span><i class="chev"></i></button>';
    }).join('') + '</div><p class="fine center">Real people only. Tap one to see only what ran for them. Timers, team texts and demo accounts are not anyone’s.</p></section>' : '';

    var shown = S.coachAll ? D.recent : D.recent.slice(0, 12);
    var recent = '<section class="card"><h2 class="card-title">Recent calls</h2>' +
      (shown.length ? '<div class="list">' + shown.map(callRow).join('') + '</div>' : '<p class="fine center">Nothing ran in this time.</p>') +
      (D.recent.length > 12 ? '<button class="link" data-act="coachmore">' + (S.coachAll ? 'Show fewer' : 'Show the last ' + D.recent.length) + '</button>' : '') +
      '<p class="fine center">The log keeps sizes, costs and how each call ended. It does not keep what was sent to the model or what it wrote.</p></section>';

    var days = D.by_day.length > 1 ? '<section class="card"><h2 class="card-title">By day</h2><div class="list">' + D.by_day.slice().reverse().map(function (x) {
      return '<div class="kv"><span>' + esc(day(fromIso(x.day))) + ' · ' + esc(plural(x.calls, 'call', 'calls')) + '</span><b>' + esc(money(x.cost_cents)) + '</b></div>';
    }).join('') + '</div></section>' : '';

    return head + trouble + jobsCard + recent + people + models + days;
  }

  // WHY DID IT WRITE THAT (owner, Oct 13 2026). For a plan or a star write,
  // what the model was given and what it wrote (owner_write_trace). Sizes for
  // anyone; the words for the owner's own account only, and the database
  // records an opening that shows them. Asked for by a tap; memory only;
  // forgotten when its sheet closes.
  var TRACED = { plan: true, day_rework: true };
  var traceTurn = 0;
  function forgetTrace() { traceTurn++; S.trace = null; }
  function loadTrace(id) {
    var mine = gen, turn = ++traceTurn;
    S.trace = { id: id, loading: true };
    drawSheet();
    rpc('owner_write_trace', { _call: Number(id) }).then(function (r) {
      if (mine !== gen || turn !== traceTurn) return;
      if (r.status === 401) { signedOut('You are signed out. Sign in again.'); return; }
      if (SECOND(r)) { needSecond(); return; }
      if (r.ok && r.data && r.data.call !== undefined) S.trace = { id: id, data: r.data, open: {} };
      else S.trace = { id: id, failed: r.status === 404 ? 'This is not switched on yet.' : textsWhy(r).replace('The texts', 'The record') };
      drawSheet();
    });
  }
  // A long message is cut where it starts a new subject: a line that begins
  // with one of the writers' own headings, or a line in capitals. Nothing is
  // dropped or reordered: the pieces, joined, are the message.
  var HEADS = ['Athlete:', 'Goals & preferences:', 'Weekly challenges that MUST', 'Upcoming events to train for:', 'Apple Health device data', 'Previously APPROVED AI plans',
    'Accumulated requests this iteration', 'Newest request', 'Current draft being remixed', 'Generate workouts for these',
    'User\'s description of what this workout should be', 'Workout title:', 'Previous notes', 'Athlete profile:', 'Plan notes from'];
  function isHead(line) {
    for (var i = 0; i < HEADS.length; i++) if (line.indexOf(HEADS[i]) === 0) return true;
    return /^(?:TIER \d|[A-Z][A-Z0-9 ,'&()-]{9,}[A-Z)](?:[:(]|\s[(—-]|$))/.test(line);
  }
  function traceSections(message) {
    var lines = text(message).split('\n'), out = [], cur = null;
    lines.forEach(function (line, i) {
      if (!cur || isHead(line)) { cur = { head: line.slice(0, 70), lines: [] }; out.push(cur); }
      cur.lines.push(line);
    });
    return out.map(function (s) { return { head: s.head, body: s.lines.join('\n') }; });
  }

  // ONE PERSON'S COACH: their coach's voice and dials, the weekly reviews
  // that ran for them, and (for the owner's own account) the coach's notebook.
  // Asked for by a tap; the database records an opening that shows a notebook;
  // the answer lives in memory only and is forgotten when its sheet closes.
  var pcoachTurn = 0;
  function forgetCoach() { pcoachTurn++; S.pcoach = null; }
  function loadPersonCoach(id) {
    var mine = gen, turn = ++pcoachTurn;
    S.pcoach = { id: id, loading: true };
    drawSheet();
    rpc('owner_person_coach', { _user: id }).then(function (r) {
      if (mine !== gen || turn !== pcoachTurn) return;
      if (r.status === 401) { signedOut('You are signed out. Sign in again.'); return; }
      if (SECOND(r)) { needSecond(); return; }
      if (r.ok && r.data && r.data.id) S.pcoach = { id: id, data: r.data, open: {} };
      else S.pcoach = { id: id, failed: r.status === 404 ? 'This is not switched on yet.' : textsWhy(r).replace('The texts', 'Their coach') };
      drawSheet();
    });
  }
  var NB_ORDER = ['summary', 'coaching_brief', 'judgment', 'week_review', 'next_week_plan_seed', 'week_shape', 'insights', 'goal_campaigns', 'declared_goals', 'long_term_goals',
    'capabilities', 'preferences', 'constraints', 'standing_rules', 'coaching_notes', 'followups', 'memory'];
  var nbWords = function (k) { var w = text(k).replace(/_/g, ' '); return w.charAt(0).toUpperCase() + w.slice(1); };
  // A PLAN WITH NO WEEKLY REVIEW IS NOT A REVIEW THAT FAILED (Oct 13 2026: two
  // real people read "Failed" and "Not owed" here, above "no notebook yet").
  // Free and Basic have no weekly review (limits.ts ai_reflection). Since Oct 6
  // 2026 the job closes such a week `not_owed`; before that every try stopped
  // at the plan's own gate and was kept as `failed` with this error, which the
  // report and the alarm already read as "not in the plan" (report_email.ts
  // REVIEW_NOT_IN_PLAN_ERROR, watchdog.ts reviewRunsOwed). On Premium the same
  // error is the week's tries running out, which IS a failure, and a plan the
  // page does not know is never guessed at.
  var REVIEW_NOT_IN_PLAN_ERROR = 'daily_limit_hit';
  function noReviewInPlan(tier) { return tier === 'free' || tier === 'basic'; }
  function reviewNotInPlan(r, tier) {
    return r.status === 'not_owed' || (r.status === 'failed' && r.error === REVIEW_NOT_IN_PLAN_ERROR && noReviewInPlan(tier));
  }
  // A CODE WHOSE CREDIT IS SPENT (owner, Oct 13 2026: "the weekly review should
  // not ignore spend credit"). The week is closed the same way and its row
  // carries this note (review_credit.ts REVIEW_CREDIT_SPENT). It is asked
  // first: the plan is Premium, so "not in their plan" would be untrue.
  var REVIEW_CREDIT_SPENT = 'credit_spent';
  function reviewCreditSpent(r) { return r.status === 'not_owed' && r.error === REVIEW_CREDIT_SPENT; }
  // The notebook is whatever the coach wrote, so it is drawn by its shape: a
  // line, a list, or named parts. Every word is escaped.
  function nbValue(v, depth) {
    if (v === null || v === undefined || v === '') return '';
    if (typeof v !== 'object') return '<p>' + esc(v) + '</p>';
    if (depth > 6) return '<p>' + esc(JSON.stringify(v)) + '</p>';
    if (Array.isArray(v)) {
      var items = v.map(function (x) { var inner = x !== null && typeof x === 'object' ? nbValue(x, depth + 1) : (x === null || x === '' ? '' : '<p>' + esc(x) + '</p>'); return inner ? '<li>' + inner + '</li>' : ''; }).join('');
      return items ? '<ul class="nb">' + items + '</ul>' : '';
    }
    return Object.keys(v).map(function (k) {
      var inner = nbValue(v[k], depth + 1);
      return inner ? '<div class="nbk"><span class="micro muted">' + esc(nbWords(k)) + '</span>' + inner + '</div>' : '';
    }).join('');
  }

  /* ---------- the documents ---------- */
  // THE COSTS AND MARKETING TABS (owner, Oct 14 2026). One read,
  // owner_docs_read: the newest version of each document. Asked for when one
  // of the two tabs is opened (and again with the list while one is showing),
  // never before. The answer lives in S.docs only: never in the browser's
  // storage, and forgotten at every sign-out. Nothing here writes.
  var docsTurn = 0;
  // Forgetting also makes any answer still in the air too late to be shown.
  function forgetDocs() { docsTurn++; S.docs = null; }
  function loadDocs() {
    var mine = gen, turn = ++docsTurn;
    S.docs = { loading: true, data: S.docs ? S.docs.data : null };
    if (S.stage === 'list') drawPage();
    rpc('owner_docs_read', {}).then(function (r) {
      if (mine !== gen || turn !== docsTurn || !S.docs) return;
      if (r.status === 401) { signedOut('You are signed out. Sign in again.'); return; }
      if (SECOND(r)) { needSecond(); return; }
      S.docs.loading = false;
      if (r.ok && r.data && Array.isArray(r.data.docs)) { S.docs.data = r.data; S.docs.failed = ''; }
      else S.docs.failed = r.status === 404 ? 'This is not switched on yet.' : r.status === 0 ? 'No answer came back. Tap Refresh.'
        : NOT_OWNER(r) ? 'This account is not the owner.' : 'The documents could not be read just now.';
      if (S.stage === 'list') drawPage();
    });
  }
  function viewDoc(slug) {
    var D = S.docs || {}, name = esc(DOC_TABS[slug]);
    if (!D.data) return '<section class="card"><h2 class="card-title">' + name + '</h2><p class="fine center">' + esc(D.failed || 'Reading.') + '</p></section>';
    var d = D.data.docs.filter(function (x) { return x && x.slug === slug; })[0];
    if (!d) {
      return '<section class="card"><h2 class="card-title">' + name + '</h2><p class="fine center">Not loaded yet.</p>' +
        '<p class="fine center">It is loaded from the Mac, and shows here at the next Refresh.</p></section>';
    }
    return '<section class="card doc"><p class="micro muted center">' + esc('Loaded ' + when(d.created_at) + ' · version ' + text(d.version)) + '</p>' +
      '<div class="md">' + md(d.body) + '</div>' +
      (D.failed ? '<p class="msg-line warn" role="alert">' + esc(D.failed) + '</p>' : '') +
      '<p class="fine center">Read only. A new version is loaded from the Mac.</p></section>';
  }

  // A SMALL MARKDOWN READER, for the two documents. The stored words are
  // DATA, never markup: every piece of them goes through esc() before any
  // tag is put round it, so nothing in a document can add an element, an
  // attribute, a script or a style. A link is drawn only to an http(s)
  // address, opens on its own (rel=noopener), and anything else in a link
  // is shown as its words. What it reads: headings, paragraphs, bold,
  // italics, `code`, links, lists (numbered, bulleted, ticked, nested),
  // tables (in a box that scrolls sideways on a phone, so the page itself
  // never does), quotes, rules, and fenced code (kept as written).
  var MD_FENCE = /^\s{0,3}(`{3,}|~{3,})/;
  var MD_HEAD = /^\s{0,3}(#{1,6})[ \t]+(.*?)[ \t#]*$/;
  var MD_RULE = /^\s{0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/;
  var MD_ITEM = /^(\s*)([-*+]|\d{1,9}[.)])[ \t]+(.*)$/;
  var MD_QUOTE = /^\s{0,3}>[ ]?(.*)$/;
  var MD_ROW = /^\s*\|.*\|\s*$/;
  var MD_SEP = /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)*\|?\s*$/;
  var MD_DEPTH = 8;
  var mdBlank = function (l) { return !/\S/.test(l); };
  // A line that begins a block of its own, and so ends a paragraph.
  var mdStarts = function (l) { return MD_FENCE.test(l) || MD_HEAD.test(l) || MD_RULE.test(l) || MD_ITEM.test(l) || MD_QUOTE.test(l) || MD_ROW.test(l); };
  function md(source) { return mdBlocks(text(source).replace(/\u0000/g, '').replace(/\r\n?/g, '\n').split('\n'), 0); }
  // Bold and italics, on words that are already escaped.
  function mdEmph(s) {
    return esc(s)
      .replace(/\*\*(?=\S)([\s\S]*?\S)\*\*/g, '<b>$1</b>')
      .replace(/(^|[^\w*])\*(?=\S)([^*]*?\S)\*(?![\w*])/g, '$1<i>$2</i>')
      .replace(/(^|[^\w])_(?=[^\s_])([^_]*?[^\s_])_(?!\w)/g, '$1<i>$2</i>');
  }
  // Links: [words](https://…). The address is checked BEFORE it is escaped
  // into the attribute, and only http and https are ever made a link.
  function mdLinks(s) {
    var out = '', last = 0, m, re = /\[([^\]]*)\]\(([^()\s]*)\)/g;
    while ((m = re.exec(s))) {
      out += mdEmph(s.slice(last, m.index));
      out += /^https?:\/\/[^\s"'<>`\\\u0000]+$/i.test(m[2])
        ? '<a href="' + esc(m[2]) + '" target="_blank" rel="noopener noreferrer">' + mdEmph(m[1] || m[2]) + '</a>'
        : mdEmph(m[1] || m[2]);
      last = re.lastIndex;
    }
    return out + mdEmph(s.slice(last));
  }
  // A line's words: `code` is set aside first (kept exactly, escaped) and
  // stands in as a numbered mark, so bold can run across it; then links,
  // bold and italics; then each mark is given back its code.
  function mdInline(s) {
    var codes = [];
    var marked = text(s).replace(/\u0000/g, '').replace(/`([^`]+)`/g, function (all, c) {
      codes.push('<code>' + esc(c) + '</code>');
      return '\u0000' + (codes.length - 1) + '\u0000';
    });
    return mdLinks(marked).replace(/\u0000(\d+)\u0000/g, function (all, k) { return codes[Number(k)] || ''; });
  }
  // A table row's cells: split on | (not inside `code`, not an escaped \|).
  function mdCells(line) {
    var s = line.trim().replace(/^\|/, '').replace(/\|$/, ''), cells = [], cur = '', code = false;
    for (var k = 0; k < s.length; k++) {
      var c = s.charAt(k);
      if (c === '\\' && s.charAt(k + 1) === '|') { cur += '|'; k++; continue; }
      if (c === '`') code = !code;
      if (c === '|' && !code) { cells.push(cur.trim()); cur = ''; continue; }
      cur += c;
    }
    cells.push(cur.trim());
    return cells;
  }
  function mdTable(head, rows) {
    var w = head.length;
    var fit = function (r) { var x = r.slice(0, w); while (x.length < w) x.push(''); return x; };
    var cells = function (r, tag) { return fit(r).map(function (c) { return '<' + tag + '>' + mdInline(c) + '</' + tag + '>'; }).join(''); };
    // Five columns or more cannot fit a phone: their columns are kept wide
    // enough to read, and the box scrolls.
    return '<div class="md-table' + (w >= 5 ? ' wide' : '') + '"><table><thead><tr>' + cells(head, 'th') + '</tr></thead><tbody>' +
      rows.map(function (r) { return '<tr>' + cells(r, 'td') + '</tr>'; }).join('') + '</tbody></table></div>';
  }
  // A list, from line i: its items, each with the lines that belong to it
  // (a wrapped line, a second paragraph, a list inside it). Answers the
  // markup and the line after the list.
  function mdList(lines, i, depth) {
    var n = lines.length, first = MD_ITEM.exec(lines[i]), m;
    var indent = first[1].length, ordered = /\d/.test(first[2]), start = ordered ? parseInt(first[2], 10) : 1;
    var sibling = function (x) { return !!x && x[1].length <= indent + 1 && /\d/.test(x[2]) === ordered; };
    var items = [], cur = null;
    while (i < n) {
      var line = lines[i];
      m = MD_ITEM.exec(line);
      if (sibling(m)) { cur = { lines: [m[3]], pad: m[1].length + m[2].length + 1 }; items.push(cur); i++; continue; }
      if (m && m[1].length <= indent + 1) break;                     // a list of the other kind begins
      if (mdBlank(line)) {
        // A blank line: the list goes on only if what comes next is another
        // item or is indented under this one.
        var j = i; while (j < n && mdBlank(lines[j])) j++;
        if (j < n && (sibling(MD_ITEM.exec(lines[j])) || lines[j].match(/^\s*/)[0].length >= cur.pad)) { while (i < j) { cur.lines.push(''); i++; } continue; }
        break;
      }
      var lead = line.match(/^\s*/)[0].length;
      if (lead > indent) { cur.lines.push(line.slice(Math.min(lead, cur.pad))); i++; continue; }
      if (!mdStarts(line)) { cur.lines.push(line.trim()); i++; continue; }   // a wrapped line that was not indented
      break;
    }
    var html = items.map(function (it) {
      var ls = it.lines, tick = /^\[([ xX])\][ \t]+/.exec(ls[0]), box = '';
      if (tick) { box = '<span class="md-box' + (tick[1] === ' ' ? '' : ' done') + '" aria-hidden="true"></span>'; ls = [ls[0].slice(tick[0].length)].concat(ls.slice(1)); }
      var simple = ls.every(function (l, k) { return !mdBlank(l) && (k === 0 || !mdStarts(l)); });
      var inner = simple || depth >= MD_DEPTH ? mdInline(ls.map(function (l) { return l.trim(); }).join(' ')) : mdBlocks(ls, depth + 1);
      return '<li' + (tick ? ' class="md-task"' : '') + '>' + box + inner + '</li>';
    }).join('');
    return { html: ordered ? '<ol' + (start !== 1 ? ' start="' + start + '"' : '') + '>' + html + '</ol>' : '<ul>' + html + '</ul>', next: i };
  }
  function mdBlocks(lines, depth) {
    var out = [], i = 0, n = lines.length, m;
    while (i < n) {
      var line = lines[i];
      if (mdBlank(line)) { i++; continue; }
      if ((m = MD_FENCE.exec(line))) {
        var fence = m[1], code = [];
        i++;
        while (i < n && !(lines[i].trim().indexOf(fence) === 0 && /^\s*(`{3,}|~{3,})\s*$/.test(lines[i]))) { code.push(lines[i]); i++; }
        i++;                                                         // the closing fence (or the end)
        out.push('<pre class="md-pre">' + esc(code.join('\n')) + '</pre>');
        continue;
      }
      if ((m = MD_HEAD.exec(line))) {
        var lv = Math.min(m[1].length, 4);
        out.push('<h' + (lv + 1) + ' class="md-h' + lv + '">' + mdInline(m[2]) + '</h' + (lv + 1) + '>');
        i++; continue;
      }
      if (MD_RULE.test(line)) { out.push('<hr>'); i++; continue; }
      if (MD_ROW.test(line) && i + 1 < n && MD_SEP.test(lines[i + 1])) {
        var head = mdCells(line), rows = [];
        i += 2;
        while (i < n && MD_ROW.test(lines[i])) { rows.push(mdCells(lines[i])); i++; }
        out.push(mdTable(head, rows));
        continue;
      }
      if (MD_QUOTE.test(line)) {
        var q = [];
        while (i < n) {
          if ((m = MD_QUOTE.exec(lines[i]))) { q.push(m[1]); i++; continue; }
          // A blank line between two parts of one quote keeps them in one box.
          var j = i; while (j < n && mdBlank(lines[j])) j++;
          if (j > i && j < n && MD_QUOTE.test(lines[j])) { while (i < j) { q.push(''); i++; } continue; }
          break;
        }
        out.push('<blockquote>' + (depth < MD_DEPTH ? mdBlocks(q, depth + 1) : '<p>' + mdInline(q.join(' ')) + '</p>') + '</blockquote>');
        continue;
      }
      if (MD_ITEM.test(line)) { var list = mdList(lines, i, depth); out.push(list.html); i = list.next; continue; }
      var para = [line.trim()];
      i++;
      while (i < n && !mdBlank(lines[i]) && !mdStarts(lines[i])) { para.push(lines[i].trim()); i++; }
      out.push('<p>' + mdInline(para.join(' ')) + '</p>');
    }
    return out.join('');
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
      viewToday() + viewMoney() + viewPeople() + viewInvite() + viewCoupons() +
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
    if (top.kind === 'cmake' && $('#clabel')) { top.label = val('#clabel'); top.who = val('#cfor'); }
    if (top.kind === 'coupon' && $('#cnote')) top.note = val('#cnote');
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
        '<button class="btn wide" data-act="texts" data-id="' + esc(q.id) + '">Read their texts</button>' +
        '<p class="fine center">Their texts with the coach. Each time you open them, it is recorded.</p>' +
        '<button class="btn wide" data-act="pcoach" data-id="' + esc(q.id) + '">' + (q.you ? 'Your coach' : 'Their coach') + '</button>' +
        // PAUSE (owner, Oct 14 2026): never your own account.
        (q.you ? '' : q.paused_at
          ? '<button class="btn amber wide" data-act="ppause" data-id="' + esc(q.id) + '" data-on="">Bring them back</button>'
          : '<button class="btn red wide" data-act="ppause" data-id="' + esc(q.id) + '" data-on="1">Pause their account</button>') +
        '<button class="btn wide" data-act="close">Close</button></div>' };
    },
    // Asked before a pause or a return: what it does, in plain words.
    ppause: function (a) {
      var P = S.people, q = P && P.people ? P.people.filter(function (x) { return x.id === a.id; })[0] : null;
      if (!q || q.you) return null;
      var nm = q.name || 'This person';
      return a.on
        ? { html: pop('Pause ' + nm + '?', 'They can’t sign in or use the app, and see a notice that their account is paused. The coach stops texting them, and they leave their teams’ group texts without anything being announced. Nothing is deleted: their counts, plans, teams and credit stay, and you can bring them back any time.',
            '<div class="pair">' + cancel + '<button class="btn red" data-act="ppausego" data-id="' + esc(q.id) + '" data-on="1">Pause</button></div>') }
        : { html: pop('Bring ' + nm + ' back?', 'They can sign in again, the coach can text them as before, and they rejoin their teams’ group texts quietly.',
            '<div class="pair">' + cancel + '<button class="btn amber" data-act="ppausego" data-id="' + esc(q.id) + '" data-on="">Bring back</button></div>') };
    },
    // One person's texts with the coach, oldest first. Read only.
    texts: function (a) {
      var T = S.texts, P = S.people;
      if (!T || T.id !== a.id) return null;
      var q = P && P.people ? P.people.filter(function (x) { return x.id === a.id; })[0] : null;
      var who = q ? (q.name || 'No name yet') : 'This person';
      var D = T.data, body;
      if (D) {
        var more = D.shown >= D.limit && D.limit < TEXTS_MORE
          ? '<button class="link" data-act="textsmore" data-id="' + esc(a.id) + '"' + (T.loading ? ' disabled' : '') + '>' + (T.loading ? 'Reading' : 'Earlier texts') + '</button>' : '';
        body = D.texts.length ? more + '<div class="thread">' + D.texts.map(function (m) {
          var them = m.from === 'them';
          return '<div class="say ' + (them ? 'them' : 'coach') + '"><small>' + esc(them ? who : 'Coach') + ' \u00b7 ' + esc(when(m.at)) +
            (!them && m.kind ? ' \u00b7 ' + esc(kindWord(m.kind)) : '') + '</small><p>' + esc(m.text) + '</p></div>';
        }).join('') + '</div>' : '<p class="fine center">No texts with the coach yet.</p>';
      } else if (T.failed) {
        body = '<p class="msg-line warn" role="alert">' + esc(T.failed) + '</p><button class="btn wide" data-act="textsagain" data-id="' + esc(a.id) + '">Try again</button>';
      } else {
        body = '<p class="fine center">Reading.</p>';
      }
      return { full: true, bottom: !!(D && T.fresh), html: '<div class="sheet swap" role="dialog" aria-modal="true" aria-label="Texts">' +
        '<h2 class="name">' + esc(who) + '</h2>' +
        '<p class="fine">Texts with the coach, oldest first.' + (D && D.texts.length ? ' Showing the last ' + D.texts.length + '.' : '') + '</p>' +
        body +
        '<p class="fine center">This opening is on the record. The texts are not kept on this device.</p>' +
        '<button class="btn wide" data-act="close">Close</button></div>' };
    },
    // ONE JOB of the coach: what it is for (the sheet), the model it resolves
    // to right now, and how it did in the time shown.
    job: function (a) {
      var C = S.coach || {}, D = C.data, j = sheetJob(a.id);
      var ran = D ? D.jobs.filter(function (x) { return x.kind === a.id; })[0] : null;
      if (!j && !ran) return null;
      var kv = function (k, v) { return v === '' || v === null || v === undefined ? '' : '<div class="kv"><span>' + esc(k) + '</span><b>' + esc(v) + '</b></div>'; };
      var list = function (items) { return '<ul class="nb">' + items.map(function (x) { return '<li><p>' + esc(x) + '</p></li>'; }).join('') + '</ul>'; };
      var about = j ? '<div class="chips"><span class="chip">' + esc(j.family) + '</span></div>' +
        '<div class="list">' + kv('Runs on', j.model) + (j.model_lite && j.model_lite !== j.model ? kv('When trimmed to save', j.model_lite) : '') +
          kv('Thinking, set on the dashboard', j.effort || 'not set') + '</div>' +
        '<div class="nbk"><span class="micro muted">When it runs</span><p>' + esc(j.when) + '</p></div>' +
        '<div class="nbk"><span class="micro muted">What it is shown</span>' + list(j.reads) + '</div>' +
        '<div class="nbk"><span class="micro muted">What it may change</span>' + (j.may.length ? list(j.may) : '<p>Nothing. It can only write words.</p>') + '</div>' +
        '<div class="nbk"><span class="micro muted">Where its words go</span><p>' + esc(j.lands) + '</p></div>'
        : '<p class="fine">' + (C.sheetState === 'failed' ? 'The sheet could not be read just now, so only the numbers are shown.' : 'The sheet has no words for this job yet.') + '</p>';
      var nums = ran ? '<div class="list">' + kv('Calls, last ' + (D.days === 1 ? 'day' : D.days + ' days'), grouped(ran.calls)) +
        (ran.blocked ? kv('Blocked', grouped(ran.blocked)) : '') + (ran.errors ? kv('Failed', grouped(ran.errors)) : '') + (ran.cut_short ? kv('Cut short', grouped(ran.cut_short)) : '') +
        kv('It ran on', (ran.models || []).join(', ')) +
        (ran.avg_in !== null ? kv('Read, on average', grouped(ran.avg_in) + ' tokens') + kv('Wrote, on average', grouped(ran.avg_out) + ' tokens') + kv('Took, on average', secs(ran.avg_ms)) : '') +
        kv('Cost', money(ran.cost_cents)) + '</div>' : '<p class="fine">It did not run in the time shown.</p>';
      var calls = D ? D.recent.filter(function (c) { return c.kind === a.id; }).slice(0, 8) : [];
      return { full: true, html: '<div class="sheet swap" role="dialog" aria-modal="true" aria-label="Job">' +
        '<h2 class="name">' + esc(j ? j.name : jobName(a.id)) + '</h2>' + about + nums +
        (calls.length ? '<div class="list">' + calls.map(callRow).join('') + '</div>' : '') +
        '<button class="btn wide" data-act="close">Close</button></div>' };
    },
    // ONE CALL, as the log has it. Sizes and costs; never the words.
    call: function (a) {
      var D = S.coach && S.coach.data, c = D ? D.recent.filter(function (x) { return String(x.id) === String(a.id); })[0] : null;
      if (!c) return null;
      var kv = function (k, v) { return v === '' || v === null || v === undefined ? '' : '<div class="kv"><span>' + esc(k) + '</span><b>' + esc(v) + '</b></div>'; };
      var ended = c.outcome === 'ok' ? (STOP_WORDS[c.stop] || text(c.stop) || 'Finished') : (c.outcome === 'blocked' ? 'Blocked: ' : 'Failed: ') + reasonWords(c.reason);
      return { full: true, html: '<div class="sheet swap" role="dialog" aria-modal="true" aria-label="Call">' +
        '<h2 class="name">' + esc(jobName(c.kind)) + '</h2>' +
        '<div class="chips">' + (c.outcome === 'error' ? '<span class="chip bad">Failed</span>' : c.outcome === 'blocked' ? '<span class="chip warn">Blocked</span>' : c.cut_short ? '<span class="chip warn">Cut short</span>' : '<span class="chip">Ran</span>') + '</div>' +
        '<div class="list">' +
          kv('When', when(c.at)) + kv('For', callWho(c)) +
          kv('Model', c.model) + kv('Thinking', c.effort) + (c.rung ? kv('How much it was given', RUNG_WORDS[c.rung] || c.rung) : '') +
          kv('How it ended', ended) +
          (c.outcome === 'ok' ? kv('Read', grouped(c.in) + ' tokens') + (c.cached ? kv('Of that, reused from a moment before', grouped(c.cached) + ' tokens') : '') +
            kv('Wrote', grouped(c.out) + ' tokens' + (c.max_tokens ? ' of ' + grouped(c.max_tokens) + ' allowed' : '')) +
            kv('Cost', money(c.cost_cents)) + kv('Took', secs(c.ms)) : '') +
          (c.system_chars !== null ? kv('Standing instructions', grouped(c.system_chars) + ' characters') : '') +
          (c.turn_chars !== null ? kv('The conversation part', grouped(c.turn_chars) + ' characters' + (c.turns ? ' in ' + plural(c.turns, 'turn', 'turns') : '')) : '') +
          (c.window_days !== null || c.window_msgs !== null ? kv('Memory of the conversation', (c.window_days !== null ? plural(c.window_days, 'day', 'days') : '') + (c.window_days !== null && c.window_msgs !== null ? ', ' : '') + (c.window_msgs !== null ? plural(c.window_msgs, 'text', 'texts') : '')) : '') +
          kv('Function', c.fn) +
        '</div>' +
        (TRACED[c.kind] && c.outcome === 'ok' ? '<button class="btn wide" data-act="trace" data-id="' + esc(c.id) + '">What it was given and what it wrote</button>' : '') +
        '<button class="btn wide" data-act="job" data-id="' + esc(c.kind) + '">What this job is shown</button>' +
        '<p class="fine center">The log keeps sizes and costs, not the words that were sent or written.</p>' +
        '<button class="btn wide" data-act="close">Close</button></div>' };
    },
    // What one plan or star write was given, and what it wrote. Read only.
    trace: function (a) {
      var T = S.trace;
      if (!T || String(T.id) !== String(a.id)) return null;
      var D = T.data, body;
      var kv = function (k, v) { return '<div class="kv"><span>' + esc(k) + '</span><b>' + esc(v) + '</b></div>'; };
      var partName = function (p, i, all) {
        if (p.role === 'user') return D.writer === 'star' ? 'The day and the person' : 'The person and the week';
        var n = all.slice(0, i + 1).filter(function (x) { return x.role === 'system'; }).length;
        return 'Standing instructions ' + n;
      };
      if (D && !D.found) {
        body = '<p class="fine center">Nothing was kept for this call. A record of what a plan or the star was given is kept from the day this was switched on, for thirty days.</p>';
      } else if (D && !D.kept) {
        body = '<div class="list">' + D.given.map(function (p, i, all) { return kv(partName(p, i, all), grouped(p.chars) + ' characters'); }).join('') +
          kv('What they asked', grouped(D.asked_chars) + ' characters') + kv('What it wrote', grouped(D.wrote_chars) + ' characters') + '</div>' +
          '<p class="fine center">Sizes only. This record was kept before other people’s words were kept, so there is nothing more of it.</p>';
      } else if (D) {
        var given = D.given.map(function (p, i, all) {
          var open = !!T.open['g' + i];
          var secs = p.role === 'user' ? traceSections(p.text) : [{ head: '', body: text(p.text) }];
          return '<div class="grp' + (open ? ' open' : '') + '"><button class="grp-head" data-act="trsec" data-id="g' + i + '" aria-expanded="' + open + '"><span class="grow"><span class="ttl">' + esc(partName(p, i, all)) + '</span></span>' +
            '<span class="chip num">' + esc(compact(p.chars)) + '</span></button><div class="sug-body"><div><div class="grp-in nbin">' +
            (open ? secs.map(function (s) { return '<div class="nbk">' + (secs.length > 1 ? '<span class="micro muted">' + esc(s.head) + '</span>' : '') + '<p class="pre">' + esc(s.body) + '</p></div>'; }).join('') : '') +
            '</div></div></div></div>';
        }).join('');
        var cards = Array.isArray(D.wrote) ? D.wrote : [];
        body = (D.asked ? '<div class="nbk"><span class="micro muted">' + (D.own === false ? 'What they asked' : 'What you asked') + '</span><p class="pre">' + esc(D.asked) + '</p></div>' : '') +
          '<h2 class="card-title">What it was given</h2><p class="fine center">Exactly as it was sent, in order. Tap a part to read it.</p><div class="sugs">' + given + '</div>' +
          '<h2 class="card-title">What it wrote</h2>' +
          (cards.length ? cards.map(function (w) {
            return '<div class="nbk"><span class="micro muted">' + esc((w.date ? day(fromIso(w.date)) + ' · ' : '') + text(w.title)) + '</span><p class="pre">' + esc(w.notes) + '</p></div>';
          }).join('') : '<p class="fine center">Nothing was written.</p>') +
          (D.health_cut ? '<p class="fine center">Left out of this record: what comes from the watch and Apple Health.</p>' : '') +
          '<p class="fine center">This opening is on the record. Nothing here is kept on this device. It is kept in the database for thirty days.</p>';
      } else if (T.failed) {
        body = '<p class="msg-line warn" role="alert">' + esc(T.failed) + '</p><button class="btn wide" data-act="traceagain" data-id="' + esc(a.id) + '">Try again</button>';
      } else {
        body = '<p class="fine center">Reading.</p>';
      }
      return { full: true, html: '<div class="sheet swap" role="dialog" aria-modal="true" aria-label="What it was given">' +
        '<h2 class="name">Why it wrote that</h2>' + body +
        '<button class="btn wide" data-act="close">Close</button></div>' };
    },
    // One person's coach. Read only.
    pcoach: function (a) {
      var T = S.pcoach, P = S.people;
      if (!T || T.id !== a.id) return null;
      var q = P && P.people ? P.people.filter(function (x) { return x.id === a.id; })[0] : null;
      var who = q ? (q.name || 'No name yet') : 'This person';
      var D = T.data, body;
      var kv = function (k, v) { return v === '' || v === null || v === undefined ? '' : '<div class="kv"><span>' + esc(k) + '</span><b>' + esc(v) + '</b></div>'; };
      if (D) {
        var c = D.coach;
        var coach = c ? '<div class="list">' + kv('Coach', c.name) + kv('Voice', nbWords(c.preset)) +
          kv('Harshness', c.harshness) + kv('Humor', c.humor) + kv('Formality', c.formality) +
          kv('Brainpower', c.brainpower ? nbWords(c.brainpower) : 'Standard') + kv('Thinking', c.effort) + '</div>' +
          (c.style_notes ? '<div class="nbk"><span class="micro muted">' + (D.you ? 'Your' : 'Their') + ' notes on the coach\u2019s style</span><p>' + esc(c.style_notes) + '</p></div>' : '') +
          (c.goals ? '<div class="nbk"><span class="micro muted">' + (D.you ? 'Your' : 'Their') + ' stated goals</span><p>' + esc(c.goals) + '</p></div>' : '')
          : '<p class="fine">They have not set up a coach yet.</p>';
        var tier = q ? q.tier : null;
        var reviews = D.reviews.length ? '<div class="nbk"><span class="micro muted">Weekly reviews</span><div class="list">' + D.reviews.map(function (r) {
          var said = reviewCreditSpent(r) ? 'Credit spent' : reviewNotInPlan(r, tier) ? 'Not in ' + (D.you ? 'your' : 'their') + ' plan' : nbWords(r.status);
          return '<div class="kv"><span>Week to ' + esc(day(fromIso(r.week_end))) + ' · try ' + esc(r.attempt) + '</span><b>' + esc(said) + (r.model ? ' · ' + esc(r.model) : '') + '</b></div>';
        }).join('') + '</div></div>' : '';
        var nb;
        if (D.notebook) {
          var keys = Object.keys(D.notebook);
          keys.sort(function (x, y) { var i = NB_ORDER.indexOf(x), j = NB_ORDER.indexOf(y); return (i < 0 ? 99 : i) - (j < 0 ? 99 : j) || (x < y ? -1 : 1); });
          nb = '<h2 class="card-title">The coach’s notebook</h2>' +
            '<p class="fine center">What the coach has written down about ' + (D.you ? 'you' : 'them') + (D.notebook_at ? ', last changed ' + esc(when(D.notebook_at)) : '') + '. The weekly review rewrites it; texts add to it.</p>' +
            '<div class="sugs">' + keys.map(function (k) {
              var inner = nbValue(D.notebook[k], 0), open = !!T.open[k];
              return inner ? '<div class="grp' + (open ? ' open' : '') + '"><button class="grp-head" data-act="nbsec" data-id="' + esc(k) + '" aria-expanded="' + open + '"><span class="grow"><span class="ttl">' + esc(nbWords(k)) + '</span></span><i class="chev"></i></button>' +
                '<div class="sug-body"><div><div class="grp-in nbin">' + inner + '</div></div></div></div>' : '';
            }).join('') + '</div>' +
            (D.left_out.length ? '<p class="fine center">Left out: what comes from the watch and Apple Health.</p>' : '') +
            '<p class="fine center">This opening is on the record. The notebook is not kept on this device.</p>';
        } else if (D.notebook_held === 'policy') {
          nb = '<p class="fine center">Their coach’s notebook is not shown: the database is holding it back.</p>';
        } else {
          nb = '<p class="fine center">The coach has not written a notebook for ' + (D.you ? 'you' : 'them') + ' yet.' +
            (noReviewInPlan(tier) ? ' The weekly review that writes it is part of Premium, and ' + (D.you ? 'you are' : 'they are') + ' on ' + TIERS[tier] + '.' : '') + '</p>';
        }
        body = coach + reviews + nb + '<button class="btn wide" data-act="coachwhogo" data-id="' + esc(a.id) + '">What ran for ' + (D.you ? 'you' : 'them') + '</button>';
      } else if (T.failed) {
        body = '<p class="msg-line warn" role="alert">' + esc(T.failed) + '</p><button class="btn wide" data-act="pcoachagain" data-id="' + esc(a.id) + '">Try again</button>';
      } else {
        body = '<p class="fine center">Reading.</p>';
      }
      return { full: true, html: '<div class="sheet swap" role="dialog" aria-modal="true" aria-label="Their coach">' +
        '<h2 class="name">' + esc(who) + '</h2>' + body +
        '<button class="btn wide" data-act="close">Close</button></div>' };
    },
    // Copying was refused by the browser: show the link to press and hold.
    // Make a coupon: how much, and who it is for (a name is enough).
    cmake: function (a) {
      var C = S.coupons;
      if (!C || !C.rules) return null;
      var R = C.rules, pick = a.cents || R.amounts[0], people = (S.people && S.people.people) || [];
      return { html: pop('Make a coupon', 'AI credit a tester adds in the app. It works once, and ends in ' + R.days + ' days if nobody uses it.',
        '<div class="three">' + R.amounts.map(function (n) {
          return '<button class="btn small' + (n === pick ? ' on' : '') + '" data-act="camount" data-cents="' + esc(n) + '">' + esc(dollars(n)) + '</button>';
        }).join('') + '</div>' +
        '<label class="field" for="cfor"><span class="micro muted">Who it is for</span><select class="well" id="cfor"><option value="">Someone not on the page yet</option>' + people.map(function (p) {
          return '<option value="' + esc(p.id) + '"' + (p.id === a.who ? ' selected' : '') + '>' + esc(personName(p)) + '</option>';
        }).join('') + '</select></label>' +
        '<label class="field" for="clabel"><span class="micro muted">A name, so you can tell it apart (optional)</span><input class="well" id="clabel" maxlength="60" placeholder="A first name is enough" value="' + esc(a.label || '') + '"></label>' +
        '<p class="fine center">' + esc(dollars(R.room_cents)) + ' of room left under the ' + esc(dollars(R.unused_cap_cents)) + ' limit. Leave phone numbers out: you pick the person in Messages.</p>' +
        '<div class="pair">' + cancel + '<button class="btn amber" data-act="cmakego">Make it</button></div>') };
    },
    // One coupon. Its code is asked for when this opens, and shown here only.
    coupon: function (a) {
      // one just made is drawn from its own answer until the list has it
      var c = couponOf(a.id) || (a.fresh && a.fresh.id === a.id ? a.fresh : null);
      if (!c) return null;
      var kv = function (k, v) { return '<div class="kv"><span>' + esc(k) + '</span><b>' + esc(v) + '</b></div>'; };
      var show = S.cshow && S.cshow.id === c.id ? S.cshow : null, code = show && show.data ? text(show.data.code) : '';
      var inv = S.people && S.people.invite;
      var facts = kv('For', couponWho(c)) + kv('Made', day(new Date(c.made_at)) + (c.by_hand ? ', by hand' : ''));
      if (c.state === 'unused') facts += kv('Sent', c.sent_at ? day(new Date(c.sent_at)) : c.by_hand ? 'Not known' : 'Not yet') + (c.ends_at ? kv('Ends if unused', day(new Date(c.ends_at))) : '');
      if (c.state === 'used') {
        var who = c.used_by && S.people && S.people.people ? S.people.people.filter(function (p) { return p.id === c.used_by; })[0] : null;
        facts += kv('Used by', text(c.used_name) || 'someone') + (c.used_at ? kv('Used on', day(new Date(c.used_at))) : '') +
          (who && who.credit_granted_cents ? kv('Their credit left, all coupons', usd(Math.max(0, (who.credit_granted_cents || 0) - (who.ai_spent_cents || 0)) / 100)) : '');
      }
      if (c.state === 'cancelled' && c.cancelled_at) facts += kv('Cancelled', day(new Date(c.cancelled_at)));
      if (c.state === 'ended' && c.ends_at) facts += kv('Ended', day(new Date(c.ends_at)));
      var body = '';
      if (c.state === 'unused') {
        if (!show || show.loading) body = '<p class="fine center">Reading the code.</p>';
        else if (show.failed || !code) body = '<p class="fine center">' + esc(show.failed || 'This coupon can no longer be used.') + '</p><button class="btn wide" data-act="cagain" data-id="' + esc(c.id) + '">Try again</button>';
        else {
          var msg = couponWords(a, c, code);
          body = '<div class="box"><span class="micro">The code</span><p class="code">' + esc(code) + '</p></div>' +
            '<label class="field" for="cnote"><span class="micro muted">Your note, at the top (optional)</span><textarea class="well" id="cnote" maxlength="300" placeholder="Hey, try this. I use it every day.">' + esc(a.note || '') + '</textarea></label>' +
            '<div class="box"><span class="micro">The text</span><p class="pre" id="cmsg">' + esc(msg) + '</p>' +
              (inv && inv.link ? '<button class="btn small' + (a.nolink ? '' : ' on') + '" data-act="clink">' + (a.nolink ? 'Add the install link' : 'Install link added') + '</button>' : '') + '</div>' +
            '<a class="btn amber wide" id="ctextlink" data-act="ctext" data-id="' + esc(c.id) + '" href="' + esc(smsLink(msg)) + '">Text it</a>' +
            '<div class="pair"><button class="btn" data-act="ccopy" data-id="' + esc(c.id) + '">Copy the text</button><button class="btn" data-act="ccode" data-id="' + esc(c.id) + '">Copy the code</button></div>' +
            '<p class="fine center">Text it opens your own Messages with this text filled in. You pick the person. This page never sees anyone’s number.</p>' +
            '<button class="btn wide" data-act="csent" data-id="' + esc(c.id) + '" data-on="' + (c.sent_at ? '1' : '') + '">' + (c.sent_at ? 'Mark as not sent' : 'Mark as sent') + '</button>' +
            '<button class="btn red wide" data-act="ccancel" data-id="' + esc(c.id) + '">Cancel this coupon</button>' +
            '<p class="fine center">Each time a code is shown, it is recorded. The code is not kept on this device.</p>';
        }
      }
      return { full: true, html: '<div class="sheet swap" role="dialog" aria-modal="true" aria-label="Coupon">' +
        '<h2 class="name">' + esc(dollars(c.cents)) + ' coupon</h2>' +
        '<div class="chips"><span class="chip' + (c.state === 'used' ? ' gold' : '') + '">' + esc(COUPON_WORDS[c.state] || text(c.state)) + '</span></div>' +
        '<div class="list">' + facts + '</div>' + body +
        '<button class="btn wide" data-act="close">Close</button></div>' };
    },
    ccancel: function (a) {
      var c = couponOf(a.id);
      if (!c) return null;
      return { html: pop('Cancel this coupon?', 'The code stops working at once. It stays on the list as cancelled. If you already sent it, tell them.',
        '<div class="pair"><button class="btn" data-act="close">Keep it</button><button class="btn red" data-act="ccancelgo" data-id="' + esc(a.id) + '">Cancel it</button></div>') };
    },
    // Copying was refused: the words, to press and hold.
    ccopied: function (a) {
      if (!a.words) return null;
      return { html: pop('Copy it by hand', 'Copying was refused here. Press and hold to copy.',
        '<label class="field" for="cwords"><textarea class="well" id="cwords" readonly>' + esc(a.words) + '</textarea></label>' +
        '<button class="btn" data-act="close">Close</button>') };
    },
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
    // A person's texts are forgotten the moment their sheet is closed: no texts
    // sheet open means nobody's texts are held, whichever way it was closed.
    if (S.texts && !stack.some(function (e) { return e.kind === 'texts'; })) forgetTexts();
    if (S.pcoach && !stack.some(function (e) { return e.kind === 'pcoach'; })) forgetCoach();
    if (S.trace && !stack.some(function (e) { return e.kind === 'trace'; })) forgetTrace();
    if (S.cshow && !stack.some(function (e) { return e.kind === 'coupon' || e.kind === 'ccancel' || e.kind === 'ccopied'; })) forgetCoupon();
    if (S.coupons && !(S.people && S.list)) forgetCoupons();
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
    // A thread just read opens on its newest text, which is at the bottom.
    if (s.bottom) { var sh = root.querySelector('.sheet'); if (sh) sh.scrollTop = sh.scrollHeight; if (S.texts) S.texts.fresh = false; }
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
    else if (S.stage === 'list' && S.list) v.innerHTML = viewTabs() + (S.tab === 'coach' ? viewCoach() : isDocTab(S.tab) ? viewDoc(S.tab) : viewList());
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
        // The Coach tab is read again with the list while it is the one showing.
        if (S.tab === 'coach' && !(S.coach && S.coach.loading)) loadCoach();
        // So are the documents, while one of them is the tab showing.
        if (isDocTab(S.tab) && !(S.docs && S.docs.loading)) loadDocs();
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
    refresh: function () { if (S.coach) S.coach.stale = true; load().then(function (r) { if (r.ok) toast('Up to date'); }); },
    signout: function () { openSheet('signout'); },
    signoutgo: function (d) {
      var token = session && session.access_token, everywhere = !!(d && d.all);
      gen++;                                   // every call still in the air is now too late to matter
      keepSession(null); S.list = null; S.people = null; forgetTexts(); forgetCoach(); forgetTrace(); forgetCoachTab(); forgetDocs(); S.tab = 'home'; S.phone = ''; S.pending = null; S.busy = false; S.stage = 'signin'; say('');
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
    ppast: function () { S.showPaused = !S.showPaused; drawPage(); },
    ppause: function (d) { if (d.id) openSheet('ppause', { id: d.id, on: d.on === '1' }); },
    // The state is sent, not a toggle, so a second tap changes nothing.
    ppausego: function (d, el) {
      if (!d.id) return;
      var on = d.on === '1';
      change(el, 'owner_person_pause', { _user: d.id, _pause: on }, on ? 'Paused' : 'Brought back', closeAll);
    },
    // Their texts with the coach: asked for here, by this tap, and nowhere else.
    texts: function (d) { if (!d.id) return; stack.push({ kind: 'texts', id: d.id }); loadTexts(d.id, TEXTS_FIRST); },
    textsmore: function (d) { if (S.texts && S.texts.id === d.id && !S.texts.loading) loadTexts(d.id, TEXTS_MORE); },
    textsagain: function (d) { if (S.texts && S.texts.id === d.id && !S.texts.loading) loadTexts(d.id, TEXTS_FIRST); },
    invite: function () {
      var inv = S.people && S.people.invite;
      if (!inv || !inv.link) return;
      try {
        navigator.clipboard.writeText(inv.link).then(function () { toast('Invite link copied'); }, function () { openSheet('invitelink'); });
      } catch (e) { openSheet('invitelink'); }
    },

    // Coupons: made here, sent from his own Messages, used by a tester in the app.
    cpast: function () { S.showCoupons = !S.showCoupons; drawPage(); },
    // (draft: true keeps the keyboard down until he taps the name box; the name is optional.)
    cmake: function () {
      var C = S.coupons;
      if (!C || !C.rules) return;
      if (C.rules.words_ready != null && !Number(C.rules.words_ready)) { toast('No code words are ready. Tap Mint ' + (Number(C.rules.words_batch) || 10) + ' more first.'); return; }
      openSheet('cmake', { cents: null, who: '', label: '', made: newId(), draft: true });
    },
    // MINT 10 MORE. Its id is kept until an answer says it worked, so a second
    // tap after a lost answer is the SAME ten and they are readied once.
    cmint: function (d, el) {
      var C = S.coupons;
      if (!C || !C.rules || S.busy) return;
      if (Number(C.rules.words_ready) > 0) { toast(Number(C.rules.words_ready) + ' code words are still ready.'); return; }
      if (!S.mintId) S.mintId = newId();
      var release = hold(el), mine = gen;
      rpc('owner_code_mint', { _id: S.mintId }).then(function (r) {
        if (mine !== gen) { S.busy = false; return; }
        if (r.ok && r.data) {
          S.busy = false; S.mintId = null;
          toast((Number(r.data.ready) || 0) + ' code words ready'); loadCoupons();
          return;
        }
        if (r.status === 401) { signedOut('You are signed out. Sign in again.'); return; }
        if (SECOND(r)) { needSecond(); return; }
        release(); toast(couponWhy(r));
        if (r.status === 0) loadCoupons();     // it may have landed: show what is true
      });
    },
    camount: function (d) {
      var top = capture();
      if (!top || top.kind !== 'cmake') return;
      top.cents = Number(d.cents); drawSheet();
    },
    cmakego: function (d, el) {
      var top = capture(), C = S.coupons;
      if (!top || top.kind !== 'cmake' || !C || !C.rules || S.busy) return;
      var cents = top.cents || C.rules.amounts[0], label = text(top.label).trim();
      if (cents > C.rules.room_cents) { toast('That would put more than ' + dollars(C.rules.unused_cap_cents) + ' of unused coupons out. Cancel one first.'); return; }
      // The id was made with the sheet and stays with it, so a second tap
      // after a lost answer is the SAME coupon and is made once.
      var release = hold(el), mine = gen;
      rpc('owner_coupon_make', { _cents: cents, _label: label || null, _for: top.who || null, _id: top.made }).then(function (r) {
        if (mine !== gen) { S.busy = false; return; }
        if (r.ok && r.data && r.data.id) {
          S.busy = false;
          // Its code came back with it: shown at once, from memory, and nowhere else.
          cshowTurn++; S.cshow = { id: r.data.id, data: r.data };
          stack.length = 0; stack.push({ kind: 'coupon', id: r.data.id, fresh: r.data });
          drawSheet(); toast('Coupon made'); loadCoupons();
          return;
        }
        if (r.status === 401) { signedOut('You are signed out. Sign in again.'); return; }
        if (SECOND(r)) { needSecond(); return; }
        release(); toast(couponWhy(r));
        if (r.status === 0) loadCoupons();     // it may have landed: show what is true
      });
    },
    // The code of one coupon: asked for here, by this tap, and nowhere else.
    coupon: function (d) {
      var c = couponOf(d.id);
      if (!c) return;
      stack.push({ kind: 'coupon', id: c.id });
      if (c.state === 'unused') loadCouponCode(c.id); else drawSheet();
    },
    cagain: function (d) { if (d.id && !(S.cshow && S.cshow.loading)) loadCouponCode(d.id); },
    // The install link is in the text unless he takes it off (for a friend who already has the app).
    clink: function () { var top = capture(); if (top && top.kind === 'coupon') { top.nolink = !top.nolink; drawSheet(); } },
    // "Text it" is a link: the tap itself opens his Messages. This only notes that it was sent.
    ctext: function (d) { ACT.csentquiet(d); },
    csentquiet: function (d) {
      var mine = gen;
      if (!d.id) return;
      rpc('owner_coupon_sent', { _id: d.id, _sent: true }).then(function (r) { if (mine === gen && r.ok) loadCoupons(); });
    },
    ccopy: function (d) { ACT.ccopyof(d, true); },
    ccode: function (d) { ACT.ccopyof(d, false); },
    ccopyof: function (d, whole) {
      var top = capture(), c = top && top.kind === 'coupon' ? couponOf(top.id) || top.fresh : null;
      var code = S.cshow && c && S.cshow.id === c.id && S.cshow.data ? text(S.cshow.data.code) : '';
      if (!c || !code) return;
      var words = whole ? couponWords(top, c, code) : code;
      var byHand = function () { openSheet('ccopied', { words: words }); };
      try {
        navigator.clipboard.writeText(words).then(function () {
          toast(whole ? 'Text copied' : 'Code copied');
          if (whole) ACT.csentquiet({ id: c.id });
        }, byHand);
      } catch (e) { byHand(); }
    },
    csent: function (d, el) {
      var on = !d.on;
      change(el, 'owner_coupon_sent', { _id: d.id, _sent: on }, on ? 'Marked as sent' : 'Marked as not sent', loadCoupons);
    },
    ccancel: function (d) { if (couponOf(d.id)) openSheet('ccancel', { id: d.id }); },
    ccancelgo: function (d, el) { change(el, 'owner_coupon_cancel', { _id: d.id }, 'Coupon cancelled', closeAll); },

    // The tabs. The Coach tab's two reads, and the documents' one, are asked
    // for here, when the tab is opened.
    tab: function (d) {
      S.tab = d.id === 'coach' || isDocTab(d.id) ? d.id : 'home';
      if (S.tab === 'coach' && !(S.coach && (S.coach.data || S.coach.loading))) loadCoach();
      else if (isDocTab(S.tab) && !(S.docs && (S.docs.data || S.docs.loading))) loadDocs();
      else drawPage();
    },
    coachdays: function (d) { var n = Number(d.id); if (COACH_DAYS.indexOf(n) < 0 || n === S.coachDays) return; S.coachDays = n; loadCoach(); },
    coachwho: function (d) { if (!d.id) return; S.coachWho = d.id; loadCoach(); },
    coachall: function () { S.coachWho = null; loadCoach(); },
    coachidle: function () { S.coachIdle = !S.coachIdle; drawPage(); },
    coachmore: function () { S.coachAll = !S.coachAll; drawPage(); },
    job: function (d) { if (d.id) openSheet('job', { id: d.id }); },
    call: function (d) { if (d.id) openSheet('call', { id: d.id }); },
    // One person's coach: asked for here, by this tap, and nowhere else.
    pcoach: function (d) { if (!d.id) return; stack.push({ kind: 'pcoach', id: d.id }); loadPersonCoach(d.id); },
    pcoachagain: function (d) { if (S.pcoach && S.pcoach.id === d.id && !S.pcoach.loading) loadPersonCoach(d.id); },
    nbsec: function (d, el) {
      if (!S.pcoach || !S.pcoach.open) return;
      S.pcoach.open[d.id] = !S.pcoach.open[d.id];
      el.closest('.grp').classList.toggle('open', S.pcoach.open[d.id]);
      el.setAttribute('aria-expanded', String(S.pcoach.open[d.id]));
    },
    // What one write was given and what it wrote: asked for here, by this tap, and nowhere else.
    trace: function (d) { if (!d.id) return; stack.push({ kind: 'trace', id: d.id }); loadTrace(d.id); },
    traceagain: function (d) { if (S.trace && String(S.trace.id) === String(d.id) && !S.trace.loading) loadTrace(d.id); },
    trsec: function (d) { if (!S.trace || !S.trace.open) return; S.trace.open[d.id] = !S.trace.open[d.id]; drawSheet(); },
    // From a person's coach to what ran for them.
    coachwhogo: function (d) { if (!d.id) return; S.coachWho = d.id; S.tab = 'coach'; closeAll(); loadCoach(); },

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
  // His note on a coupon: the text and the link to Messages follow each key,
  // in place, so the box keeps the keyboard. The note lives in the open
  // sheet's entry and nowhere else.
  document.addEventListener('input', function (e) {
    var top = stack.length ? stack[stack.length - 1] : null;
    if (!e.target || e.target.id !== 'cnote' || !top || top.kind !== 'coupon') return;
    var c = couponOf(top.id) || top.fresh, code = S.cshow && c && S.cshow.id === c.id && S.cshow.data ? text(S.cshow.data.code) : '';
    if (!c || !code) return;
    top.note = String(e.target.value || '');
    var msg = couponWords(top, c, code), shown = $('#cmsg'), link = $('#ctextlink');
    if (shown) shown.textContent = msg;
    if (link) link.setAttribute('href', smsLink(msg));
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
