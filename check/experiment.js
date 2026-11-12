// 基準の顔の確認の評定：平均顔3つと魅力が中くらいの20人を，女性の顔と男性の顔のブロックに分けて1人ずつ提示し，魅力を1〜7で評定してもらう。
// 全員が両方のブロックを評定する。ブロックの順とブロックの中の顔の順は参加者ごとに無作為。
// 各ブロックの前に，これから評定する顔の性別を説明する画面と練習1問を入れる。各ブロックの真ん中に注意の確認を1問入れる。
// 有効の基準は注意の確認2問の正答と，本番の評定の90%以上が同じ値ではないこと。顔の範囲が狭いので再評定の相関は基準にしない。
// 事前評定 (../experiment.js) の画面と文面を写して作った。割り当てのサーバーは使わない。

const url = new URLSearchParams(window.location.search);
const SIM = !!url.get('simulate');
const PID = Math.random().toString(36).slice(2, 12);
const FILE = `cheer_check_${PID}.csv`;
const jsPsych = initJsPsych({
  on_finish: () => {
    window.__finished = true;
    if (!CONFIG.datapipe_id && !SIM) jsPsych.data.get().localSave('csv', FILE);
  },
});
const ORDER = jsPsych.randomization.shuffle(['female', 'male']);
jsPsych.data.addProperties({ pid: PID, crowd_id: url.get('id') || '', block_order: ORDER.join('-') });

const fw = CONFIG.face_px.w, fh = CONFIG.face_px.h;
const src = (f) => (f.startsWith('avg_') ? `stimuli/${f}.png` : `../stimuli/${f}.png`);
const ends = `<div class="ends"><span>${CONFIG.scale_ends[0]}</span><span>${CONFIG.scale_ends[1]}</span></div>`;
const fixation = { type: jsPsychHtmlKeyboardResponse, stimulus: '<div class="fix">+</div>',
  choices: 'NO_KEYS', trial_duration: CONFIG.fixation_ms, data: { task: 'fixation' } };

function ratingTrial(face, sex, phase, block) {
  return {
    type: jsPsychHtmlButtonResponse,
    stimulus: `<p class="question">この顔はどのくらい魅力的ですか？</p>
      <img class="face" src="${src(face)}" width="${fw}" height="${fh}">`,
    choices: CONFIG.scale_labels,
    prompt: ends,
    data: { task: phase, face, face_sex: sex, block, is_average: face.startsWith('avg_') ? 1 : 0 },
    on_finish: (x) => { x.rating = Number(x.response) + 1; },   // ボタンの番号 0〜6 を 1〜7 にする
  };
}

function attentionTrial(answer, block) {
  return {
    type: jsPsychHtmlButtonResponse,
    stimulus: `<p class="question">この質問では，顔の画像はありません。「${answer}」を選んでください。</p>`,
    choices: CONFIG.scale_labels,
    prompt: ends,
    data: { task: 'attention', correct_answer: answer, block },
    on_finish: (x) => { x.rating = Number(x.response) + 1; x.correct = x.rating === answer ? 1 : 0; },
  };
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
const images = ['female', 'male'].flatMap((s) => [...CONFIG.faces[s], CONFIG.practice[s]]).map(src);
timeline.push({ type: jsPsychPreload, images, message: '画像を読み込んでいます。' });

if (!SIM) {
  // 同意文は事前評定と同じ。所要時間だけを変えた
  timeline.push({
    type: jsPsychHtmlButtonResponse,
    stimulus: `<div class="instr">
      <h3>顔の印象に関する調査</h3>
      <p>この度は，調査にご参加いただき，誠にありがとうございます。</p>
      <p>本研究では，人間の認知特性を明らかにすることを目的として，コンピュータを用いた調査を行います。所要時間は，準備や説明を含めて約5分です。</p>
      <p>本研究への参加は，参加者の皆様の自由な意思によるものであり，参加を辞退されても不利益は一切ございません。また，参加に同意された後でも，理由を問わず，途中で同意を撤回できます。その場合も，不利益が生じることはございません。</p>
      <p>なお，本研究を通じて得られた情報は，本研究に直接関わる目的以外には使用されません。研究の成果は学術論文や学会発表などで公表されることがありますが，データは匿名化し，統計処理した結果だけを公表するため，個人が特定されることはございません。匿名化したデータは，ほかの研究者が結果を検証できるよう，学術研究用のデータリポジトリで公開します。公開するデータには，氏名など個人を特定できる情報は含まれません。</p>
      <p>謝礼はYahoo!クラウドソーシングを通して支払われます。調査の最後に作業完了コードが表示されますので，必ず控えて，Yahoo!クラウドソーシングのページに戻って入力してください。</p>
      <p>本研究は，九州大学大学院人間環境学府倫理委員会の承認 (承認番号: ${CONFIG.ethics_no}) を得た上で実施されています。</p>
      <p>本研究に関するお問い合わせは，以下の連絡先にお願いいたします。<br>担当者: 山田祐樹<br>連絡先 (email): yamadayuk@gmail.com</p>
      <p>この調査では，コンピュータで作った人の顔の画像を見て評価していただきます。パソコンで参加してください。スマートフォンやタブレットでは参加できません。</p></div>`,
    choices: ['同意して参加する'],
    data: { task: 'consent' },
  });
  timeline.push({
    type: jsPsychHtmlButtonResponse,
    stimulus: () => (window.innerWidth < CONFIG.min_screen_width
      ? '<div class="instr"><p>この調査はパソコンの画面で行ってください。画面の幅が足りないため，ここで終了します。</p></div>'
      : '<div class="instr"><p>この調査はパソコンで行います。画面を最大化し，静かな場所で行ってください。所要時間は約5分です。</p></div>'),
    choices: () => (window.innerWidth < CONFIG.min_screen_width ? [] : ['次へ']),
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

timeline.push(textPage(`<p>この調査では，人の顔の写真を1枚ずつ見ていただきます。写真は白黒で，顔の内側だけが写っています。</p>
  <p>それぞれの顔がどのくらい魅力的かを，1 (まったく魅力的でない) から 7 (非常に魅力的) の7段階で，画面のボタンを押して答えてください。
  あまり考え込まず，見たときの印象で答えてください。</p>
  <p>調査は前半と後半に分かれています。一方では${CONFIG.block_name[ORDER[0]]}の顔を，もう一方では${CONFIG.block_name[ORDER[1]]}の顔を評価していただきます。</p>`));

ORDER.forEach((sex, b) => {
  const half = b === 0 ? '前半' : '後半';
  const intro = b === 0
    ? `<p>${half}では，${CONFIG.block_name[sex]}の顔を評価していただきます (全部で約25問)。</p><p>まず練習を1問行います。</p>`
    : `<p>前半は終わりです。</p><p>ここからは後半です。後半では，<b>${CONFIG.block_name[sex]}の顔</b>を評価していただきます (全部で約25問)。答え方は前半と同じです。</p><p>まず練習を1問行います。</p>`;
  timeline.push(textPage(intro, '練習を始める'));
  timeline.push(fixation, ratingTrial(CONFIG.practice[sex], sex, 'practice', b + 1));
  timeline.push(textPage(`<p>練習は終わりです。次から${half}の本番です。</p>`, '本番を始める'));
  const faces = jsPsych.randomization.shuffle(CONFIG.faces[sex]);
  const mid = Math.round(faces.length / 2);
  faces.forEach((f, i) => {
    timeline.push(fixation, ratingTrial(f, sex, 'rating', b + 1));
    if (i === mid - 1) timeline.push(attentionTrial(CONFIG.attention_answers[sex], b + 1));
  });
});

timeline.push({
  type: jsPsychHtmlKeyboardResponse, stimulus: '', choices: 'NO_KEYS', trial_duration: 0,
  data: { task: 'validity' },
  on_finish: (x) => {
    const v = validity();
    Object.assign(x, { valid: v.valid ? 1 : 0, exclusion: v.reason });
    jsPsych.data.addProperties({ valid: v.valid ? 1 : 0, exclusion: v.reason });
  },
});

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

// ?simulate=1 で無作為に答えて最後まで進む (動作確認用)。同意・画面の確認・年齢と性別の画面は飛ばす。
if (SIM) jsPsych.simulate(timeline, 'data-only');
else jsPsych.run(timeline);
