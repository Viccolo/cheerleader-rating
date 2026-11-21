const CONFIG = {
  datapipe_id: 'DOjg9NpCAveI',
  ethics_no: '2026-033',
  completion_code: '413986',
  face_px: { w: 144, h: 180 },
  radius: 130,
  fixation_ms: 500,
  array_ms: 1000,
  surround: {
    high: ['F012', 'F105', 'F039', 'F033', 'F057', 'F018'],
    low: ['F055', 'F119', 'F032', 'F005', 'F059', 'F103'],
  },
  centers: [
    { face: 'F058', pre: 2.9 }, { face: 'F078', pre: 2.8 },
    { face: 'F064', pre: 2.55 }, { face: 'F008', pre: 2.2 },
  ],
  practice: ['practice_F001', 'practice_F003'],
  fillers_per_position: 4,
  repeats: 6,
  break_after: 60,
  attention_after: [40, 80],
  scale_ends: ['まったく魅力的でない', '非常に魅力的'],
  min_screen: { w: 800, h: 600 },
};
