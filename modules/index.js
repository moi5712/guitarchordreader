/**
 * 這個檔案作為所有模組的統一匯入點，
 * 其他檔案只需要從這裡匯入即可使用所有模組功能。
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
