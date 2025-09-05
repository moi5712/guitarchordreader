export const SECTION_CONFIG = {
    colors: {
      verse: '#60a5fa',
      chorus: '#f59e0b', 
      intro: '#10b981',
      bridge: '#8b5cf6',
      outro: '#ef4444',
      solo: '#f97316',
      'pre-chorus': '#06b6d4',
      interlude: '#84cc16',
      tag: '#ec4899',
      coda: '#6b7280'
    },
    
    typeNames: {
      verse: 'Verse',
      chorus: 'Chorus',
      intro: 'Intro',
      bridge: 'Bridge',
      outro: 'Outro',
      solo: 'Solo',
      'pre-chorus': 'Pre-Chorus',
      interlude: 'Interlude',
      tag: 'Tag',
      coda: 'Coda'
    },
  
    // 不需要編號的段落類型
    singleTypes: ['intro', 'outro', 'bridge', 'solo', 'coda']
  };

export const SECTION_TYPES = [
    { key: "intro", name: "前奏", class: "intro" },
    { key: "verse", name: "主歌", class: "verse" },
    { key: "pre-chorus", name: "預副歌", class: "pre-chorus" },
    { key: "chorus", name: "副歌", class: "chorus" },
    { key: "interlude", name: "間奏", class: "interlude" },
    { key: "solo", name: "獨奏", class: "solo" },
    { key: "bridge", name: "橋段", class: "bridge" },
    { key: "outro", name: "尾奏", class: "outro" }
  ];