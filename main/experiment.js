const url = new URLSearchParams(window.location.search);
const SIM = !!url.get('simulate');
const PID = Math.random().toString(36).slice(2, 12);
const FILE = `cheer_main_${PID}.csv`;
const jsPsych = initJsPsych({
  on_finish: () => {
    window.__finished = true;
    if (!CONFIG.datapipe_id && !SIM) jsPsych.data.get().localSave('csv', FILE);
  },
});

const fw = CONFIG.face_px.w, fh = CONFIG.face_px.h, R = CONFIG.radius;
const AW = 2 * R + fw, AH = Math.round(2 * R * Math.sin(Math.PI / 3) + fh);
const SURROUND = jsPsych.randomization.sampleWithoutReplacement(CONFIG.surround_pool, CONFIG.n_surround);
jsPsych.data.addProperties({ pid: PID, crowd_id: url.get('id') || '', surround: SURROUND.join('-') });

const facePath = (f) => `../stimuli/${f}.png`;
const noisePath = (sign, id) => `stimuli/noise/${sign}_${String(id).padStart(3, '0')}.png`;

function arrayHTML(cond, center = CONFIG.base) {
  const imgs = [`<img src="${center}" width="${fw}" height="${fh}" style="left:${(AW - fw) / 2}px;top:${(AH - fh) / 2}px">`];
  if (cond === 'group') {
    SURROUND.forEach((f, k) => {
      const a = (k * Math.PI) / 3;
      const x = AW / 2 + R * Math.cos(a) - fw / 2, y = AH / 2 + R * Math.sin(a) - fh / 2;
      imgs.push(`<img src="${facePath(f)}" width="${fw}" height="${fh}" style="left:${x}px;top:${y}px">`);
    });
  }
  return `<div class="arr" style="width:${AW}px;height:${AH}px">${imgs.join('')}</div>`;
}

const fixation = { type: jsPsychHtmlKeyboardResponse, stimulus: '<div class="fix">+</div>',
  choices: 'NO_KEYS', trial_duration: CONFIG.fixation_ms, data: { task: 'fixation' } };
const blank = { type: jsPsychHtmlKeyboardResponse, stimulus: '', choices: 'NO_KEYS',
  trial_duration: CONFIG.blank_ms, data: { task: 'blank' } };

function show(html, task, extra = {}) {
  return { type: jsPsychHtmlKeyboardResponse, stimulus: html, choices: 'NO_KEYS',
    trial_duration: CONFIG.array_ms, data: { task, ...extra } };
}

function pairHTML(left, right, question) {
  return `<p class="question">${question}</p>
    <div class="pair"><div><img src="${left}" width="${fw}" height="${fh}"><div class="label">左 (F キー)</div></div>
    <div><img src="${right}" width="${fw}" height="${fh}"><div class="label">右 (J キー)</div></div></div>`;
}

function ciTrial(id, cond, phase) {
  const plusLeft = Math.random() < 0.5;
  const p = noisePath('plus', id), m = noisePath('minus', id);
  return { timeline: [fixation, show(arrayHTML(cond), 'array', { cond }), blank, {
    type: jsPsychHtmlKeyboardResponse,
    stimulus: pairHTML(plusLeft ? p : m, plusLeft ? m : p, 'さっき中央にあった顔に近いのは，どちらの顔ですか。'),
    choices: ['f', 'j'],
    data: { task: phase, cond, noise_id: id, plus_side: plusLeft ? 'left' : 'right' },
    on_finish: (d) => {
      d.response_side = d.response === 'f' ? 'left' : 'right';
      d.chose_plus = d.response_side === d.plus_side ? 1 : 0;
    },
  }] };
}

function attentionTrial(side) {
  return {
    type: jsPsychHtmlKeyboardResponse,
    stimulus: pairHTML(CONFIG.base, CONFIG.base, `この質問では，顔に関係なく<b>${side === 'left' ? '左' : '右'}</b>の顔を選んでください。`),
    choices: ['f', 'j'],
    data: { task: 'attention', correct_side: side },
    on_finish: (d) => { d.correct = (d.response === 'f' ? 'left' : 'right') === side ? 1 : 0; },
  };
}

function ratingItem(item, cond, face) {
  const center = face === 'base' ? CONFIG.base : facePath(face);
  const q = cond === 'group' ? '中央の顔はどのくらい魅力的でしたか？' : 'この顔はどのくらい魅力的でしたか？';
  return { timeline: [fixation, show(arrayHTML(cond, center), 'rating_show', { item, cond, face }), {
    type: jsPsychHtmlButtonResponse,
    stimulus: `<p class="question">${q}</p>`,
    choices: CONFIG.scale_labels,
    prompt: `<div class="ends"><span>${CONFIG.scale_ends[0]}</span><span>${CONFIG.scale_ends[1]}</span></div>`,
    data: { task: 'rating', item, cond, face },
    on_finish: (d) => { d.rating = Number(d.response) + 1; },
  }] };
}

function textPage(html, button = '次へ') {
  return { type: jsPsychHtmlButtonResponse, stimulus: `<div class="instr">${html}</div>`, choices: [button],
    data: { task: 'instruction' } };
}

function validity() {
  const d = jsPsych.data.get(), reason = [];
  if (!d.filter({ task: 'attention' }).values().every((x) => x.correct === 1)) reason.push('attention');
  const keys = d.filter({ task: 'ci' }).values().map((x) => x.response);
  const fShare = keys.filter((k) => k === 'f').length / keys.length;
  if (Math.max(fShare, 1 - fShare) >= .95) reason.push('same_key');
  const vals = d.filter({ task: 'rating' }).values().map((x) => x.rating), counts = {};
  vals.forEach((v) => { counts[v] = (counts[v] || 0) + 1; });
  if (Math.max(...Object.values(counts)) / vals.length >= .9) reason.push('same_value');
  return { valid: reason.length === 0, reason: reason.join('+') };
}

const timeline = [];
const ids = [...Array(SIM && url.get('n') ? Number(url.get('n')) : CONFIG.n_noise).keys()];
const images = [CONFIG.base, ...CONFIG.surround_pool.map(facePath), ...ids.flatMap((i) => [noisePath('plus', i), noisePath('minus', i)])];
timeline.push({ type: jsPsychPreload, images, message: '画像を読み込んでいます。しばらくお待ちください。' });

if (!SIM) {
  timeline.push({
    type: jsPsychHtmlButtonResponse,
    stimulus: `<div class="instr">
      <h3>顔の記憶に関する調査</h3>
      <p style="color:#e00000;font-weight:bold">以前に「顔の印象に関する調査」(題名の末尾に (2) が付いたものを含む) に参加した方は，この調査には参加できません。</p>
      <p>この度は，調査にご参加いただき，誠にありがとうございます。</p>
      <p>本研究では，人間の認知特性を明らかにすることを目的として，コンピュータを用いた調査を行います。所要時間は，準備や説明を含めて約25分です。</p>
      <p>本研究への参加は，参加者の皆様の自由な意思によるものであり，参加を辞退されても不利益は一切ございません。また，参加に同意された後でも，理由を問わず，途中で同意を撤回できます。その場合も，不利益が生じることはございません。</p>
      <p>なお，本研究を通じて得られた情報は，本研究に直接関わる目的以外には使用されません。研究の成果は学術論文や学会発表などで公表されることがありますが，データは匿名化し，統計処理した結果だけを公表するため，個人が特定されることはございません。匿名化したデータは，ほかの研究者が結果を検証できるよう，学術研究用のデータリポジトリで公開します。公開するデータには，氏名など個人を特定できる情報は含まれません。</p>
      <p>謝礼はYahoo!クラウドソーシングを通して支払われます。調査の最後に作業完了コードが表示されますので，必ず控えて，Yahoo!クラウドソーシングのページに戻って入力してください。</p>
      <p>本研究は，九州大学大学院人間環境学府倫理委員会の承認 (承認番号: ${CONFIG.ethics_no}) を得た上で実施されています。</p>
      <p>本研究に関するお問い合わせは，以下の連絡先にお願いいたします。<br>担当者: 山田祐樹<br>連絡先 (email): yamadayuk@gmail.com</p>
      <p>この調査では，コンピュータで作った人の顔の画像を見て答えていただきます。パソコンで参加してください。スマートフォンやタブレットでは参加できません。キーボードのFキーとJキーを使います。</p></div>`,
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
      : '<div class="instr"><p>静かな場所で，途中で席を離れずに行ってください。所要時間は約25分です。</p></div>'),
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

timeline.push(textPage(`<p>この調査では，はじめに画面の中央に「+」が表示され，そのあと女性の顔が1秒間表示されます。
  中央に顔が1人だけ表示されるときと，中央の顔の周りに別の6人の顔が一緒に表示されるときがあります。どちらの場合も，<b>中央の顔</b>をよく見て覚えてください。</p>
  <p>顔が消えたあと，左右に2枚の顔が表示されます。2枚は細かい模様だけが違います。さっき中央にあった顔に近いと思う顔を選んでください。左の顔ならFキー，右の顔ならJキーを押します。</p>
  <p>2枚の違いは小さいので，迷うことも多いと思います。そのときも，直感でどちらか一方を選んでください。全部で${2 * CONFIG.n_noise}回あり，${CONFIG.break_every}回ごとに休憩があります。</p>
  <p>まず練習を${CONFIG.n_practice}回行います。</p>`, '練習を始める'));

const practice = jsPsych.randomization.sampleWithoutReplacement(ids, CONFIG.n_practice);
const practiceCond = jsPsych.randomization.shuffle(practice.map((_, i) => (i % 2 ? 'group' : 'single')));
practice.forEach((id, i) => timeline.push(ciTrial(id, practiceCond[i], 'practice')));
timeline.push(textPage('<p>練習は終わりです。次から本番です。</p><p>左ならFキー，右ならJキーです。</p>', '本番を始める'));

const main = jsPsych.randomization.shuffle(ids.flatMap((id) => [{ id, cond: 'single' }, { id, cond: 'group' }]));
const attnSides = jsPsych.randomization.shuffle(['left', 'right']);
main.forEach((t, k) => {
  timeline.push(ciTrial(t.id, t.cond, 'ci'));
  const n = k + 1;
  if (CONFIG.attention_after.includes(n)) timeline.push(attentionTrial(attnSides.pop()));
  if (n % CONFIG.break_every === 0 && n < main.length) {
    timeline.push(textPage(`<p>${n}回が終わりました (全${main.length}回)。少し休憩してください。</p>
      <p>準備ができたら，下のボタンを押して続けてください。</p>`, '続ける'));
  }
});

timeline.push(textPage(`<p>顔を選ぶ課題は終わりです。</p>
  <p>最後に，顔の魅力を答えていただきます。顔が1秒間表示されたあと，その顔がどのくらい魅力的だったかを，1 (まったく魅力的でない) から 7 (非常に魅力的) の7段階で，画面のボタンを押して答えてください。
  周りに別の顔が一緒に表示されたときは，<b>中央の顔</b>の魅力を答えてください。全部で${2 * CONFIG.rating_repeats + CONFIG.n_surround}問です。</p>`, '始める'));
const items = [];
for (let i = 0; i < CONFIG.rating_repeats; i++) {
  items.push(['base_single', 'single', 'base'], ['base_group', 'group', 'base']);
}
SURROUND.forEach((f) => items.push(['surround_single', 'single', f]));
jsPsych.randomization.shuffle(items).forEach(([item, cond, face]) => timeline.push(ratingItem(item, cond, face)));

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
