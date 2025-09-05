/**
 * 模組統一匯入點 (Module Index)
 * 
 * 這個檔案作為所有模組的統一匯入點，
 * 其他檔案只需要從這裡匯入即可使用所有模組功能。
 * 
 * 使用方式：
 * import { Section, SECTION_CONFIG, parseChords } from './modules/index.js';
 */

// ==================== 配置模組匯入 ====================
import { SECTION_TYPES, SECTION_CONFIG } from './config/section-config.js';


// ==================== 工具模組匯入 ====================
import { parseChords } from './reader.js';


// ==================== 服務模組匯入 ====================

// ==================== 組件模組匯入 ====================
import Section from './components/Section.js';


// ==================== 統一匯出 ====================
export {
    // Components
    Section,

    // Configs
    SECTION_TYPES,
    SECTION_CONFIG,

    // Utils
    parseChords
};

// ==================== 使用說明 ====================
/**
 * 
 * import { Section, parseChords, SECTION_TYPES } from './modules/index.js';
 * 
 * const section = new Section('section1', SECTION_TYPES.VERSE, 'This is a [C]verse.');
 * const chords = parseChords('This is a [C]verse with [G]chords.');
 * console.log(chords); // ['C', 'G']
 * 
 */
