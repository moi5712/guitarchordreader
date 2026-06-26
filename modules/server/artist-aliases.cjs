const aliasToPrimary = {
  'ぬゆり': 'Lanndo',
  'ハチ': '米津玄師',
};

// 自動產生反向對照表
const primaryToAlias = {};
for (const alias in aliasToPrimary) {
    const primary = aliasToPrimary[alias];
    if (!primaryToAlias[primary]) {
        primaryToAlias[primary] = [];
    }
    primaryToAlias[primary].push(alias);
}

module.exports = { aliasToPrimary, primaryToAlias };