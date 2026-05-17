/* CRYSTAL ARCADE 共有レイヤ
   - プレイヤー名 / マッチ形式（フリー・先取N）を localStorage で共有
   - 全ゲーム共通の「大きな手番表示 ＋ マッチHUD ＋ ルールモーダル」を注入
   各ゲームは Arcade.init({...}) を呼び、render時に Arcade.turn()、決着時に Arcade.win(side)/Arcade.draw() を呼ぶだけ。*/
(function (global) {
  "use strict";

  var LS_P = "crystalArcade.players";
  var LS_M = "crystalArcade.match";

  function readJSON(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function writeJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

  function players() {
    var p = readJSON(LS_P, {});
    return {
      p1: (p && p.p1 && String(p.p1).trim()) || "プレイヤー1",
      p2: (p && p.p2 && String(p.p2).trim()) || "プレイヤー2"
    };
  }
  function setPlayers(p1, p2) {
    writeJSON(LS_P, { p1: (p1 || "").trim(), p2: (p2 || "").trim() });
  }
  function target() {
    var m = readJSON(LS_M, { target: 0 });
    var t = m && parseInt(m.target, 10);
    return (t && t > 0) ? t : 0; // 0 = フリー
  }
  function setTarget(t) { writeJSON(LS_M, { target: parseInt(t, 10) || 0 }); }

  /* ===== ルールデータ（ルールブック＆ゲーム内モーダル共用） ===== */
  var RULES = {
    "crystal-spin": { name: "CRYSTAL SPIN", jp: "コネクトフォー＋盤回転",
      how: ["列をクリックして自分の結晶を落とす。", "手番の代わりに盤を90°回転でき（各自2回まで）、回転後は全結晶が下へ落ち直す。", "縦・横・斜めのいずれかで4つ揃えたら勝ち。回転で両者同時に4連なら引き分け。", "通常モード(7×6)・5目並べモード(8×7・5連)も選べる。"],
      ctrl: ["列クリック＝落下", "⟲/⟳ または Q/E＝左右回転", "1〜列番号キー＝その列に落下", "U＝待った  R＝リセット  M＝消音"] },
    "crystal-reversi": { name: "CRYSTAL REVERSI", jp: "オセロ（リバーシ）",
      how: ["空マスをクリックし、相手の結晶を自分の結晶で挟むと裏返る。", "1つ以上裏返せる場所にしか置けない（合法手はヒント表示）。", "置けない手番は自動でパス。両者とも置けない／盤が埋まったら終了。", "結晶が多い方の勝ち。同数なら引き分け。"],
      ctrl: ["空マスをクリックして着手", "R＝リセット  M＝消音"] },
    "crystal-uttt": { name: "CRYSTAL UTTT", jp: "アルティメット○×",
      how: ["3×3の小盤が9つ。小盤で3つ並べるとその小盤を獲得。", "自分が打ったマスの位置が、相手が次に打つ小盤を指定する。", "指定された小盤が決着済みなら、空いている好きな小盤に打てる。", "小盤を縦横斜めに3つ獲得したら勝ち。"],
      ctrl: ["小盤の空マスをクリック", "R＝リセット  M＝消音"] },
    "crystal-gomoku": { name: "CRYSTAL GOMOKU", jp: "五目並べ",
      how: ["15×15の盤の好きな交点に交互に結晶を置く。", "縦・横・斜めのいずれかで先に5つ並べた方が勝ち（6連以上も勝ち）。", "盤が埋まって誰も揃わなければ引き分け。"],
      ctrl: ["交点をクリックして着手", "R＝リセット  M＝消音"] },
    "crystal-dots": { name: "CRYSTAL DOTS", jp: "ドット＆ボックス（4×4）",
      how: ["ドット間の線を1本ずつ引く。", "マスの4辺目を引いた人がそのマスを獲得し、もう一手打てる（連続手番）。", "「!」が付くマス＝3辺埋まり＝触れると相手に取られる危険マス。鎖を読んで譲り合うのが鍵。", "全部の線を引き終えたとき、多くマスを取った方が勝ち。"],
      ctrl: ["ドット間の線をクリック", "R＝リセット  M＝消音"] },
    "crystal-nim": { name: "CRYSTAL WYTHOFF", jp: "ウィトフのゲーム",
      how: ["2つの山がある。手番ごとに『どちらか1山から好きな数』または『両山から同じ数』取る。", "最後の結晶を取った方が勝ち。", "必勝形は黄金比に基づき非自明。先を読む数理ゲーム。"],
      ctrl: ["結晶クリック＝その結晶と右側を取る", "「両山から同数取る」チップで両取り", "R＝リセット  M＝消音"] },
    "crystal-hex": { name: "CRYSTAL HEX", jp: "ヘックス（接続）",
      how: ["六角マスに交互に結晶を置くだけ（取り合い・引き分け無し）。", "プレイヤー1（蒼）は盤の『上の辺と下の辺』を自分の結晶の道でつなげれば勝ち。", "プレイヤー2（紫）は『左の辺と右の辺』をつなげれば勝ち。"],
      ctrl: ["六角マスをクリックして着手", "R＝リセット  M＝消音"] },
    "crystal-oc": { name: "ORDER & CHAOS", jp: "秩序と混沌",
      how: ["6×6盤。手番ごとに置く色は『蒼・紫どちらでも自由』。", "秩序＝同色がちょうど5つ並べば勝ち（6連は無効）。", "混沌＝盤が埋まるまで5連を作らせなければ勝ち。", "担当（秩序/混沌）は1局ごとに自動で入れ替わり、マッチ単位で公平。"],
      ctrl: ["色チップで置く色を選び、空マスをクリック", "1/2＝色切替  R＝リセット  M＝消音"] },
    "crystal-pente": { name: "CRYSTAL PENTE", jp: "ペンテ（五目＋挟み取り）",
      how: ["13×13盤に交互に置く。縦横斜めで5連を作れば勝ち。", "相手の『ちょうど2個』を自分の結晶で挟むと捕獲（X●●X）。1個や3個は取れない。", "ペアを5組（10個）捕獲しても勝ち。挟まれた位置に自分から入るのは安全。"],
      ctrl: ["交点をクリックして着手", "R＝リセット  M＝消音"] }
  };

  var GAME_ORDER = ["crystal-spin","crystal-reversi","crystal-uttt","crystal-gomoku","crystal-dots","crystal-nim","crystal-hex","crystal-oc","crystal-pente"];

  /* ===== 共有CSS ===== */
  var CSS = [
    "body.arcade-on .status{display:none!important;}",
    "body.arcade-on .scoreboard{display:none!important;}",
    "body.arcade-on .arcade-link{display:none!important;}",
    "body.arcade-on .top a.back{display:none!important;}",
    ".ac-hud{display:flex;flex-direction:column;align-items:center;gap:10px;width:100%;max-width:560px;}",
    ".ac-turn{display:flex;align-items:center;gap:14px;font-weight:900;letter-spacing:.04em;",
    "  font-size:clamp(20px,5.4vw,30px);padding:10px 22px;border-radius:16px;",
    "  background:rgba(150,200,255,0.06);border:1px solid rgba(160,210,255,0.18);min-width:min(92vw,420px);justify-content:center;",
    "  transition:box-shadow .2s,border-color .2s;}",
    ".ac-turn .gem{width:26px;height:26px;clip-path:polygon(50% 0,93% 25%,93% 75%,50% 100%,7% 75%,7% 25%);flex:none;}",
    ".ac-turn.s1{border-color:rgba(78,240,255,.55);box-shadow:0 0 22px rgba(78,240,255,.28);}",
    ".ac-turn.s1 .nm{color:#cdf6ff;text-shadow:0 0 14px rgba(78,240,255,.6);}",
    ".ac-turn.s1 .gem{background:radial-gradient(circle at 36% 28%,#eafdff,#4ef0ff 46%,#1186b8);box-shadow:0 0 14px rgba(78,240,255,.8);animation:acpulse 1.1s ease-in-out infinite alternate;}",
    ".ac-turn.s2{border-color:rgba(196,107,255,.55);box-shadow:0 0 22px rgba(196,107,255,.28);}",
    ".ac-turn.s2 .nm{color:#edd6ff;text-shadow:0 0 14px rgba(196,107,255,.6);}",
    ".ac-turn.s2 .gem{background:radial-gradient(circle at 36% 28%,#f6e7ff,#c46bff 46%,#7a2bd0);box-shadow:0 0 14px rgba(196,107,255,.8);animation:acpulse 1.1s ease-in-out infinite alternate;}",
    ".ac-turn.over{opacity:.85;}",
    ".ac-turn.over .gem{animation:none;}",
    "@keyframes acpulse{from{transform:scale(1);}to{transform:scale(1.16);}}",
    ".ac-bar{display:flex;align-items:center;gap:10px;font-size:13px;font-weight:700;letter-spacing:.06em;color:#9fb9d4;flex-wrap:wrap;justify-content:center;}",
    ".ac-bar .nm1{color:#bff4ff;} .ac-bar .nm2{color:#e6c9ff;}",
    ".ac-bar .sc{font-size:20px;font-weight:900;color:#fff;padding:0 6px;}",
    ".ac-bar .fmt{padding:3px 12px;border-radius:999px;background:rgba(150,200,255,0.06);border:1px solid rgba(160,210,255,0.18);color:#9fb9d4;}",
    ".ac-btn{font:inherit;font-weight:700;letter-spacing:.1em;font-size:12px;color:#9fb9d4;background:rgba(150,200,255,0.05);",
    "  border:1px solid rgba(160,210,255,0.16);padding:7px 14px;border-radius:999px;cursor:pointer;text-decoration:none;display:inline-block;}",
    ".ac-btn:hover{color:#dff1ff;border-color:rgba(120,220,255,.5);}",
    ".ac-btn.ac-next{color:#04121c;background:linear-gradient(160deg,#bff6ff,#4ef0ff);border-color:transparent;font-weight:800;",
    "  box-shadow:0 0 18px rgba(78,220,255,.45);animation:acpulse 1.2s ease-in-out infinite alternate;}",
    ".ac-btn.ac-next:hover{filter:brightness(1.08);}",
    ".ac-actions{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;}",
    ".ac-modal{position:fixed;inset:0;z-index:200;display:none;align-items:center;justify-content:center;padding:20px;",
    "  background:rgba(4,6,14,.78);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);}",
    ".ac-modal.show{display:flex;}",
    ".ac-card{max-width:560px;width:100%;max-height:84vh;overflow:auto;border-radius:18px;padding:26px 24px;",
    "  background:linear-gradient(150deg,rgba(30,50,90,0.96),rgba(40,24,70,0.96));border:1px solid rgba(150,210,255,0.28);",
    "  box-shadow:0 0 60px rgba(60,150,255,.3);color:#dff1ff;}",
    ".ac-card h2{margin:0 0 2px;font-size:22px;font-weight:900;letter-spacing:.12em;",
    "  background:linear-gradient(95deg,#4ef0ff,#b9e8ff 42%,#c46bff);-webkit-background-clip:text;background-clip:text;color:transparent;}",
    ".ac-card .sub{color:#9fb9d4;font-size:13px;letter-spacing:.1em;margin-bottom:14px;}",
    ".ac-card h3{font-size:13px;letter-spacing:.16em;color:#7fb6e6;margin:16px 0 6px;}",
    ".ac-card ol,.ac-card ul{margin:0;padding-left:1.25em;line-height:1.85;font-size:14px;}",
    ".ac-card li{margin:3px 0;}",
    ".ac-x{margin-top:18px;width:100%;font:inherit;font-weight:800;letter-spacing:.14em;color:#04121c;",
    "  background:linear-gradient(160deg,#bff6ff,#4ef0ff);border:0;border-radius:12px;padding:12px;cursor:pointer;}",
    ".ac-win{position:fixed;inset:0;z-index:210;display:none;flex-direction:column;align-items:center;justify-content:center;gap:6px;pointer-events:none;}",
    ".ac-win.show{display:flex;animation:acpop .6s cubic-bezier(.2,1.5,.35,1) both;}",
    ".ac-win .lbl{font-size:22px;font-weight:800;letter-spacing:.3em;color:#d6ecff;text-shadow:0 0 16px rgba(120,200,255,.6);}",
    ".ac-win .big{font-size:clamp(54px,15vw,128px);font-weight:900;-webkit-background-clip:text;background-clip:text;color:transparent;-webkit-text-fill-color:transparent;}",
    ".ac-win.s1 .big{background-image:linear-gradient(160deg,#f2feff,#4ef0ff 55%,#7fe6ff);filter:drop-shadow(0 0 26px rgba(78,240,255,.7));}",
    ".ac-win.s2 .big{background-image:linear-gradient(160deg,#faf0ff,#c46bff 55%,#dba6ff);filter:drop-shadow(0 0 26px rgba(196,107,255,.7));}",
    "@keyframes acpop{0%{opacity:0;transform:scale(.55);}65%{opacity:1;}100%{opacity:1;transform:scale(1);}}"
  ].join("\n");

  var state = null; // {gameId, sideOf, isOver, hudEl, turnEl, barEl, scA, scB, seriesA, seriesB, lastWinner}

  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }

  function buildModal() {
    if (document.getElementById("acModal")) return;
    var m = el("div", "ac-modal"); m.id = "acModal";
    var c = el("div", "ac-card"); c.id = "acCard";
    m.appendChild(c);
    m.addEventListener("click", function (ev) { if (ev.target === m) hideRules(); });
    document.body.appendChild(m);
    var w = el("div", "ac-win"); w.id = "acWin";
    w.innerHTML = '<div class="lbl" id="acWinLbl"></div><div class="big">マッチ勝利</div>';
    document.body.appendChild(w);
  }
  function rulesHTML(id) {
    var r = RULES[id]; if (!r) return "";
    var s = '<h2>' + r.name + '</h2><div class="sub">' + r.jp + '</div>';
    s += '<h3>あそびかた</h3><ol>' + r.how.map(function (x) { return '<li>' + x + '</li>'; }).join("") + '</ol>';
    s += '<h3>そうさ</h3><ul>' + r.ctrl.map(function (x) { return '<li>' + x + '</li>'; }).join("") + '</ul>';
    s += '<button class="ac-x" id="acClose">とじる</button>';
    return s;
  }
  function showRules(id) {
    buildModal();
    document.getElementById("acCard").innerHTML = rulesHTML(id);
    document.getElementById("acModal").classList.add("show");
    var b = document.getElementById("acClose");
    if (b) b.addEventListener("click", hideRules);
  }
  function hideRules() { var m = document.getElementById("acModal"); if (m) m.classList.remove("show"); }

  function injectCSS() {
    if (document.getElementById("acCSS")) return;
    var st = el("style"); st.id = "acCSS"; st.textContent = CSS; document.head.appendChild(st);
  }

  function renderBar() {
    var p = players(), t = target();
    var fmt = t > 0 ? ("先取 " + t + " 勝") : "フリー対局";
    var rem = "";
    if (t > 0) {
      var ra = Math.max(0, t - state.seriesA), rb = Math.max(0, t - state.seriesB);
      rem = '<span class="fmt">あと ' + esc(p.p1) + ":" + ra + " / " + esc(p.p2) + ":" + rb + '</span>';
    }
    state.barEl.innerHTML =
      '<span class="nm1">' + esc(p.p1) + '</span>' +
      '<span class="sc">' + state.seriesA + '</span><span>—</span><span class="sc">' + state.seriesB + '</span>' +
      '<span class="nm2">' + esc(p.p2) + '</span>' +
      '<span class="fmt">' + fmt + '</span>' + rem;
  }
  function showNext(v) { if (state && state.nextEl) state.nextEl.style.display = v ? "" : "none"; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]; }); }

  function setTurn(side, over) {
    var p = players();
    var nm = side === 2 ? p.p2 : p.p1;
    state.turnEl.className = "ac-turn s" + (side === 2 ? 2 : 1) + (over ? " over" : "");
    state.turnEl.innerHTML = (over ? "" : '<span class="gem"></span>') +
      '<span class="nm">' + esc(nm) + (over ? "" : " の番") + "</span>";
  }

  var API = {
    players: players, setPlayers: setPlayers, target: target, setTarget: setTarget,
    RULES: RULES, GAME_ORDER: GAME_ORDER, showRules: showRules, hideRules: hideRules,

    /* games call this once */
    init: function (opts) {
      injectCSS(); buildModal();
      document.body.classList.add("arcade-on");
      state = { gameId: opts.gameId, sideOf: opts.sideOf, seriesA: 0, seriesB: 0 };
      var hud = el("div", "ac-hud"); hud.id = "acHud";
      var turn = el("div", "ac-turn s1"); turn.id = "acTurn";
      var bar = el("div", "ac-bar"); bar.id = "acBar";
      var actions = el("div", "ac-actions");
      var nx = el("button", "ac-btn ac-next", "▶ もう一局"); nx.type = "button"; nx.style.display = "none";
      nx.addEventListener("click", function () {
        var rbtn = document.getElementById("btnReset");
        if (rbtn) rbtn.click(); else location.reload();
        nx.style.display = "none";
      });
      var rb = el("button", "ac-btn", "ルール (?)"); rb.type = "button";
      rb.addEventListener("click", function () { showRules(state.gameId); });
      var hb = el("a", "ac-btn", "‹ メニュー"); hb.href = "index.html";
      actions.appendChild(nx); actions.appendChild(rb); actions.appendChild(hb);
      state.nextEl = nx;
      hud.appendChild(turn); hud.appendChild(bar); hud.appendChild(actions);
      state.hudEl = hud; state.turnEl = turn; state.barEl = bar;
      // body 先頭付近へ（最初の主要要素の前）
      var anchor = document.querySelector(".top") || document.querySelector("h1") || document.body.firstChild;
      if (anchor && anchor.parentNode === document.body) document.body.insertBefore(hud, anchor.nextSibling || null);
      else document.body.insertBefore(hud, document.body.firstChild);
      state.seriesA = 0; state.seriesB = 0; state.pendingReset = false;
      renderBar(); setTurn(1, false);
      if (!API._keyBound) {
        API._keyBound = true;
        document.addEventListener("keydown", function (e) {
          var tag = (e.target && e.target.tagName) || "";
          if (tag === "INPUT" || tag === "TEXTAREA") return;
          if (e.key === "?" || e.key === "h" || e.key === "H") {
            var m = document.getElementById("acModal");
            if (m && m.classList.contains("show")) hideRules();
            else if (state) showRules(state.gameId);
          }
        });
      }
      return API;
    },
    /* 各ゲームの新規対局開始時に呼ぶ：マッチ達成後ならシリーズを次マッチ用にリセット */
    gameStart: function () {
      if (state && state.pendingReset) { state.seriesA = 0; state.seriesB = 0; state.pendingReset = false; renderBar(); }
      showNext(false);
    },
    /* render時：現手番を反映（side: 1|2、over:true で決着表示） */
    turn: function (side, over) { if (state) { setTurn(side, !!over); showNext(!!over); } },
    /* 1局の決着。winnerSide=1|2 → シリーズ加点しマッチ判定。返り値 {matchOver, who} */
    win: function (side) {
      if (!state) return { matchOver: false };
      if (side === 2) state.seriesB++; else state.seriesA++;
      renderBar();
      var t = target(), p = players();
      var sa = state.seriesA, sb = state.seriesB;
      var matchOver = t > 0 && (sa >= t || sb >= t);
      if (matchOver) {
        var wname = (sa >= t) ? p.p1 : p.p2;
        var ws = (sa >= t) ? 1 : 2;
        var w = document.getElementById("acWin");
        document.getElementById("acWinLbl").textContent = wname + "  " + t + "勝先取！";
        w.className = "ac-win s" + ws + " show";
        setTimeout(function () { w.classList.remove("show"); }, 3600);
        state.pendingReset = true;   // 次の対局開始時にシリーズを新マッチ用へ
      }
      showNext(true);
      return { matchOver: matchOver };
    },
    draw: function () { showNext(true); /* 引き分けはシリーズ加点なし */ },
    /* シリーズをリセット（新マッチ） */
    resetSeries: function () { if (state) { state.seriesA = 0; state.seriesB = 0; renderBar(); } },
    series: function () { return state ? { a: state.seriesA, b: state.seriesB } : { a: 0, b: 0 }; }
  };

  global.Arcade = API;
})(window);
