const url = new URLSearchParams(window.location.search);
const SIM = !!url.get('simulate');
const PID = Math.random().toString(36).slice(2, 12);
const FILE = `cheer_cue_${PID}.csv`;
const jsPsych = initJsPsych({
  on_finish: () => {
    window.__finished = true;
    if (!CONFIG.datapipe_id && !SIM) jsPsych.data.get().localSave('csv', FILE);
  },
});

const fw = CONFIG.face_px.w, fh = CONFIG.face_px.h, R = CONFIG.radius;
const AW = 2 * R + fw, AH = Math.round(2 * R * Math.sin(Math.PI / 3) + fh);
const SURROUND = jsPsych.randomization.shuffle(CONFIG.surround);
const REVERSED = Math.random() < 0.5;
const LEFT_LABEL = REVERSED ? CONFIG.scale_ends[1] : CONFIG.scale_ends[0];
const RIGHT_LABEL = REVERSED ? CONFIG.scale_ends[0] : CONFIG.scale_ends[1];
jsPsych.data.addProperties({ pid: PID, crowd_id: url.get('id') || '', surround: SURROUND.join('-'), reversed: REVERSED ? 1 : 0 });

const facePath = (f) => `../stimuli/${f}.png`;

const OVAL = { w: 87, h: 119, cx: 72, cy: 93 };

function pos(k) {
  if (k === 'center') return { x: (AW - fw) / 2, y: (AH - fh) / 2 };
  const a = (k * Math.PI) / 3;
  return { x: AW / 2 + R * Math.cos(a) - fw / 2, y: AH / 2 + R * Math.sin(a) - fh / 2 };
}

function arrayHTML(cond, center) {
  const c = pos('center');
  const imgs = [`<img src="${facePath(center)}" width="${fw}" height="${fh}" style="left:${c.x}px;top:${c.y}px">`];
  if (cond === 'group') {
    SURROUND.forEach((f, k) => {
      const p = pos(k);
      imgs.push(`<img src="${facePath(f)}" width="${fw}" height="${fh}" style="left:${p.x}px;top:${p.y}px">`);
    });
  }
  return `<div class="arr" style="width:${AW}px;height:${AH}px">${imgs.join('')}</div>`;
}

function cueHTML(k) {
  const p = pos(k);
  return `<div class="arr" style="width:${AW}px;height:${AH}px"><div class="cue" style="left:${p.x + OVAL.cx - OVAL.w / 2}px;top:${p.y + OVAL.cy - OVAL.h / 2}px;width:${OVAL.w}px;height:${OVAL.h}px"></div></div>`;
}

const fixation = { type: jsPsychHtmlKeyboardResponse, stimulus: '<div class="fix">+</div>',
  choices: 'NO_KEYS', trial_duration: CONFIG.fixation_ms, data: { task: 'fixation' } };

function slider(question, data, onFinish, top = '') {
  return {
    type: jsPsychHtmlSliderResponse,
    stimulus: `${top}<p class="question">${question}</p>`,
    labels: [LEFT_LABEL, RIGHT_LABEL],
    min: 0, max: 100, slider_start: 50, step: 1,
    slider_width: 600,
    require_movement: true,
    button_label: '次へ',
    data,
    on_finish: onFinish,
  };
}

function ratingTrial(c, cond, rep, phase, cue = 'center') {
  const cuedFace = cue === 'center' ? c.face : SURROUND[cue];
  const extra = { cond, face: c.face, level: c.level, pre: c.pre, rep, cue_pos: cue, cued_face: cuedFace };
  return { timeline: [fixation,
    { type: jsPsychHtmlKeyboardResponse, stimulus: arrayHTML(cond, c.face), choices: 'NO_KEYS',
      trial_duration: CONFIG.array_ms, data: { task: 'show', ...extra } },
    slider('枠の位置にあった顔は，どのくらい魅力的でしたか？', { task: phase, ...extra },
      (d) => { d.rating = REVERSED ? 100 - Number(d.response) : Number(d.response); }, cueHTML(cue)),
  ] };
}

function attentionTrial(side) {
  const target = side === 'left' ? LEFT_LABEL : RIGHT_LABEL;
  return slider(`この質問では，顔に関係なく，つまみを<b>${side === 'left' ? '左端' : '右端'}</b> (「${target}」の端) まで動かしてください。`,
    { task: 'attention', correct_side: side },
    (d) => { const r = Number(d.response); d.correct = (side === 'left' ? r <= 10 : r >= 90) ? 1 : 0; });
}

function textPage(html, button = '次へ') {
  return { type: jsPsychHtmlButtonResponse, stimulus: `<div class="instr">${html}</div>`, choices: [button],
    data: { task: 'instruction' } };
}

function validity() {
  const d = jsPsych.data.get(), reason = [];
  if (!d.filter({ task: 'attention' }).values().every((x) => x.correct === 1)) reason.push('attention');
  const vals = d.filter({ task: 'rating' }).values().map((x) => x.rating), counts = {};
  vals.forEach((v) => { counts[v] = (counts[v] || 0) + 1; });
  if (Math.max(...Object.values(counts)) / vals.length >= .9) reason.push('same_value');
  return { valid: reason.length === 0, reason: reason.join('+') };
}

const timeline = [];
const images = [...CONFIG.centers.map((c) => c.face), ...CONFIG.surround, ...CONFIG.practice].map(facePath);
timeline.push({ type: jsPsychPreload, images, message: '画像を読み込んでいます。しばらくお待ちください。' });

if (!SIM) {
  timeline.push({
    type: jsPsychHtmlButtonResponse,
    stimulus: `<div class="instr">
      <h3>顔の配置と魅力に関する調査</h3>
      <p style="color:#e00000;font-weight:bold">以前に「【約10分・PC限定】顔の印象に関する調査」，「【約5分・PC限定】顔の印象に関する調査 (2)」，「【約25分・PC限定】顔の記憶に関する調査」，「【約10分・PC限定】顔の魅力に関する調査 [CH-4]」のいずれかに参加した方は，この調査には参加できません。</p>
      <p>この度は，調査にご参加いただき，誠にありがとうございます。</p>
      <p>本研究では，人間の認知特性を明らかにすることを目的として，コンピュータを用いた調査を行います。所要時間は，準備や説明を含めて約10分です。</p>
      <p>本研究への参加は，参加者の皆様の自由な意思によるものであり，参加を辞退されても不利益は一切ございません。また，参加に同意された後でも，理由を問わず，途中で同意を撤回できます。その場合も，不利益が生じることはございません。</p>
      <p>なお，本研究を通じて得られた情報は，本研究に直接関わる目的以外には使用されません。研究の成果は学術論文や学会発表などで公表されることがありますが，データは匿名化し，統計処理した結果だけを公表するため，個人が特定されることはございません。匿名化したデータは，ほかの研究者が結果を検証できるよう，学術研究用のデータリポジトリで公開します。公開するデータには，氏名など個人を特定できる情報は含まれません。</p>
      <p>謝礼はYahoo!クラウドソーシングを通して支払われます。調査の最後に作業完了コードが表示されますので，必ず控えて，Yahoo!クラウドソーシングのページに戻って入力してください。</p>
      <p>本研究は，九州大学大学院人間環境学研究院心理学講座の研究倫理審査委員会の承認 (承認番号: ${CONFIG.ethics_no}) を得た上で実施されています。</p>
      <p>本研究に関するお問い合わせは，以下の連絡先にお願いいたします。<br>担当者: 山田祐樹<br>連絡先 (email): yamadayuk@gmail.com</p>
      <p>この調査では，コンピュータで作った人の顔の画像を見て答えていただきます。パソコンで参加してください。スマートフォンやタブレットでは参加できません。回答にはマウスを使います。</p></div>`,
    choices: ['同意して参加する'],
    data: { task: 'consent' },
  });
  timeline.push({ type: jsPsychFullscreen, fullscreen_mode: true,
    message: '<div class="instr"><p>この調査は全画面で行います。下のボタンを押してください。</p></div>', button_label: '全画面にする',
    data: { task: 'fullscreen' } });
  const small = () => window.innerWidth < CONFIG.min_screen.w || window.innerHeight < CONFIG.min_screen.h;
  timeline.push({
    type: jsPsychHtmlButtonResponse,
    stimulus: () => (small()
      ? '<div class="instr"><p>この調査はパソコンの画面で行ってください。画面の大きさが足りないため，ここで終了します。</p></div>'
      : '<div class="instr"><p>静かな場所で，途中で席を離れずに行ってください。所要時間は約10分です。</p></div>'),
    choices: () => (small() ? [] : ['次へ']),
    data: { task: 'screen_check' },
    on_finish: (x) => { x.screen_w = window.innerWidth; x.screen_h = window.innerHeight; },
  });
  timeline.push({
    type: jsPsychSurveyHtmlForm,
    preamble: '<p>はじめに，あなたご自身についてお答えください。</p>',
    html: `<p>年齢：<input name="age" type="number" min="18" max="99" required> 歳</p>
      <p>性別：<select name="gender" required><option value="">選んでください</option>
      <option>女性</option><option>男性</option><option>その他</option><option>答えない</option></select></p>`,
    button_label: '次へ',
    data: { task: 'demographics' },
  });
}

const nMain = CONFIG.centers.length * 2 * CONFIG.repeats + CONFIG.n_filler;
timeline.push(textPage(`<p>この調査では，はじめに画面の中央に「+」が表示され，そのあと女性の顔が1秒間表示されます。
  中央に顔が1人だけ表示されるときと，中央の顔の周りに別の6人の顔が一緒に表示されるときがあります。</p>
  <p>顔が消えたあと，どれか1人の顔があった位置に白い枠が表示されます。<b>枠の位置にあった顔</b>がどのくらい魅力的だったかを，画面の横棒のつまみをマウスで動かして答えてください。
  枠は中央に出ることも，周りの顔の位置に出ることもあります。どの顔について尋ねられても答えられるように，<b>表示された顔をすべてよく見てください</b>。</p>
  <p>左端は「${LEFT_LABEL}」，右端は「${RIGHT_LABEL}」です。答えたら「次へ」を押してください。</p>
  <p>全部で${nMain}回あります。まず練習を4回行います。</p>`, '練習を始める'));

const pf = CONFIG.practice;
jsPsych.randomization.shuffle([[pf[0], 'single', 'center'], [pf[1], 'group', 'center'],
  [pf[0], 'group', Math.floor(Math.random() * 6)], [pf[1], 'group', Math.floor(Math.random() * 6)]])
  .forEach(([f, cond, cue]) => timeline.push(ratingTrial({ face: f, level: 0, pre: null }, cond, 0, 'practice', cue)));
timeline.push(textPage(`<p>練習は終わりです。次から本番です。</p>
  <p>左端は「${LEFT_LABEL}」，右端は「${RIGHT_LABEL}」です。</p>`, '本番を始める'));

const trials = [];
for (let rep = 1; rep <= CONFIG.repeats; rep++) {
  CONFIG.centers.forEach((c) => ['single', 'group'].forEach((cond) => trials.push({ c, cond, rep })));
}
const fillerPos = jsPsych.randomization.shuffle([...Array(CONFIG.n_filler).keys()].map((i) => i % 6));
fillerPos.forEach((cue, i) => trials.push({ c: CONFIG.centers[Math.floor(Math.random() * CONFIG.centers.length)], cond: 'group', rep: 0, cue, filler: true }));
const order = jsPsych.randomization.shuffle(trials);
const attnSides = jsPsych.randomization.shuffle(['left', 'right']);
order.forEach((t, k) => {
  timeline.push(t.filler ? ratingTrial(t.c, 'group', 0, 'filler', t.cue) : ratingTrial(t.c, t.cond, t.rep, 'rating'));
  const n = k + 1;
  if (CONFIG.attention_after.includes(n)) timeline.push(attentionTrial(attnSides.pop()));
  if (n === CONFIG.break_after) {
    timeline.push(textPage(`<p>${n}回が終わりました (全${nMain}回)。少し休憩してください。</p>
      <p>準備ができたら，下のボタンを押して続けてください。</p>`, '続ける'));
  }
});

timeline.push({
  type: jsPsychHtmlKeyboardResponse, stimulus: '', choices: 'NO_KEYS', trial_duration: 0,
  data: { task: 'validity' },
  on_finish: (x) => {
    const v = validity();
    Object.assign(x, { valid: v.valid ? 1 : 0, exclusion: v.reason });
  },
});
if (!SIM) timeline.push({ type: jsPsychFullscreen, fullscreen_mode: false, data: { task: 'fullscreen_exit' } });
if (CONFIG.datapipe_id && !SIM) {
  timeline.push({ type: jsPsychPipe, action: 'save', experiment_id: CONFIG.datapipe_id,
    filename: FILE, data_string: () => jsPsych.data.get().csv() });
}
timeline.push({
  type: jsPsychHtmlButtonResponse,
  stimulus: `<div class="instr"><p>調査は以上です。ご協力ありがとうございました。</p>
    <p>作業完了コード：<b style="font-size:28px">${CONFIG.completion_code}</b></p>
    <p>このコードを Yahoo!クラウドソーシングの画面に入力してください。入力したら，このページを閉じてかまいません。</p></div>`,
  choices: ['終了'],
  data: { task: 'end' },
});

if (SIM) jsPsych.simulate(timeline, 'data-only');
else jsPsych.run(timeline);
