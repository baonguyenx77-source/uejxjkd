// ============================================================
// PHẦN 1/10 — IMPORTS & CONFIG
// ============================================================
import fastify from "fastify";
import cors from "@fastify/cors";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import fetch from "node-fetch";

const PORT = process.env.PORT || 3000;
const FETCH_INTERVAL = 5000;
const MAX_HISTORY = 500;
const PATTERN_FILE_URL = "https://raw.githubusercontent.com/huyhuyhu380-cell/ooocs/main/10kmaucau.txt";
const LOCAL_PATTERN_FILE = "10kmaucau.txt";
const CACHE_PATTERN_FILE = "10kmaucau_cached.txt";
const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LC79_MD5_URL = "https://wtxmd52.tele68.com/v1/txmd5/sessions";
const LC79_HU_URL  = "https://wtx.tele68.com/v1/tx/lite-sessions?cp=R&cl=R&pf=web&at=62385f65eb49fcb34c72a7d6489ad91d";
const HITCLUB_MD5_URL = "https://apihitclubhihi.onrender.com/api/hitclub/md5";
const HITCLUB_HU_URL  = "https://apihitclubhihi.onrender.com/api/hitclub/hu";
const MAX789_MD5_URL = "https://taixiumd5.maksh3979madfw.com/api/md5luckydice/GetSoiCau";
const MAX789_HU_URL  = "https://taixiu.maksh3979madfw.com/api/luckydice/GetSoiCau";
const SUNWIN_URL = "https://apisunwin-cocalhahaha.onrender.com/api/sunwin";

// === HỆ THỐNG PHÂN TẦNG THUẬT TOÁN ===
const ALGO_TIERS = {
    S: {
        weight: 3.0,
        minConfidence: 0.60,
        algorithms: ['pattern_core', 'bayesian', 'advanced_run', 'score_pattern']
    },
    A: {
        weight: 1.8,
        minConfidence: 0.55,
        algorithms: [
            'algoR_exact_pattern', 'algoT_fuzzy_pattern', 'algoU_suffix_pattern',
            'algoV_sequence_similarity', 'a_markov', 'h_adaptive_markov',
            'i_pattern_master', 'q_streak_probability', 'z_pattern_weighted'
        ]
    },
    B: {
        weight: 1.0,
        minConfidence: 0.50,
        algorithms: [
            'b_ngram', 'g_super_bridge', 'n_transition_matrix', 'o_run_length',
            'r_symmetry', 'w_consensus', 'y_stability', 'dynamic_transition'
        ]
    },
    C: {
        weight: 0.5,
        minConfidence: 0.55,
        algorithms: [
            'l_momentum_reversal', 'f_super_deep', 'e_transformer',
            'j_quantum_entropy', 'm_score_distribution', 'p_time_weighted',
            't_zigzag', 'u_wave', 'v_long_term', 'x_contrarian', 'algo5_freqrebalance'
        ]
    }
};

const TIER_OVERRIDE_THRESHOLD = 0.65;
const TIER_BOOST_THRESHOLD = 0.70;
const AUTO_DISABLE_MIN_SESSIONS = 30;
const AUTO_DISABLE_WR_THRESHOLD = 0.45;
const AUTO_REENABLE_SESSIONS = 50;
const WEIGHT_SMOOTH_FACTOR = 0.20;
const WEIGHT_MIN_FACTOR = 0.30;
const WEIGHT_MAX_FACTOR = 2.00;

const STATS = {
    STREAK_BREAK_PROB: {
        1: 0.50, 2: 0.52, 3: 0.35, 4: 0.45, 5: 0.58,
        6: 0.68, 7: 0.76, 8: 0.83, 9: 0.89, 10: 0.94,
        11: 0.97, 12: 0.985, 13: 0.99, 14: 0.995, 15: 0.998
    },
    MIN_CONFIDENCE_TO_PREDICT: 0.55,
    TRANSITION_MATRIX: { TT: 0.485, TX: 0.515, XT: 0.512, XX: 0.488 }
};
// ============================================================
// PHẦN 2/10 — PATTERN WEIGHTS & PRIORITY
// ============================================================

const PATTERN_WEIGHTS = {
    // === NHÓM CẦU CƠ BẢN (Trọng số cao) ===
    '1_1_pattern': 1.00, 
    '2_2_pattern': 0.95, 
    '3_3_pattern': 0.80,
    '4_4_pattern': 0.60,
    // ❌ ĐÃ XOÁ: '5_5_pattern' và '6_6_pattern' (quá hiếm, gây nhiễu)

    // === NHÓM CẦU ĐỐI XỨNG / XEN KẼ ===
    '1_2_1_pattern': 0.75, '2_1_2_pattern': 0.72, '3_2_3_pattern': 0.55,
    '2_3_2_pattern': 0.52, '4_2_4_pattern': 0.30, '1_3_1_pattern': 0.48,
    '3_1_3_pattern': 0.45, '1_4_1_pattern': 0.30, '4_1_4_pattern': 0.25,
    '2_2_1_pattern': 0.50, '1_1_2_pattern': 0.50, '1_2_2_pattern': 0.48,
    '2_1_1_pattern': 0.48, '3_3_1_pattern': 0.35, '1_1_3_pattern': 0.35,
    'zigzag_12212_pattern': 0.35, 'zigzag_21121_pattern': 0.35,
    'mirror_12221_pattern': 0.40, 'mirror_21112_pattern': 0.40,
    'mirror_23332_pattern': 0.25, 'mirror_32223_pattern': 0.25,
    'mirror_12321_pattern': 0.40, 'mirror_32123_pattern': 0.40,
    'alternating_21212_pattern': 0.55, 'alternating_12121_pattern': 0.55,
    'alternating_31313_pattern': 0.35, 'alternating_13131_pattern': 0.38,
    '1_2_1_2_1_2_pattern': 0.50, '2_1_2_1_2_1_pattern': 0.50,
    '2_2_1_loop_pattern': 0.48, '1_1_2_loop_pattern': 0.48,
    'block_111_222_pattern': 0.25, 'block_222_111_pattern': 0.25,
    'loop_221122_pattern': 0.45, 'loop_112211_pattern': 0.45,
    'loop_221221_pattern': 0.35, 'loop_112112_pattern': 0.35,

    // === NHÓM CẦU TỪ ẢNH (Đã tối ưu) ===
    'cycle_3_1_pattern': 0.65,      // Bẻ Cầu 3-1
    'cycle_1_3_pattern': 0.62,      // Theo Cầu 1-3
    'cycle_4_1_pattern': 0.50,      // Bẻ Cầu 4-1
    'cycle_1_4_pattern': 0.48,      // Theo Cầu 1-4
    'cycle_2_3_2_pattern': 0.60,    // Theo Cầu 2-3-2
    'cycle_3_2_3_pattern': 0.60,    // Bẻ Cầu 3-2-3
    'loop_2211_short': 0.70,        // Bẻ Cầu 2-2 (dạng 2211)
    'loop_1122_short': 0.70,        // Theo Cầu 2-2 (dạng 1122)
    'triple_1_pattern': 0.65,       // Cầu Đôi TT
    'triple_2_pattern': 0.60,       // Cầu Đôi XX
    'pyramid_12321_pattern': 0.45,  // Cầu Thang Lên
    'pyramid_32123_pattern': 0.45,  // Cầu Thang Lùi
    'growth_123_pattern': 0.40,     // Cầu Thang Lên (dạng tăng)
    'growth_321_pattern': 0.40,     // Cầu Thang Xuống
    'double_streak_flip': 0.68,     // Bẻ Cầu Đôi
    'score_zone_pattern': 0.60,
    'alternating_3_break': 0.62,

    // === NHÓM CẦU DÀI ===
    'medium_long_run_pattern': 0.98, 'long_run_pattern': 0.85,
    'very_long_run_pattern': 0.75, 'super_long_run_pattern': 0.65,
    'mega_long_run_pattern': 0.50, 'hyper_long_run_pattern': 0.40,
    'ultra_long_run_pattern': 0.35,

    // === NHÓM CẦU ĐẶC BIỆT CHO SUNWIN ===
    'sunwin_prng_pattern': 0.75,       // Giống PRNG
    'sunwin_key_lock_pattern': 0.80,   // Khóa Hạt
    'sunwin_repeating_pattern': 0.70,

    // === NHÓM CẦU NGẮN / CHUNG ===
    'short_run_pattern': 1.00, 
    'medium_run_pattern': 0.98,
    'random_pattern': 0.10,
    'detected_symmetry_pattern': 0.45, 
    'detected_alternating_pattern': 0.50,
    'detected_wave_pattern': 0.40, 
    'flip_streak_pattern': 0.55,
    'same_score_streak_pattern': 0.35,
    'same_score_reversal': 0.48,
    'high_score_cluster': 0.50,
    'low_score_cluster': 0.50,
};

const PRIORITY_PATTERNS = [
    '1_1_pattern', '2_2_pattern', 'short_run_pattern', 'medium_run_pattern',
    'loop_221122_pattern', 'loop_112211_pattern',
    '1122_loop_pattern', '2211_loop_pattern',
    'loop_2211_short', 'loop_1122_short',
    'cycle_3_1_pattern', 'cycle_1_3_pattern',
    'triple_1_pattern', 'triple_2_pattern',
    'double_streak_flip',
];

function getPatternWeight(patternType) {
    if (!patternType) return 0.10;
    let weight = PATTERN_WEIGHTS[patternType] || 0.10;
    if (PRIORITY_PATTERNS.includes(patternType)) weight *= 1.15;
    return Math.min(1.0, weight);
}
// ============================================================
// PHẦN 3/10 — TABLES & PATTERN DB LOADER
// ============================================================

const TABLES = {
    lc79_md5:    { name: "LC79-MD5", apiUrl: LC79_MD5_URL, history: [], currentSessionId: null, manager: null, parseType: 'lc79_md5' },
    lc79_hu:     { name: "LC79-HŨ",  apiUrl: LC79_HU_URL,  history: [], currentSessionId: null, manager: null, parseType: 'lc79_hu' },
    hitclub_md5: { name: "HitClub-MD5", apiUrl: HITCLUB_MD5_URL, history: [], currentSessionId: null, manager: null, parseType: 'hitclub' },
    hitclub_hu:  { name: "HitClub-HŨ",  apiUrl: HITCLUB_HU_URL,  history: [], currentSessionId: null, manager: null, parseType: 'hitclub' },
    max789_md5:  { name: "Max789-MD5", apiUrl: MAX789_MD5_URL, history: [], currentSessionId: null, manager: null, parseType: 'max789' },
    max789_hu:   { name: "Max789-HŨ",  apiUrl: MAX789_HU_URL,  history: [], currentSessionId: null, manager: null, parseType: 'max789' },
    sunwin:      { name: "Sunwin-TX", apiUrl: SUNWIN_URL, history: [], currentSessionId: null, manager: null, parseType: 'sunwin' }
};

const GAME_LABELS = {
    lc79_md5: "LC79 MD5", lc79_hu: "LC79 Hũ",
    hitclub_md5: "HitClub MD5", hitclub_hu: "HitClub Hũ",
    max789_md5: "Max789 MD5", max789_hu: "Max789 Hũ",
    sunwin: "Sunwin"
};

let PATTERN_DB = [];

// === PARSE 10k mẫu cầu ===
function parsePatternText(text) {
    const lines = text.split("\n");
    const patterns = [];
    let failedLines = 0;
    let sampleFail = null;
    for (const line of lines) {
        const m = line.match(/^\s*\d+\.\s*([TX]+)\s*-\s*([TX])\s*$/);
        if (m) {
            patterns.push({ seq: m[1], next: m[2], len: m[1].length });
        } else if (line.trim() && !line.startsWith('#') && !line.startsWith('//')) {
            failedLines++;
            if (!sampleFail) sampleFail = line.slice(0, 80);
        }
    }
    if (failedLines > 0 && patterns.length === 0) {
        console.error(`⚠️ Parse thất bại! ${failedLines} dòng không đúng format.`);
        console.error(`   Format yêu cầu: "1. TXTXTXTX - T"`);
        console.error(`   Ví dụ dòng lỗi: "${sampleFail}"`);
    } else if (failedLines > 0) {
        console.log(`⚠️ ${failedLines} dòng bỏ qua (format không hợp lệ)`);
    }
    return patterns;
}

// === LOAD FILE LOCAL 10kmaucau.txt ===
async function loadLocalPatternFile() {
    const localFile = path.join(__dirname, LOCAL_PATTERN_FILE);
    if (!fs.existsSync(localFile)) return [];
    try {
        console.log("📂 Đọc 10kmaucau.txt local...");
        const text = fs.readFileSync(localFile, 'utf-8');
        const patterns = parsePatternText(text);
        console.log(`✅ Local 10k: ${patterns.length} mẫu cầu`);
        return patterns;
    } catch (e) {
        console.error("❌ Lỗi đọc local 10k:", e.message);
        return [];
    }
}

// === FETCH GITHUB CÓ CACHE + FALLBACK ===
async function fetchPatternFile(url) {
    const cacheFile = path.join(__dirname, CACHE_PATTERN_FILE);
    
    try {
        // 1. Kiểm tra cache local
        if (fs.existsSync(cacheFile)) {
            const stats = fs.statSync(cacheFile);
            const age = Date.now() - stats.mtimeMs;
            
            if (age < CACHE_MAX_AGE_MS) {
                console.log(`📂 Dùng cache local (${(age / 3600000).toFixed(1)}h tuổi)`);
                const text = fs.readFileSync(cacheFile, 'utf-8');
                const patterns = parsePatternText(text);
                if (patterns.length > 0) {
                    console.log(`✅ Cache: ${patterns.length} mẫu cầu`);
                    return patterns;
                }
            } else {
                console.log(`⏰ Cache cũ (${(age / 3600000).toFixed(1)}h), tải lại...`);
            }
        }
        
        // 2. Tải từ GitHub
        console.log("📥 Đang tải 10k mẫu cầu từ GitHub...");
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        
        // 3. Lưu cache
        try {
            fs.writeFileSync(cacheFile, text, 'utf-8');
            console.log(`💾 Đã lưu cache: ${CACHE_PATTERN_FILE}`);
        } catch (e) {
            console.error("⚠️ Không lưu được cache:", e.message);
        }
        
        const patterns = parsePatternText(text);
        console.log(`✅ Đã load ${patterns.length} mẫu cầu từ GitHub`);
        return patterns;
    } catch (e) {
        console.error("❌ Lỗi đọc file mẫu cầu:", e.message);
        
        // 4. Fallback: dùng cache cũ dù hết hạn
        if (fs.existsSync(cacheFile)) {
            console.log("⚠️ Fallback: dùng cache cũ (hết hạn)");
            const text = fs.readFileSync(cacheFile, 'utf-8');
            const patterns = parsePatternText(text);
            if (patterns.length > 0) return patterns;
        }
        return [];
    }
}

// Học pattern từ file txt local
async function learnFromTxtFiles() {
    const txtFiles = ['1.txt','2.txt','3.txt','4.txt','5.txt','6.txt','7.txt','8.txt','9.txt',
                      '10.txt','11.txt','12.txt','13.txt','list.txt','list(1).txt','list(2).txt'];
    const learnedPatterns = [];
    let totalSessions = 0;
    for (const file of txtFiles) {
        try {
            const filePath = path.join(__dirname, file);
            if (!fs.existsSync(filePath)) continue;
            const content = fs.readFileSync(filePath, 'utf-8');
            const lines = content.split('\n');
            const records = [];
            for (const line of lines) {
                const m = line.match(/^\s*(\d+)\s+(\d+)\s+(TAI|XIU)\s+\[(\d+),(\d+),(\d+)\]\s+(\d+)/);
                if (m) records.push({ tx: m[3] === 'TAI' ? 'T' : 'X', total: parseInt(m[7]) });
            }
            if (records.length < 20) continue;
            totalSessions += records.length;
            const seq = records.map(r => r.tx).join('');
            for (let n = 3; n <= 12; n++) {
                for (let i = 0; i <= seq.length - n - 1; i++) {
                    learnedPatterns.push({ seq: seq.slice(i, i + n), next: seq[i + n], len: n });
                }
            }
            console.log(`📚 ${file}: học ${records.length} phiên`);
        } catch (e) {}
    }
    console.log(`✅ Tổng học local: ${learnedPatterns.length} patterns từ ${totalSessions} phiên`);
    return learnedPatterns;
}

// === LOAD PATTERN DB TỔNG HỢP ===
async function loadAllPatterns() {
    // 1. Ưu tiên file local 10kmaucau.txt nếu có
    let patterns10k = await loadLocalPatternFile();
    
    // 2. Nếu không có local → tải từ GitHub (có cache)
    if (patterns10k.length === 0) {
        patterns10k = await fetchPatternFile(PATTERN_FILE_URL);
    }
    
    // 3. Học thêm từ các file txt local
    const localPatterns = await learnFromTxtFiles();
    
    // 4. Gộp 2 nguồn
    const allPatterns = patterns10k.concat(localPatterns);
    console.log(`📊 Tổng hợp: ${patterns10k.length} (10k) + ${localPatterns.length} (local txt) = ${allPatterns.length} mẫu`);
    return allPatterns;
}
// ============================================================
// PHẦN 4/10 — PARSERS & UTILS & FEATURES
// ============================================================

function lastN(arr, n) { return arr.slice(Math.max(0, arr.length - n)); }
function sum(nums) { return nums.reduce((a, b) => a + b, 0); }
function avg(nums) { return nums.length ? sum(nums) / nums.length : 0; }
function stdDev(nums) {
    if (nums.length < 2) return 0;
    const m = avg(nums);
    return Math.sqrt(avg(nums.map(n => Math.pow(n - m, 2))));
}

function entropy(arr) {
    if (!arr.length) return 0;
    const freq = {};
    for (const v of arr) freq[v] = (freq[v] || 0) + 1;
    let e = 0, n = arr.length;
    for (const k in freq) { const p = freq[k] / n; e -= p * Math.log2(p); }
    return e;
}

function similarity(a, b) {
    if (a.length !== b.length) return 0;
    let m = 0;
    for (let i = 0; i < a.length; i++) if (a[i] === b[i]) m++;
    return m / a.length;
}

function checkSymmetry(arr) {
    if (arr.length < 3) return false;
    const len = arr.length;
    for (let i = 0; i < Math.floor(len / 2); i++) {
        if (arr[i] !== arr[len - 1 - i]) return false;
    }
    return true;
}

function checkAlternating(arr) {
    if (arr.length < 4) return false;
    let increasing = null;
    for (let i = 0; i < arr.length - 1; i++) {
        const diff = arr[i + 1] - arr[i];
        if (diff === 0) return false;
        const isInc = diff > 0;
        if (increasing === null) increasing = isInc;
        else if (increasing === isInc) return false;
    }
    return true;
}

function parseLc79Md5Data(data) {
    if (!data || !Array.isArray(data.list)) return [];
    return [...data.list].sort((a, b) => a.id - b.id).map(item => ({
        session: item.id, dice: item.dices, total: item.point,
        result: item.resultTruyenThong, tx: item.point >= 11 ? 'T' : 'X'
    }));
}

function parseLc79HuData(data) {
    if (!data || !Array.isArray(data.list)) return [];
    return [...data.list].sort((a, b) => a.id - b.id).map(item => ({
        session: item.id, dice: item.dices, total: item.point,
        result: item.resultTruyenThong, tx: item.point >= 11 ? 'T' : 'X'
    }));
}

function parseHitClubLines(data) {
    if (!data || !Array.isArray(data)) return [];
    return [...data].sort((a, b) => a.phien - b.phien).map(item => ({
        session: item.phien, dice: item.xuc_xac, total: item.Tong,
        result: item.ket_qua, tx: item.Tong >= 11 ? 'T' : 'X'
    }));
}

function parseMax789Data(data) {
    if (!data || !data.length) return [];
    return data.map(item => {
        const d1 = item.FirstDice || item.d1;
        const d2 = item.SecondDice || item.d2;
        const d3 = item.ThirdDice || item.d3;
        const total = d1 + d2 + d3;
        return {
            session: item.SessionId || parseInt(item.sid),
            dice: [d1, d2, d3], total,
            result: total > 10 ? "Tài" : "Xỉu",
            tx: total > 10 ? "T" : "X"
        };
    }).sort((a, b) => a.session - b.session);
}

function parseSunwinLines(data) {
    if (!Array.isArray(data)) return [];
    return data.map(item => {
        const session = Number(item.phien ?? 0);
        const dice = Array.isArray(item.xuc_xac) ? item.xuc_xac : [];
        const total = Number(item.Tong ?? item.tong ?? 0);
        const result = item.ket_qua ?? (total >= 11 ? 'Tài' : 'Xỉu');
        return { session, dice, total, result, tx: result === 'Tài' ? 'T' : 'X' };
    }).filter(r => r.session > 0).sort((a, b) => a.session - b.session);
}

function extractFeatures(history) {
    if (!history || history.length === 0) return {};
    const tx = history.map(h => h.tx);
    const totals = history.map(h => h.total);

    const freq = {};
    for (const v of tx) freq[v] = (freq[v] || 0) + 1;

    let runs = [], cur = tx[0], len = 1;
    for (let i = 1; i < tx.length; i++) {
        if (tx[i] === cur) len++;
        else { runs.push({ val: cur, len }); cur = tx[i]; len = 1; }
    }
    if (tx.length) runs.push({ val: cur, len });

    const meanTotal = avg(totals);
    const volatility = Math.sqrt(avg(totals.map(t => Math.pow(t - meanTotal, 2))));

    let tStreak = 0, xStreak = 0;
    for (let i = tx.length - 1; i >= 0; i--) { if (tx[i] === 'T') tStreak++; else break; }
    for (let i = tx.length - 1; i >= 0; i--) { if (tx[i] === 'X') xStreak++; else break; }

    let sameScoreStreak = 1;
    for (let i = totals.length - 1; i > 0; i--) {
        if (totals[i] === totals[i - 1]) sameScoreStreak++; else break;
    }

    const runLengths = runs.map(r => r.len);
    const last5RunLens = runLengths.slice(-5);

    let flipStreak = 0;
    for (let i = tx.length - 1; i > 0; i--) {
        if (tx[i] !== tx[i - 1]) flipStreak++; else break;
    }

    const tCount20 = tx.slice(-20).filter(t => t === 'T').length;
    const tCount30 = tx.slice(-30).filter(t => t === 'T').length;

    return {
        tx, totals, freq, runs,
        maxRun: runs.reduce((m, r) => Math.max(m, r.len), 0),
        meanTotal, volatility, entropy: entropy(tx),
        tStreak, xStreak, sameScoreStreak,
        lastRun: runs[runs.length - 1],
        runLengths, last5RunLens,
        isSymmetry: checkSymmetry(last5RunLens),
        isAlternating: checkAlternating(last5RunLens),
        flipStreak,
        tCount20, tCount30
    };
}
// ============================================================
// PHẦN 5/10 — DETECT PATTERN & PREDICT + 4 HÀM PHÂN TÍCH MỚI
// ============================================================

// === 4 HÀM PHÂN TÍCH NÂNG CAO ===
function detectScorePattern(history) {
    if (history.length < 10) return null;
    const totals = history.map(h => h.total);
    const recent = totals.slice(-15);

    const zones = recent.map(t => {
        if (t >= 11) return 'H';
        if (t >= 8) return 'M';
        return 'L';
    });

    const zoneStr = zones.join('');
    if (zoneStr.endsWith('HLHLH')) return { pred: 'X', conf: 0.58, reason: 'vùng điểm xen kẽ H-L' };
    if (zoneStr.endsWith('LHLHL')) return { pred: 'T', conf: 0.58, reason: 'vùng điểm xen kẽ L-H' };

    const highCount = recent.filter(t => t >= 12).length;
    const lowCount = recent.filter(t => t <= 9).length;
    if (highCount >= 10 && lowCount <= 2) return { pred: 'X', conf: 0.60, reason: 'cluster điểm cao' };
    if (lowCount >= 10 && highCount <= 2) return { pred: 'T', conf: 0.60, reason: 'cluster điểm thấp' };

    let sameScore = 1;
    for (let i = recent.length - 1; i > 0; i--) {
        if (recent[i] === recent[i - 1]) sameScore++;
        else break;
    }
    if (sameScore >= 3) {
        const lastTx = history[history.length - 1].tx;
        return { pred: lastTx === 'T' ? 'X' : 'T', conf: 0.55, reason: `điểm giống ${sameScore} phiên` };
    }

    const mean5 = avg(recent.slice(-5));
    const mean15 = avg(recent);
    if (mean5 > mean15 + 2.5) return { pred: 'X', conf: 0.55, reason: 'mean5 cao hơn mean15' };
    if (mean5 < mean15 - 2.5) return { pred: 'T', conf: 0.55, reason: 'mean5 thấp hơn mean15' };

    return null;
}

function detectAdvancedRunPattern(runs) {
    if (!runs || runs.length < 8) return null;
    const recent = runs.slice(-12);
    const lengths = recent.map(r => r.len);
    const values = recent.map(r => r.val);
    const pattern = lengths.join('');

    if (pattern.endsWith('3131')) {
        const lastRun = recent[recent.length - 1];
        if (lastRun.len === 3) return { pred: lastRun.val === 'T' ? 'X' : 'T', conf: 0.62, reason: 'chu kỳ 3-1' };
        return { pred: lastRun.val, conf: 0.58, reason: 'chu kỳ 3-1 (đang 1)' };
    }
    if (pattern.endsWith('1313')) {
        const lastRun = recent[recent.length - 1];
        if (lastRun.len === 1) return { pred: lastRun.val === 'T' ? 'X' : 'T', conf: 0.60, reason: 'chu kỳ 1-3' };
        return { pred: lastRun.val, conf: 0.58, reason: 'chu kỳ 1-3 (đang 3)' };
    }
    if (pattern.endsWith('232')) {
        const lastRun = recent[recent.length - 1];
        if (lastRun.len === 2) return { pred: lastRun.val === 'T' ? 'X' : 'T', conf: 0.60, reason: 'chu kỳ 2-3-2' };
    }
    if (pattern.endsWith('323')) {
        const lastRun = recent[recent.length - 1];
        if (lastRun.len === 3) return { pred: lastRun.val === 'T' ? 'X' : 'T', conf: 0.60, reason: 'chu kỳ 3-2-3' };
    }
    if (pattern.endsWith('2211')) {
        const lastRun = recent[recent.length - 1];
        if (lastRun.len === 1) return { pred: lastRun.val === 'T' ? 'X' : 'T', conf: 0.65, reason: 'loop 2-2-1-1' };
        if (lastRun.len === 2) return { pred: lastRun.val, conf: 0.60, reason: 'loop 2-2-1-1' };
    }
    if (pattern.endsWith('1122')) {
        const lastRun = recent[recent.length - 1];
        if (lastRun.len === 2) return { pred: lastRun.val === 'T' ? 'X' : 'T', conf: 0.65, reason: 'loop 1-1-2-2' };
        if (lastRun.len === 1) return { pred: lastRun.val, conf: 0.60, reason: 'loop 1-1-2-2' };
    }
    if (pattern.endsWith('123') || pattern.endsWith('234')) {
        return { pred: values[values.length - 1] === 'T' ? 'X' : 'T', conf: 0.48, reason: 'chuỗi tăng dần' };
    }
    if (pattern.endsWith('321') || pattern.endsWith('432')) {
        return { pred: values[values.length - 1] === 'T' ? 'X' : 'T', conf: 0.48, reason: 'chuỗi giảm dần' };
    }
    if (pattern.endsWith('12321')) {
        const lastRun = recent[recent.length - 1];
        return { pred: lastRun.val === 'T' ? 'X' : 'T', conf: 0.45, reason: 'pyramid 1-2-3-2-1' };
    }
    if (pattern.endsWith('32123')) {
        const lastRun = recent[recent.length - 1];
        return { pred: lastRun.val === 'T' ? 'X' : 'T', conf: 0.45, reason: 'pyramid 3-2-1-2-3' };
    }
    if (pattern.endsWith('111')) {
        const lastRun = recent[recent.length - 1];
        if (lastRun.len === 1) return { pred: lastRun.val, conf: 0.55, reason: 'bệt 1-1-1' };
    }
    if (pattern.endsWith('222')) {
        const lastRun = recent[recent.length - 1];
        if (lastRun.len === 2) return { pred: lastRun.val, conf: 0.52, reason: 'bệt 2-2-2' };
    }
    return null;
}

function detectDynamicTransition(history) {
    if (history.length < 40) return null;
    const tx = history.map(h => h.tx);
    const recent = tx.slice(-60);

    let curVal = recent[0], curLen = 1;
    const runs = [];
    for (let i = 1; i < recent.length; i++) {
        if (recent[i] === curVal) curLen++;
        else { runs.push({ val: curVal, len: curLen }); curVal = recent[i]; curLen = 1; }
    }
    runs.push({ val: curVal, len: curLen });

    if (runs.length < 5) return null;
    const lastRun = runs[runs.length - 1];

    const breakStats = {};
    for (let i = 0; i < runs.length - 1; i++) {
        const r = runs[i];
        const nextR = runs[i + 1];
        if (!breakStats[r.len]) breakStats[r.len] = { total: 0, breaks: 0 };
        breakStats[r.len].total++;
        if (nextR.len <= r.len) breakStats[r.len].breaks++;
    }

    if (breakStats[lastRun.len] && breakStats[lastRun.len].total >= 3) {
        const breakRate = breakStats[lastRun.len].breaks / breakStats[lastRun.len].total;
        if (breakRate > 0.65) {
            return { pred: lastRun.val === 'T' ? 'X' : 'T', conf: breakRate * 0.8, reason: `bệt ${lastRun.len} gãy ${(breakRate * 100).toFixed(0)}%` };
        }
        if (breakRate < 0.35) {
            return { pred: lastRun.val, conf: (1 - breakRate) * 0.7, reason: `bệt ${lastRun.len} tiếp tục` };
        }
    }
    return null;
}

function bayesianPredict(history) {
    if (history.length < 30) return null;
    const tx = history.map(h => h.tx);

    const tRatio = tx.filter(t => t === 'T').length / tx.length;
    let pT = tRatio, pX = 1 - tRatio;

    const last5 = tx.slice(-5);
    for (const t of last5) {
        if (t === 'T') { pT *= 1.15; pX *= 0.85; }
        else { pX *= 1.15; pT *= 0.85; }
    }

    let streak = 1;
    const lastVal = tx[tx.length - 1];
    for (let i = tx.length - 2; i >= 0; i--) {
        if (tx[i] === lastVal) streak++;
        else break;
    }
    const breakProb = STATS.STREAK_BREAK_PROB[Math.min(streak, 15)] || 0.999;
    if (lastVal === 'T') {
        pT *= (1 - breakProb) * 1.5;
        pX *= breakProb * 1.5;
    } else {
        pX *= (1 - breakProb) * 1.5;
        pT *= breakProb * 1.5;
    }

    const total = pT + pX;
    if (total === 0) return null;
    pT /= total; pX /= total;

    if (pT > 0.58) return { pred: 'T', conf: pT, reason: `Bayesian T=${(pT * 100).toFixed(0)}%` };
    if (pX > 0.58) return { pred: 'X', conf: pX, reason: `Bayesian X=${(pX * 100).toFixed(0)}%` };
    return null;
}

// === DỰ ĐOÁN RIÊNG CHO SUNWIN ===
function predictSunwin(history) {
    if (history.length < 20) return null;
    
    const tx = history.map(h => h.tx);
    const totals = history.map(h => h.total);
    const last10 = tx.slice(-10);
    
    // 1. Kiểm tra PRNG (Giống nhau)
    const last5Totals = totals.slice(-5);
    if (last5Totals.every(t => t === last5Totals[0])) {
        const lastTx = tx[tx.length - 1];
        return { 
            pred: lastTx === 'T' ? 'X' : 'T', 
            conf: 0.75, 
            reason: 'Sunwin: Phát hiện PRNG (điểm giống nhau)',
            pattern: 'sunwin_prng_pattern'
        };
    }

    // 2. Kiểm tra Khóa Hạt (Key Lock)
    if (last10.length >= 3) {
        const last3 = last10.slice(-3);
        if (last3[0] === last3[1] && last3[1] === last3[2]) {
            const last3Totals = totals.slice(-3);
            if (last3Totals[0] < last3Totals[1] && last3Totals[1] < last3Totals[2]) {
                return { pred: last3[2], conf: 0.70, reason: 'Sunwin: Khóa hạt (Tài tăng dần)', pattern: 'sunwin_key_lock_pattern' };
            }
            if (last3Totals[0] > last3Totals[1] && last3Totals[1] > last3Totals[2]) {
                return { pred: last3[2], conf: 0.70, reason: 'Sunwin: Khóa hạt (Xỉu giảm dần)', pattern: 'sunwin_key_lock_pattern' };
            }
        }
    }

    // 3. Theo cầu 1-1 (Xen kẽ)
    const last6 = tx.slice(-6);
    if (last6.length === 6) {
        let isAlternating = true;
        for (let i = 1; i < 6; i++) {
            if (last6[i] === last6[i-1]) { isAlternating = false; break; }
        }
        if (isAlternating) {
            return { pred: last6[5] === 'T' ? 'X' : 'T', conf: 0.65, reason: 'Sunwin: Cầu 1-1 (Xen kẽ)', pattern: 'sunwin_repeating_pattern' };
        }
    }

    return null;
}

// === DETECT PATTERN TYPE ===
function detectPatternType(runs, features = null) {
    if (!runs || runs.length < 3) return null;
    const lastRuns = runs.slice(-15);
    const lengths = lastRuns.map(r => r.len);
    const values = lastRuns.map(r => r.val);

    // === Nhận diện Cầu Thang Lùi (Staircase Down) ===
    if (lengths.length >= 4) {
        const last4 = lengths.slice(-4);
        if (last4[0] > last4[1] && last4[1] > last4[2] && last4[2] > last4[3]) {
            return 'growth_321_pattern';
        }
    }

    // === Nhận diện Cầu Đôi (Double) ===
    if (lengths.length >= 2 && lengths[lengths.length - 1] === 2) {
        if (lengths[lengths.length - 2] === 2) {
            const lastVal = values[values.length - 1];
            if (lastVal === 'T') return 'triple_1_pattern';
            if (lastVal === 'X') return 'triple_2_pattern';
        }
    }

    if (lengths.length >= 4) {
        const tail4 = lengths.slice(-4).join('');
        if (tail4 === '3131') return 'cycle_3_1_pattern';
        if (tail4 === '1313') return 'cycle_1_3_pattern';
        if (tail4 === '4141') return 'cycle_4_1_pattern';
        if (tail4 === '1414') return 'cycle_1_4_pattern';
        if (tail4 === '2211') return 'loop_2211_short';
        if (tail4 === '1122') return 'loop_1122_short';
    }
    if (lengths.length >= 3) {
        const tail3 = lengths.slice(-3).join('');
        if (tail3 === '222') return 'triple_2_pattern';
        if (tail3 === '111') return 'triple_1_pattern';
        const tl3 = lengths.slice(-3);
        if (tl3[0] < tl3[1] && tl3[1] < tl3[2]) return 'growth_123_pattern';
        if (tl3[0] > tl3[1] && tl3[1] > tl3[2]) return 'growth_321_pattern';
    }
    if (lengths.length >= 5) {
        const tail5 = lengths.slice(-5).join('');
        if (tail5 === '23232') return 'cycle_2_3_2_pattern';
        if (tail5 === '32323') return 'cycle_3_2_3_pattern';
        if (tail5 === '12321') return 'pyramid_12321_pattern';
        if (tail5 === '32123') return 'pyramid_32123_pattern';
    }

    if (lengths.length >= 5 && lengths.slice(-5).every(l => l === 1)) {
        const vals = values.slice(-6);
        if (vals.every((v, i) => i === 0 || v !== vals[i - 1])) return '1_1_pattern';
    }
    if (lengths.length >= 4 && lengths.slice(-4).every(l => l === 2)) {
        const vals = values.slice(-5);
        if (vals.every((v, i) => i === 0 || v !== vals[i - 1])) return '2_2_pattern';
    }
    if (lengths.length >= 3 && lengths.slice(-3).every(l => l === 3)) return '3_3_pattern';
    if (lengths.length >= 3 && lengths.slice(-3).every(l => l === 4)) return '4_4_pattern';
    // ❌ ĐÃ XOÁ: 5_5_pattern và 6_6_pattern (quá hiếm, gây nhiễu dự đoán)

    if (lengths.length >= 5) {
        const j = lengths.slice(-5).join('');
        if (j === '12121') return '1_2_1_pattern';
        if (j === '21212') return '2_1_2_pattern';
        if (j === '32323') return '3_2_3_pattern';
        if (j === '23232') return '2_3_2_pattern';
        if (j === '42424') return '4_2_4_pattern';
        if (j === '13131') return '1_3_1_pattern';
        if (j === '31313') return '3_1_3_pattern';
        if (j === '14141') return '1_4_1_pattern';
        if (j === '41414') return '4_1_4_pattern';
        if (j === '22122') return '2_2_1_pattern';
        if (j === '11211') return '1_1_2_pattern';
        if (j === '12212') return '1_2_2_pattern';
        if (j === '21121') return '2_1_1_pattern';
        if (j === '33133') return '3_3_1_pattern';
        if (j === '11311') return '1_1_3_pattern';
        if (j === '12221') return 'mirror_12221_pattern';
        if (j === '21112') return 'mirror_21112_pattern';
        if (j === '12321') return 'mirror_12321_pattern';
        if (j === '32123') return 'mirror_32123_pattern';
        if (j === '13313') return 'spike_13313_pattern';
        if (j === '31131') return 'spike_31131_pattern';
    }
    if (lengths.length >= 6) {
        const j = lengths.slice(-6).join('');
        if (j === '121212') return '1_2_1_2_1_2_pattern';
        if (j === '212121') return '2_1_2_1_2_1_pattern';
        if (j === '221221') return '2_2_1_loop_pattern';
        if (j === '112112') return '1_1_2_loop_pattern';
        if (j === '123123') return 'repeat_123123_pattern';
        if (j === '321321') return 'repeat_321321_pattern';
        if (j === '111222') return 'block_111_222_pattern';
        if (j === '222111') return 'block_222_111_pattern';
        if (j === '221122') return 'loop_221122_pattern';
        if (j === '112211') return 'loop_112211_pattern';
    }
    if (lengths.length >= 8) {
        const j = lengths.slice(-8).join('');
        if (j === '11221122') return '1122_loop_pattern';
        if (j === '22112211') return '2211_loop_pattern';
        if (j === '11211211') return '112_repeat_pattern';
        if (j === '22122122') return '221_repeat_pattern';
    }

    const lastRun = lastRuns[lastRuns.length - 1];
    if (lastRun) {
        if (lastRun.len >= 15) return 'ultra_long_run_pattern';
        if (lastRun.len >= 12) return 'mega_long_run_pattern';
        if (lastRun.len >= 10) return 'super_long_run_pattern';
        if (lastRun.len >= 8) return 'very_long_run_pattern';
        if (lastRun.len >= 7) return 'long_run_pattern';
        if (lastRun.len >= 5) return 'medium_long_run_pattern';
        if (lastRun.len >= 4) return 'medium_run_pattern';
        if (lastRun.len >= 3) return 'short_run_pattern';
    }

    if (features) {
        if (features.isSymmetry && lengths.length >= 5) return 'detected_symmetry_pattern';
        if (features.isAlternating && lengths.length >= 5) return 'detected_alternating_pattern';
        if (features.flipStreak >= 5) return 'flip_streak_pattern';
        if (features.sameScoreStreak >= 3) return 'same_score_reversal';
    }
    return 'random_pattern';
}

// === PREDICT NEXT FROM PATTERN ===
function predictNextFromPattern(patternType, runs, lastTx) {
    if (!patternType) return { pred: null, confidence: 0.5, reason: "Không có pattern" };
    const lastRun = runs[runs.length - 1];
    if (!lastRun) return { pred: null, confidence: 0.5, reason: "Không có run" };
    const flip = (v) => v === 'T' ? 'X' : 'T';
    const sbp = (len) => STATS.STREAK_BREAK_PROB[Math.min(len, 15)] || 0.999;

    if (patternType === 'cycle_3_1_pattern') {
        if (lastRun.len === 3) return { pred: flip(lastRun.val), confidence: 0.62, reason: 'chu kỳ 3-1: hết 3→đảo' };
        return { pred: lastRun.val, confidence: 0.58, reason: 'chu kỳ 3-1: đang 1' };
    }
    if (patternType === 'cycle_1_3_pattern') {
        if (lastRun.len === 1) return { pred: flip(lastRun.val), confidence: 0.60, reason: 'chu kỳ 1-3: hết 1→đảo' };
        return { pred: lastRun.val, confidence: 0.58, reason: 'chu kỳ 1-3: đang 3' };
    }
    if (patternType === 'cycle_4_1_pattern') {
        if (lastRun.len === 4) return { pred: flip(lastRun.val), confidence: 0.50, reason: 'chu kỳ 4-1' };
        return { pred: lastRun.val, confidence: 0.48, reason: 'chu kỳ 4-1' };
    }
    if (patternType === 'cycle_1_4_pattern') {
        if (lastRun.len === 1) return { pred: flip(lastRun.val), confidence: 0.50, reason: 'chu kỳ 1-4' };
        return { pred: lastRun.val, confidence: 0.48, reason: 'chu kỳ 1-4' };
    }
    if (patternType === 'cycle_2_3_2_pattern') {
        if (lastRun.len === 2) return { pred: flip(lastRun.val), confidence: 0.60, reason: 'chu kỳ 2-3-2' };
        return { pred: lastRun.val, confidence: 0.55, reason: 'chu kỳ 2-3-2' };
    }
    if (patternType === 'cycle_3_2_3_pattern') {
        if (lastRun.len === 3) return { pred: flip(lastRun.val), confidence: 0.60, reason: 'chu kỳ 3-2-3' };
        return { pred: lastRun.val, confidence: 0.55, reason: 'chu kỳ 3-2-3' };
    }
    if (patternType === 'loop_2211_short' || patternType === 'loop_1122_short') {
        if (lastRun.len <= 1) return { pred: lastRun.val, confidence: 0.62, reason: 'loop 2-2-1-1' };
        return { pred: flip(lastRun.val), confidence: 0.65, reason: 'loop: hết 2→đảo' };
    }
    if (patternType === 'triple_2_pattern') {
        if (lastRun.len === 2) return { pred: lastRun.val, confidence: 0.55, reason: 'triple 2-2-2' };
        return { pred: flip(lastRun.val), confidence: 0.58, reason: 'triple: hết 2→đảo' };
    }
    if (patternType === 'triple_1_pattern') {
        if (lastRun.len === 1) return { pred: lastRun.val, confidence: 0.58, reason: 'triple 1-1-1' };
        return { pred: flip(lastRun.val), confidence: 0.55, reason: 'triple: hết 1→đảo' };
    }
    if (patternType === 'pyramid_12321_pattern' || patternType === 'pyramid_32123_pattern') {
        return { pred: flip(lastRun.val), confidence: 0.48, reason: 'pyramid: đảo chiều' };
    }
    if (patternType === 'growth_123_pattern' || patternType === 'growth_321_pattern') {
        return { pred: flip(lastRun.val), confidence: 0.45, reason: 'chuỗi tăng/giảm: đảo' };
    }
    if (patternType === 'same_score_reversal') {
        return { pred: flip(lastTx), confidence: 0.52, reason: 'điểm giống nhau→đảo' };
    }

    if (patternType === '1_1_pattern') return { pred: flip(lastTx), confidence: 0.60, reason: 'cầu xen kẽ 1-1 → đảo chiều' };
    if (patternType === '2_2_pattern') return { pred: lastRun.len === 2 ? flip(lastRun.val) : lastRun.val, confidence: 0.58, reason: `xen kẽ 2-2 nhịp ${lastRun.len}` };
    if (patternType === '3_3_pattern') return { pred: lastRun.len === 3 ? flip(lastRun.val) : lastRun.val, confidence: 0.60, reason: 'xen kẽ 3-3' };
    if (patternType === '4_4_pattern') return { pred: lastRun.len === 4 ? flip(lastRun.val) : lastRun.val, confidence: 0.62, reason: 'xen kẽ 4-4' };
    // ❌ ĐÃ XOÁ 2 dòng 5_5_pattern và 6_6_pattern

    if (patternType === 'short_run_pattern' || patternType === 'medium_run_pattern') {
        const p = 1 - sbp(lastRun.len);
        return { pred: p > 0.5 ? lastRun.val : flip(lastRun.val), confidence: Math.max(p, 1 - p), reason: `bệt ${lastRun.len}: gãy ${(sbp(lastRun.len) * 100).toFixed(0)}%` };
    }
    if (patternType === 'medium_long_run_pattern') return { pred: lastRun.val, confidence: 0.55, reason: `bệt ${lastRun.len}: tiếp tục` };
    if (patternType === 'long_run_pattern') return { pred: lastRun.len >= 8 ? flip(lastRun.val) : lastRun.val, confidence: lastRun.len >= 8 ? 0.8 : 0.6, reason: `bệt ${lastRun.len}` };
    if (patternType === 'very_long_run_pattern') return { pred: flip(lastRun.val), confidence: sbp(lastRun.len), reason: `bệt ${lastRun.len}: gãy ${(sbp(lastRun.len) * 100).toFixed(0)}%` };
    if (patternType === 'super_long_run_pattern') return { pred: flip(lastRun.val), confidence: 0.94, reason: `bệt ${lastRun.len}: gãy 94%` };
    if (patternType === 'mega_long_run_pattern') return { pred: flip(lastRun.val), confidence: 0.98, reason: `bệt ${lastRun.len}: gãy 98%` };
    if (patternType === 'ultra_long_run_pattern') return { pred: flip(lastRun.val), confidence: 0.999, reason: `bệt ${lastRun.len}: gãy 99.9%` };
    if (patternType === '1_2_1_pattern') return { pred: lastRun.len === 1 ? flip(lastRun.val) : lastRun.val, confidence: 0.62, reason: 'cầu 1-2-1' };
    if (patternType === '2_1_2_pattern') return { pred: lastRun.len === 2 ? flip(lastRun.val) : lastRun.val, confidence: 0.62, reason: 'cầu 2-1-2' };
    if (patternType === '3_2_3_pattern') return { pred: lastRun.len === 3 ? flip(lastRun.val) : lastRun.val, confidence: 0.65, reason: 'cầu 3-2-3' };
    if (patternType === '1_3_1_pattern') return { pred: lastRun.len === 1 ? flip(lastRun.val) : lastRun.val, confidence: 0.60, reason: 'cầu 1-3-1' };
    if (patternType === '1_2_1_2_1_2_pattern' || patternType === '2_1_2_1_2_1_pattern') return { pred: lastRun.len === 1 ? flip(lastRun.val) : lastRun.val, confidence: 0.65, reason: 'chu kỳ 1-2' };
    if (patternType.includes('loop')) return { pred: lastRun.len === 2 ? flip(lastRun.val) : lastRun.val, confidence: 0.63, reason: 'loop pattern' };
    if (patternType.includes('block')) return { pred: lastRun.len === 3 ? flip(lastRun.val) : lastRun.val, confidence: 0.68, reason: 'block pattern' };
    if (patternType.includes('mirror')) return { pred: lastRun.len === 1 ? flip(lastRun.val) : lastRun.val, confidence: 0.62, reason: 'đối xứng gương' };
    if (patternType === 'detected_symmetry_pattern') return { pred: flip(lastTx), confidence: 0.60, reason: 'pattern đối xứng' };
    if (patternType === 'detected_alternating_pattern') return { pred: flip(lastTx), confidence: 0.62, reason: 'pattern xen kẽ' };
    if (patternType === 'flip_streak_pattern') return { pred: lastTx, confidence: 0.60, reason: 'chuỗi đảo liên tiếp' };
    return { pred: null, confidence: 0.5, reason: 'pattern không tin cậy' };
}
// ============================================================
// PHẦN 6/10 — CÁC THUẬT TOÁN ALGO (A→Z)
// ============================================================

function algoR_ExactPatternMatch(history) {
    if (!PATTERN_DB.length || history.length < 8) return null;
    const tx = history.map(h => h.tx);
    for (const len of [15, 14, 13, 12, 11, 10, 9, 8]) {
        if (tx.length < len) continue;
        const target = tx.slice(-len).join('');
        const matches = PATTERN_DB.filter(p => p.seq === target);
        if (matches.length >= 2) {
            const tC = matches.filter(m => m.next === 'T').length;
            const xC = matches.filter(m => m.next === 'X').length;
            const conf = Math.abs(tC - xC) / matches.length;
            if (conf >= 0.5) return tC > xC ? 'T' : 'X';
        }
    }
    return null;
}

function algoT_FuzzyPatternMatch(history) {
    if (!PATTERN_DB.length || history.length < 15) return null;
    const tx = history.map(h => h.tx);
    const len = 15;
    if (tx.length < len) return null;
    const target = tx.slice(-len).join('');
    const scored = [];
    for (const p of PATTERN_DB) {
        if (p.seq.length !== len) continue;
        let match = 0;
        for (let i = 0; i < len; i++) if (p.seq[i] === target[i]) match++;
        const score = match / len;
        if (score >= 0.8) scored.push({ next: p.next, weight: score * score });
    }
    if (scored.length < 5) return null;
    let wT = 0, wX = 0;
    for (const s of scored) { if (s.next === 'T') wT += s.weight; else wX += s.weight; }
    const total = wT + wX;
    if (total === 0) return null;
    const conf = Math.abs(wT - wX) / total;
    if (conf >= 0.15) return wT > wX ? 'T' : 'X';
    return null;
}

function algoU_SuffixPatternMatch(history) {
    if (!PATTERN_DB.length || history.length < 6) return null;
    const tx = history.map(h => h.tx);
    let bestPred = null, bestScore = 0;
    for (const suffixLen of [7, 6, 5, 4, 3]) {
        if (tx.length < suffixLen) continue;
        const suffix = tx.slice(-suffixLen).join('');
        const matches = PATTERN_DB.filter(p => p.seq.endsWith(suffix));
        if (matches.length < 3) continue;
        const tC = matches.filter(m => m.next === 'T').length;
        const xC = matches.filter(m => m.next === 'X').length;
        const conf = Math.abs(tC - xC) / matches.length;
        const score = conf * Math.min(1, matches.length / 20) * (suffixLen / 7);
        if (score > bestScore && conf >= 0.4) {
            bestScore = score;
            bestPred = tC > xC ? 'T' : 'X';
        }
    }
    return bestPred;
}

function algoV_SequenceSimilarity(history) {
    if (!PATTERN_DB.length || history.length < 15) return null;
    const tx = history.map(h => h.tx);
    const target = tx.slice(-15).join('');
    const weights = { T: 0, X: 0 };
    const sample = PATTERN_DB.length > 5000 ? PATTERN_DB.filter((_, i) => i % 2 === 0) : PATTERN_DB;
    for (const p of sample) {
        const sim = similarity(p.seq, target);
        if (sim >= 0.65) weights[p.next] += Math.pow(sim, 3);
    }
    const total = weights.T + weights.X;
    if (total < 2) return null;
    const conf = Math.abs(weights.T - weights.X) / total;
    if (conf >= 0.2) return weights.T > weights.X ? 'T' : 'X';
    return null;
}

function algo5_freqRebalance(history) {
    if (history.length < 20) return null;
    const features = extractFeatures(history);
    const { freq, entropy: e } = features;
    const tC = freq['T'] || 0;
    const xC = freq['X'] || 0;
    const diff = Math.abs(tC - xC);
    const total = tC + xC;
    const threshold = e > 0.9 ? 0.45 : (e < 0.4 ? 0.65 : 0.55);
    const recent = history.slice(-30);
    const rT = recent.filter(h => h.tx === 'T').length;
    const rX = recent.filter(h => h.tx === 'X').length;
    const rTotal = rT + rX;
    if (total > 0 && rTotal > 0) {
        const combinedRatio = (diff / total) * 0.4 + (Math.abs(rT - rX) / rTotal) * 0.6;
        if (combinedRatio > threshold) {
            if (rT > rX + 2) return 'X';
            if (rX > rT + 2) return 'T';
        }
    }
    return null;
}

function algoA_markov(history) {
    if (history.length < 15) return null;
    const tx = history.map(h => h.tx);
    let maxOrder = history.length < 30 ? 3 : 5;
    let bestPred = null, bestScore = -1;
    for (let order = 2; order <= maxOrder; order++) {
        if (tx.length < order + 8) continue;
        const transitions = {};
        const totalT = tx.length - order;
        for (let i = 0; i < totalT; i++) {
            const key = tx.slice(i, i + order).join('');
            const next = tx[i + order];
            const w = Math.pow(0.95, totalT - i - 1);
            if (!transitions[key]) transitions[key] = { T: 0, X: 0 };
            transitions[key][next] += w;
        }
        const c = transitions[tx.slice(-order).join('')];
        if (c && (c.T + c.X) > 0.5) {
            const conf = Math.abs(c.T - c.X) / (c.T + c.X);
            const pred = c.T > c.X ? 'T' : 'X';
            const score = conf * (order / maxOrder) * Math.min(1, (c.T + c.X) / 10);
            if (score > bestScore) { bestScore = score; bestPred = pred; }
        }
    }
    return bestPred;
}

function algoB_ngram(history) {
    if (history.length < 30) return null;
    const tx = history.map(h => h.tx);
    let bestPred = null, bestConf = 0;
    for (const n of [7, 6, 5, 4, 3]) {
        if (tx.length < n * 2) continue;
        const target = tx.slice(-n).join('');
        const matches = [];
        for (let i = 0; i <= tx.length - n - 1; i++) {
            if (tx.slice(i, i + n).join('') === target) matches.push({ next: tx[i + n], distance: tx.length - i });
        }
        if (matches.length >= 2) {
            const w = { T: 0, X: 0 };
            let tw = 0;
            for (const m of matches) { const wt = 1 / (m.distance * 0.5 + 1); w[m.next] += wt; tw += wt; }
            if (tw > 0) {
                const conf = Math.abs(w.T - w.X) / tw;
                if (conf > bestConf) { bestConf = conf; bestPred = w.T > w.X ? 'T' : 'X'; }
            }
        }
    }
    return bestConf > 0.3 ? bestPred : null;
}

function algoG_SuperBridgePredictor(history) {
    const features = extractFeatures(history);
    const { runs } = features;
    if (runs.length < 4) return null;
    const lastRun = runs[runs.length - 1];
    if (lastRun.len >= 10) return lastRun.val === 'T' ? 'X' : 'T';
    if (lastRun.len >= 8) return lastRun.val === 'T' ? 'X' : 'T';
    if (lastRun.len >= 7) {
        const avgRun = avg(runs.map(r => r.len));
        if (lastRun.len > avgRun * 2) return lastRun.val === 'T' ? 'X' : 'T';
    }
    if (lastRun.len >= 5 && lastRun.len <= 6) {
        const avgRun = avg(runs.map(r => r.len));
        if (lastRun.len > avgRun * 1.8) return lastRun.val === 'T' ? 'X' : 'T';
    }
    return null;
}

function algoH_AdaptiveMarkov(history) {
    if (history.length < 25) return null;
    const tx = history.map(h => h.tx);
    const votes = { T: 0, X: 0 };
    for (const order of [2, 3, 4, 5]) {
        if (tx.length < order + 5) continue;
        const transitions = {};
        for (let i = 0; i <= tx.length - order - 1; i++) {
            const key = tx.slice(i, i + order).join('');
            const next = tx[i + order];
            if (!transitions[key]) transitions[key] = { T: 0, X: 0 };
            transitions[key][next]++;
        }
        const c = transitions[tx.slice(-order).join('')];
        if (c && c.T + c.X >= 2) {
            const pred = c.T > c.X ? 'T' : 'X';
            const conf = Math.abs(c.T - c.X) / (c.T + c.X);
            votes[pred] += conf * (order / 10);
        }
    }
    if (votes.T + votes.X > 0.3) return votes.T > votes.X ? 'T' : 'X';
    return null;
}

function algoI_PatternMaster(history) {
    if (history.length < 25) return null;
    const features = extractFeatures(history);
    const { runs } = features;
    if (runs.length < 5) return null;
    const recentRuns = runs.slice(-8);
    const runLengths = recentRuns.map(r => r.len);
    const runValues = recentRuns.map(r => r.val);
    const runPattern = runLengths.join('');
    const lastVal = runValues[runValues.length - 1];
    let strength = { T: 0, X: 0 };
    const lib = [
        { p: '12121', pred: lastVal === 'T' ? 'X' : 'T', s: 0.72 },
        { p: '21212', pred: lastVal === 'T' ? 'T' : 'X', s: 0.72 },
        { p: '121212', pred: lastVal === 'T' ? 'X' : 'T', s: 0.78 },
        { p: '212121', pred: lastVal === 'T' ? 'T' : 'X', s: 0.78 }
    ];
    for (const l of lib) if (runPattern.includes(l.p)) strength[l.pred] += l.s;
    const total = strength.T + strength.X;
    if (total > 0) {
        const conf = Math.abs(strength.T - strength.X) / total;
        if (conf > 0.25) return strength.T > strength.X ? 'T' : 'X';
    }
    return null;
}

function algoN_TransitionMatrix(history) {
    if (history.length < 30) return null;
    const tx = history.map(h => h.tx);
    const recent = tx.slice(-50);
    const t = { TT: 0, TX: 0, XT: 0, XX: 0 };
    for (let i = 1; i < recent.length; i++) t[recent[i - 1] + recent[i]]++;
    const last = recent[recent.length - 1];
    const totalFromLast = last === 'T' ? t.TT + t.TX : t.XT + t.XX;
    if (totalFromLast < 5) return null;
    const probFlip = last === 'T' ? t.TX / totalFromLast : t.XT / totalFromLast;
    if (probFlip > 0.55) return last === 'T' ? 'X' : 'T';
    if (probFlip < 0.45) return last;
    return null;
}

function algoQ_StreakProbability(history) {
    if (history.length < 15) return null;
    const features = extractFeatures(history);
    const lastRun = features.runs[features.runs.length - 1];
    if (!lastRun) return null;
    const bp = STATS.STREAK_BREAK_PROB[Math.min(lastRun.len, 15)] || 0.999;
    if (bp > 0.55) return lastRun.val === 'T' ? 'X' : 'T';
    if (bp < 0.45) return lastRun.val;
    return null;
}

function algoL_MomentumReversal(history) {
    if (history.length < 30) return null;
    const totals = history.map(h => h.total);
    const m5 = avg(totals.slice(-5));
    const m20 = avg(totals.slice(-20));
    if (m5 > 12.5) return 'X';
    if (m5 < 8.5) return 'T';
    if (m5 > m20 + 2) return 'X';
    if (m5 < m20 - 2) return 'T';
    return null;
}

function algoF_SuperDeepAnalysis(history) {
    if (history.length < 40) return null;
    const timeframes = [
        { lookback: 10, weight: 0.3 },
        { lookback: 20, weight: 0.3 },
        { lookback: 40, weight: 0.4 }
    ];
    let totalScore = { T: 0, X: 0 };
    let totalWeight = 0;
    for (const tf of timeframes) {
        if (history.length < tf.lookback) continue;
        const slice = history.slice(-tf.lookback);
        const sTx = slice.map(h => h.tx);
        const sTotals = slice.map(h => h.total);
        const tC = sTx.filter(t => t === 'T').length;
        const xC = sTx.filter(t => t === 'X').length;
        const meanT = avg(sTotals);
        const vol = Math.sqrt(avg(sTotals.map(t => Math.pow(t - meanT, 2))));
        let tScore = 0, xScore = 0;
        if (meanT > 12) xScore += 0.4;
        if (meanT < 9) tScore += 0.4;
        if (tC > xC + 3) xScore += 0.3;
        if (xC > tC + 3) tScore += 0.3;
        if (vol > 4) {
            if (sTx[sTx.length - 1] === 'T') tScore += 0.2;
            else xScore += 0.2;
        }
        const trend = sTotals[sTotals.length - 1] - sTotals[0];
        if (trend > 3) xScore += 0.1;
        if (trend < -3) tScore += 0.1;
        const w = tf.weight * (sTx.length / tf.lookback);
        totalScore.T += tScore * w;
        totalScore.X += xScore * w;
        totalWeight += w;
    }
    if (totalWeight > 0 && Math.abs(totalScore.T - totalScore.X) > 0.15) {
        return totalScore.T > totalScore.X ? 'T' : 'X';
    }
    return null;
}

function algoE_Transformer(history) {
    if (history.length < 80) return null;
    const tx = history.map(h => h.tx);
    const seqLengths = [5, 6, 8, 10, 12];
    let attnScores = { T: 0, X: 0 };
    for (const seqLen of seqLengths) {
        if (tx.length < seqLen * 2) continue;
        const targetSeq = tx.slice(-seqLen).join('');
        let seqMatches = 0;
        for (let i = 0; i <= tx.length - seqLen - 1; i++) {
            const hSeq = tx.slice(i, i + seqLen).join('');
            const matchScore = similarity(hSeq, targetSeq);
            if (matchScore >= 0.65) {
                const nextResult = tx[i + seqLen];
                const recency = 1 / (tx.length - i);
                const lengthFactor = seqLen / 12;
                attnScores[nextResult] += matchScore * recency * lengthFactor;
                seqMatches++;
            }
        }
        if (seqMatches >= 3) { attnScores.T *= 1.5; attnScores.X *= 1.5; }
    }
    if (attnScores.T + attnScores.X > 0.2) {
        const total = attnScores.T + attnScores.X;
        const conf = Math.abs(attnScores.T - attnScores.X) / total;
        if (conf > 0.2) return attnScores.T > attnScores.X ? 'T' : 'X';
    }
    return null;
}

function algoJ_QuantumEntropy(history) {
    if (history.length < 30) return null;
    const features = extractFeatures(history);
    const { entropy: e, tx } = features;
    let preds = { T: 0, X: 0 };
    for (const window of [10, 20, 30]) {
        if (tx.length < window) continue;
        const wTx = tx.slice(-window);
        const wE = entropy(wTx);
        if (wE < 0.3) preds[wTx[wTx.length - 1]] += 0.6;
        else if (wE > 0.9) {
            const tC = wTx.filter(t => t === 'T').length;
            const xC = wTx.filter(t => t === 'X').length;
            if (tC > xC) preds['X'] += 0.5;
            else if (xC > tC) preds['T'] += 0.5;
        }
    }
    if (preds.T + preds.X > 0.4) return preds.T > preds.X ? 'T' : 'X';
    return null;
}

function algoM_ScoreDistribution(history) {
    if (history.length < 20) return null;
    const totals = history.map(h => h.total);
    const recent20 = totals.slice(-20);
    const mean20 = avg(recent20);
    const highCount = recent20.filter(t => t >= 12).length;
    const lowCount = recent20.filter(t => t <= 9).length;
    if (highCount >= 10 && mean20 > 12) return 'X';
    if (lowCount >= 10 && mean20 < 9) return 'T';
    return null;
}

function algoO_RunLengthPredictor(history) {
    if (history.length < 30) return null;
    const features = extractFeatures(history);
    const { runs } = features;
    if (runs.length < 5) return null;
    const recentRuns = runs.slice(-10);
    const runLengths = recentRuns.map(r => r.len);
    const lastRun = recentRuns[recentRuns.length - 1];
    const lengthCounts = {};
    for (const len of runLengths) lengthCounts[len] = (lengthCounts[len] || 0) + 1;
    let mostCommon = 1, maxCount = 0;
    for (const len in lengthCounts) {
        if (lengthCounts[len] > maxCount) { maxCount = lengthCounts[len]; mostCommon = parseInt(len); }
    }
    if (lastRun.len >= mostCommon) return lastRun.val === 'T' ? 'X' : 'T';
    if (lastRun.len < mostCommon - 1) return lastRun.val;
    return null;
}

function algoP_TimeWeightedMomentum(history) {
    if (history.length < 20) return null;
    const tx = history.map(h => h.tx);
    let momentum = 0, weightSum = 0;
    const decay = 0.9;
    for (let i = tx.length - 1; i >= Math.max(0, tx.length - 20); i--) {
        const weight = Math.pow(decay, tx.length - 1 - i);
        const value = tx[i] === 'T' ? 1 : -1;
        momentum += value * weight;
        weightSum += weight;
    }
    if (weightSum > 0) momentum /= weightSum;
    if (momentum > 0.4) return 'X';
    if (momentum < -0.4) return 'T';
    if (momentum > 0.1) return 'T';
    if (momentum < -0.1) return 'X';
    return null;
}

function algoR_SymmetryDetector(history) {
    if (history.length < 20) return null;
    const features = extractFeatures(history);
    const { runs, tx } = features;
    if (runs.length < 4) return null;
    const lastRun = runs[runs.length - 1];
    const runLengths = runs.slice(-7).map(r => r.len);
    if (features.isSymmetry) return lastRun.val === 'T' ? 'X' : 'T';
    if (features.isAlternating) return tx[tx.length - 1] === 'T' ? 'X' : 'T';
    if (runLengths.length >= 7 && checkSymmetry(runLengths)) return lastRun.val === 'T' ? 'X' : 'T';
    return null;
}

function algoT_ZigzagDetector(history) {
    if (history.length < 25) return null;
    const features = extractFeatures(history);
    const { runs, tx, flipStreak } = features;
    if (runs.length < 5) return null;
    const last7 = tx.slice(-7);
    if (last7.length === 7) {
        let zigzag = true;
        for (let i = 1; i < 7; i++) if (last7[i] === last7[i - 1]) { zigzag = false; break; }
        if (zigzag) return last7[6] === 'T' ? 'X' : 'T';
    }
    if (flipStreak >= 4) return tx[tx.length - 1] === 'T' ? 'X' : 'T';
    const runLengths = runs.slice(-8).map(r => r.len);
    if (runLengths.length >= 6) {
        const is2_1 = runLengths.slice(-6).join('') === '212121';
        const is1_2 = runLengths.slice(-6).join('') === '121212';
        if (is2_1 || is1_2) {
            const lastRun = runs[runs.length - 1];
            return lastRun.val === 'T' ? 'X' : 'T';
        }
    }
    return null;
}

function algoU_WaveDetector(history) {
    if (history.length < 30) return null;
    const features = extractFeatures(history);
    const { runs } = features;
    if (runs.length < 6) return null;
    const runLengths = runs.slice(-8).map(r => r.len);
    if (runLengths.length < 6) return null;
    const pattern = runLengths.join('');
    if (pattern.includes('121212') || pattern.includes('212121')) {
        const lastRun = runs[runs.length - 1];
        return lastRun.len === 1 ? lastRun.val : (lastRun.val === 'T' ? 'X' : 'T');
    }
    const last6 = runLengths.slice(-6);
    let incCount = 0;
    for (let i = 1; i < last6.length; i++) if (last6[i] >= last6[i - 1]) incCount++;
    if (incCount >= 4) {
        const lastRun = runs[runs.length - 1];
        return lastRun.val === 'T' ? 'X' : 'T';
    }
    return null;
}

function algoV_LongTermTrend(history) {
    if (history.length < 50) return null;
    const features = extractFeatures(history);
    const { tCount20, tCount30, meanTotal } = features;
    const tR20 = (tCount20 || 0) / 20;
    const tR30 = (tCount30 || 0) / 30;
    if (tR20 > 0.65 && tR30 < 0.5) return 'X';
    if (tR20 < 0.35 && tR30 > 0.5) return 'T';
    if (meanTotal > 12.5) return 'X';
    if (meanTotal < 8.5) return 'T';
    return null;
}

function algoW_ConsensusFollow(history) {
    if (history.length < 30) return null;
    const features = extractFeatures(history);
    const { runs, tx } = features;
    if (runs.length < 5) return null;
    const lastRun = runs[runs.length - 1];
    if (lastRun.len >= 3 && lastRun.len <= 5) {
        const last10 = tx.slice(-10);
        const tC = last10.filter(t => t === 'T').length;
        const xC = last10.filter(t => t === 'X').length;
        if (lastRun.val === 'T' && tC >= 6) return 'T';
        if (lastRun.val === 'X' && xC >= 6) return 'X';
    }
    return null;
}

function algoX_ContrarianExtreme(history) {
    if (history.length < 40) return null;
    const features = extractFeatures(history);
    const { tCount20, tCount30, runs } = features;
    const tR20 = (tCount20 || 0) / 20;
    const tR30 = (tCount30 || 0) / 30;
    if (tR20 >= 0.70 && tR30 <= 0.55) return 'X';
    if (tR20 <= 0.30 && tR30 >= 0.45) return 'T';
    const lastRun = runs[runs.length - 1];
    if (lastRun && lastRun.len >= 6) return lastRun.val === 'T' ? 'X' : 'T';
    return null;
}

function algoY_StabilityPredictor(history) {
    if (history.length < 25) return null;
    const features = extractFeatures(history);
    const { runs } = features;
    const runLengths = runs.slice(-8).map(r => r.len);
    if (runLengths.length < 6) return null;
    const meanLen = avg(runLengths);
    const stdLen = stdDev(runLengths);
    if (stdLen < 0.8 && meanLen >= 1 && meanLen <= 3) {
        const lastRun = runs[runs.length - 1];
        const recent = runLengths.slice(-3);
        if (recent[0] === recent[1] && recent[1] === recent[2]) {
            const targetLen = recent[0];
            if (lastRun.len < targetLen) return lastRun.val;
            if (lastRun.len >= targetLen) return lastRun.val === 'T' ? 'X' : 'T';
        }
    }
    return null;
}

function algoZ_PatternWeighted(history) {
    if (history.length < 25) return null;
    const features = extractFeatures(history);
    const { runs, tx } = features;
    if (runs.length < 5) return null;
    const patternType = detectPatternType(runs, features);
    if (!patternType || patternType === 'random_pattern') return null;
    const lastTx = tx[tx.length - 1];
    const result = predictNextFromPattern(patternType, runs, lastTx);
    if (!result.pred) return null;
    const weight = getPatternWeight(patternType);
    if (weight < 0.50) return null;
    if (result.confidence < 0.55) return null;
    return result.pred;
}

// === WRAPPER CHO 4 ALGO MỚI ===
function algoScorePattern(history) {
    const r = detectScorePattern(history);
    return r ? r.pred : null;
}
function algoAdvancedRun(history) {
    const features = extractFeatures(history);
    const r = detectAdvancedRunPattern(features.runs);
    return r ? r.pred : null;
}
function algoDynamicTransition(history) {
    const r = detectDynamicTransition(history);
    return r ? r.pred : null;
}
function algoBayesian(history) {
    const r = bayesianPredict(history);
    return r ? r.pred : null;
}

// === DANH SÁCH TẤT CẢ THUẬT TOÁN ===
const ALL_ALGS = [
    { id: 'algoR_exact_pattern', fn: algoR_ExactPatternMatch, role: 'PATTERN_DB' },
    { id: 'algoT_fuzzy_pattern', fn: algoT_FuzzyPatternMatch, role: 'PATTERN_DB' },
    { id: 'algoU_suffix_pattern', fn: algoU_SuffixPatternMatch, role: 'PATTERN_DB' },
    { id: 'algoV_sequence_similarity', fn: algoV_SequenceSimilarity, role: 'PATTERN_DB' },
    { id: 'algo5_freqrebalance', fn: algo5_freqRebalance, role: 'PRIMARY' },
    { id: 'a_markov', fn: algoA_markov, role: 'PRIMARY' },
    { id: 'b_ngram', fn: algoB_ngram, role: 'SECONDARY' },
    { id: 'g_super_bridge', fn: algoG_SuperBridgePredictor, role: 'REVERSAL' },
    { id: 'h_adaptive_markov', fn: algoH_AdaptiveMarkov, role: 'CONTEXT' },
    { id: 'i_pattern_master', fn: algoI_PatternMaster, role: 'PRIMARY' },
    { id: 'n_transition_matrix', fn: algoN_TransitionMatrix, role: 'CONTEXT' },
    { id: 'q_streak_probability', fn: algoQ_StreakProbability, role: 'REVERSAL' },
    { id: 'l_momentum_reversal', fn: algoL_MomentumReversal, role: 'REVERSAL' },
    { id: 'f_super_deep', fn: algoF_SuperDeepAnalysis, role: 'CONTEXT' },
    { id: 'e_transformer', fn: algoE_Transformer, role: 'CONTEXT' },
    { id: 'j_quantum_entropy', fn: algoJ_QuantumEntropy, role: 'CONTEXT' },
    { id: 'm_score_distribution', fn: algoM_ScoreDistribution, role: 'CONTEXT' },
    { id: 'o_run_length', fn: algoO_RunLengthPredictor, role: 'SECONDARY' },
    { id: 'p_time_weighted', fn: algoP_TimeWeightedMomentum, role: 'CONTEXT' },
    { id: 'r_symmetry', fn: algoR_SymmetryDetector, role: 'SECONDARY' },
    { id: 't_zigzag', fn: algoT_ZigzagDetector, role: 'CONTEXT' },
    { id: 'u_wave', fn: algoU_WaveDetector, role: 'CONTEXT' },
    { id: 'v_long_term', fn: algoV_LongTermTrend, role: 'REVERSAL' },
    { id: 'w_consensus', fn: algoW_ConsensusFollow, role: 'SECONDARY' },
    { id: 'x_contrarian', fn: algoX_ContrarianExtreme, role: 'REVERSAL' },
    { id: 'y_stability', fn: algoY_StabilityPredictor, role: 'SECONDARY' },
    { id: 'z_pattern_weighted', fn: algoZ_PatternWeighted, role: 'PRIMARY' },
    { id: 'score_pattern', fn: algoScorePattern, role: 'PRIMARY' },
    { id: 'advanced_run', fn: algoAdvancedRun, role: 'PRIMARY' },
    { id: 'dynamic_transition', fn: algoDynamicTransition, role: 'SECONDARY' },
    { id: 'bayesian', fn: algoBayesian, role: 'PRIMARY' },
];
// ============================================================
// PHẦN 7/10 — CLASS EnsembleV12 & Manager
// ============================================================

class EnsembleV12 {
    constructor() {
        this.stats = {};
        for (const tier in ALGO_TIERS) {
            for (const id of ALGO_TIERS[tier].algorithms) {
                this.stats[id] = {
                    tier,
                    wins: 0,
                    losses: 0,
                    total: 0,
                    weight: ALGO_TIERS[tier].weight,
                    baseWeight: ALGO_TIERS[tier].weight,
                    winRate: 0.5,
                    lastPred: null,
                    disabled: false,
                };
            }
        }
        this.recentPredictions = [];
        this.winStreak = 0;
        this.loseStreak = 0;
    }

    updatePerformance(historyPrefix, actualTx) {
        for (const id in this.stats) {
            const s = this.stats[id];
            if (s.disabled) continue;

            const algo = ALL_ALGS.find(a => a.id === id);
            if (!algo) continue;

            try {
                const pred = algo.fn(historyPrefix);
                if (!pred) continue;

                s.total++;
                if (pred === actualTx) s.wins++;
                else s.losses++;
                s.winRate = s.total > 0 ? s.wins / s.total : 0.5;

                if (s.total >= AUTO_DISABLE_MIN_SESSIONS && s.winRate < AUTO_DISABLE_WR_THRESHOLD) {
                    s.disabled = true;
                    console.log(`⚠️ Disabled ${id}: WR=${(s.winRate * 100).toFixed(1)}%`);
                }
                if (s.disabled && s.total >= AUTO_REENABLE_SESSIONS) {
                    s.wins = 0;
                    s.losses = 0;
                    s.total = 0;
                    s.disabled = false;
                    s.winRate = 0.5;
                    console.log(`♻️ Re-enabled ${id}`);
                }
            } catch (e) {}
        }
        this.rebalanceWeights();
    }

    rebalanceWeights() {
        for (const id in this.stats) {
            const s = this.stats[id];
            if (s.disabled) { s.weight = 0; continue; }
            const wrFactor = Math.max(WEIGHT_MIN_FACTOR, Math.min(WEIGHT_MAX_FACTOR, s.winRate / 0.5));
            const targetWeight = s.baseWeight * wrFactor;
            s.weight = s.weight * (1 - WEIGHT_SMOOTH_FACTOR) + targetWeight * WEIGHT_SMOOTH_FACTOR;
        }
    }

    predict(history, gameType = 'default') {
        // === ƯU TIÊN DỰ ĐOÁN SUNWIN ===
        if (gameType === 'sunwin') {
            const sunwinPred = predictSunwin(history);
            if (sunwinPred) {
                return {
                    prediction: sunwinPred.pred === 'T' ? 'tài' : 'xỉu',
                    confidence: sunwinPred.conf,
                    rawPrediction: sunwinPred.pred,
                    li_do: sunwinPred.reason,
                    pattern: sunwinPred.pattern || 'sunwin_special'
                };
            }
        }

        if (history.length < 12) {
            const tC = history.filter(h => h.tx === 'T').length;
            const xC = history.filter(h => h.tx === 'X').length;
            const fallback = tC > xC ? 'X' : 'T';
            return {
                prediction: fallback === 'T' ? 'tài' : 'xỉu',
                confidence: 0.5,
                rawPrediction: fallback,
                li_do: `Chưa đủ dữ liệu (${history.length}/12 phiên)`,
                pattern: 'insufficient_data'
            };
        }

        const features = extractFeatures(history);
        const patternType = detectPatternType(features.runs, features);
        const lastTx = features.tx[features.tx.length - 1];
        const lastRun = features.runs[features.runs.length - 1];

        const votes = { T: 0, X: 0 };
        const details = [];

        // Tầng S: pattern core
        const patternResult = predictNextFromPattern(patternType, features.runs, lastTx);
        const patternWeight = getPatternWeight(patternType);
        if (patternResult.pred && patternResult.confidence >= 0.55) {
            const w = patternWeight * ALGO_TIERS.S.weight * patternResult.confidence;
            votes[patternResult.pred] += w;
            details.push({ algo: 'pattern_core', pred: patternResult.pred, w, tier: 'S' });
        }

        // Vote từ tất cả algo
        for (const id in this.stats) {
            const s = this.stats[id];
            if (s.disabled) continue;

            const algo = ALL_ALGS.find(a => a.id === id);
            if (!algo) continue;

            try {
                const pred = algo.fn(history);
                if (!pred) continue;
                if (s.winRate >= 0.45 || s.total < 10) {
                    votes[pred] += s.weight;
                    details.push({ algo: id, pred, w: s.weight, tier: s.tier, wr: s.winRate });
                }
            } catch (e) {}
        }

        const total = votes.T + votes.X;
        if (total === 0) {
            return {
                prediction: 'tài', confidence: 0.5, rawPrediction: 'T',
                li_do: 'Không có thuật toán vote',
                pattern: patternType
            };
        }

        let best = votes.T > votes.X ? 'T' : 'X';
        let confidence = Math.max(votes.T, votes.X) / total;

        // Override theo tầng S
        const sTierVotes = details.filter(d => d.tier === 'S');
        if (sTierVotes.length >= 2) {
            const sT = sTierVotes.filter(d => d.pred === 'T').reduce((s, d) => s + d.w, 0);
            const sX = sTierVotes.filter(d => d.pred === 'X').reduce((s, d) => s + d.w, 0);
            const sTotal = sT + sX;
            if (sTotal > 0) {
                const sBest = sT > sX ? 'T' : 'X';
                const sConf = Math.max(sT, sX) / sTotal;
                if (sConf >= TIER_OVERRIDE_THRESHOLD && sBest !== best) {
                    best = sBest;
                    confidence = (confidence + sConf) / 2;
                }
                if (sConf >= TIER_BOOST_THRESHOLD && sBest === best) {
                    confidence = Math.min(0.95, confidence * 1.15);
                }
            }
        }

        // Trend 50 phiên
        if (history.length >= 50) {
            const recent50 = history.slice(-50);
            const tRatio = recent50.filter(h => h.tx === 'T').length / 50;
            if (tRatio > 0.68 && best === 'T' && confidence < 0.75) {
                best = 'X';
                confidence = Math.max(confidence * 1.05, 0.60);
            } else if (tRatio < 0.32 && best === 'X' && confidence < 0.75) {
                best = 'T';
                confidence = Math.max(confidence * 1.05, 0.60);
            }
        }

        // Lose streak
        if (this.loseStreak >= 4 && this.winStreak === 0) {
            const flipped = best === 'T' ? 'X' : 'T';
            const patternAgrees = patternResult.pred === best;
            if (!patternAgrees || patternResult.confidence < 0.65) {
                best = flipped;
                confidence = Math.max(confidence, 0.58);
                this.loseStreak = 0;
            }
        }

        const li_do = this.buildLiDo({
            patternType, patternResult, patternWeight,
            lastRun, votes, best
        });

        if (confidence < 0.55) {
            return {
                prediction: 'chưa có',
                confidence,
                rawPrediction: null,
                li_do: `${li_do} | ⚠️ Tin cậy ${(confidence * 100).toFixed(0)}% < 55%`,
                pattern: patternType
            };
        }

        this.recentPredictions.push(best);
        if (this.recentPredictions.length > 20) this.recentPredictions.shift();

        return {
            prediction: best === 'T' ? 'tài' : 'xỉu',
            confidence,
            rawPrediction: best,
            li_do,
            pattern: patternType
        };
    }

    buildLiDo(ctx) {
        const parts = [];
        const { patternType, patternResult, patternWeight, lastRun, votes, best } = ctx;

        if (patternType && patternType !== 'random_pattern') {
            parts.push(`Pattern: ${patternResult.reason} (w=${patternWeight.toFixed(2)})`);
        } else {
            parts.push(`Pattern: ngẫu nhiên`);
        }

        if (lastRun) {
            const sbp = STATS.STREAK_BREAK_PROB[Math.min(lastRun.len, 15)] || 0.999;
            parts.push(`Bệt ${lastRun.val === 'T' ? 'TÀI' : 'XỈU'} ${lastRun.len} phiên (gãy ${(sbp * 100).toFixed(0)}%)`);
        }

        const total = votes.T + votes.X;
        if (total > 0) {
            parts.push(`Vote: TÀI ${(votes.T / total * 100).toFixed(0)}% / XỈU ${(votes.X / total * 100).toFixed(0)}%`);
        }

        parts.push(`→ Chọn ${best === 'T' ? 'TÀI' : 'XỈU'}`);
        return parts.join(' | ');
    }
}

// === MANAGER ===
class Manager {
    constructor(tableKey) {
        this.tableKey = tableKey;
        this.history = [];
        this.ensemble = new EnsembleV12();
        this.currentPrediction = null;
        this.lastPredictionForSession = null;
        this.predictionLog = {};
        this.patternStats = {};
        this.streakStats = {
            currentWinStreak: 0,
            currentLoseStreak: 0,
            maxWinStreak: 0,
            maxLoseStreak: 0,
            totalWins: 0,
            totalLosses: 0
        };
    }

    loadInitial(lines) {
        this.history = lines;
        this.currentPrediction = this.ensemble.predict(this.history, this.tableKey);
        if (this.history.length > 0) {
            this.lastPredictionForSession = this.history[this.history.length - 1].session + 1;
        }
    }

    pushRecord(record) {
        // === BƯỚC 1: CHECK KẾT QUẢ DỰ ĐOÁN CHO SESSION NÀY ===
        let predictionResult = null;
        
        if (this.currentPrediction && this.lastPredictionForSession === record.session) {
            predictionResult = this.logPrediction(record, this.currentPrediction);
        } else if (this.currentPrediction && this.currentPrediction.rawPrediction) {
            if (!this.predictionLog[record.session]) {
                predictionResult = this.logPrediction(record, this.currentPrediction);
            }
        }

        // === BƯỚC 2: CẬP NHẬT STREAK WIN/LOSE ===
        if (predictionResult) {
            if (predictionResult.correctBool === true) {
                this.streakStats.currentWinStreak++;
                this.streakStats.currentLoseStreak = 0;
                this.streakStats.totalWins++;
                if (this.streakStats.currentWinStreak > this.streakStats.maxWinStreak) {
                    this.streakStats.maxWinStreak = this.streakStats.currentWinStreak;
                }
                this.ensemble.winStreak++;
                this.ensemble.loseStreak = 0;
            } else if (predictionResult.correctBool === false) {
                this.streakStats.currentLoseStreak++;
                this.streakStats.currentWinStreak = 0;
                this.streakStats.totalLosses++;
                if (this.streakStats.currentLoseStreak > this.streakStats.maxLoseStreak) {
                    this.streakStats.maxLoseStreak = this.streakStats.currentLoseStreak;
                }
                this.ensemble.loseStreak++;
                this.ensemble.winStreak = 0;
            }

            if (predictionResult.correctBool !== null) {
                this.updatePatternStats(predictionResult);
            }
        }

        // === BƯỚC 3: CẬP NHẬT HIỆU SUẤT ALGORITHM ===
        const prefix = this.history.slice();
        if (prefix.length >= 12) {
            this.ensemble.updatePerformance(prefix, record.tx);
        }

        // === BƯỚC 4: PUSH RECORD VÀO HISTORY ===
        this.history.push(record);
        if (this.history.length > MAX_HISTORY) {
            this.history = this.history.slice(-MAX_HISTORY + 50);
        }

        // === BƯỚC 5: DỰ ĐOÁN CHO SESSION TIẾP THEO ===
        this.currentPrediction = this.ensemble.predict(this.history, this.tableKey);
        this.lastPredictionForSession = record.session + 1;
    }

    logPrediction(record, prediction) {
        let correctStatus;
        let correctBool;
        
        if (!prediction || !prediction.rawPrediction) {
            correctStatus = 'chờ⏳';
            correctBool = null;
        } else if (prediction.rawPrediction === record.tx) {
            correctStatus = 'đúng✅';
            correctBool = true;
        } else {
            correctStatus = 'sai❌';
            correctBool = false;
        }
        
        const logEntry = {
            session: record.session,
            pred: prediction.rawPrediction,
            predText: prediction.prediction,
            conf: prediction.confidence,
            li_do: prediction.li_do,
            pattern: prediction.pattern || 'unknown',
            actual: record.tx,
            actualText: record.result.toLowerCase(),
            actualDice: record.dice,
            actualTotal: record.total,
            correct: correctStatus,
            correctBool: correctBool,
            timestamp: record.timestamp || new Date().toISOString()
        };
        
        this.predictionLog[record.session] = logEntry;
        return logEntry;
    }

    updatePatternStats(logEntry) {
        const pattern = logEntry.pattern || 'unknown';
        if (!this.patternStats[pattern]) {
            this.patternStats[pattern] = {
                total: 0,
                correct: 0,
                wrong: 0,
                winRate: 0,
                lastSeen: null
            };
        }
        const stats = this.patternStats[pattern];
        stats.total++;
        if (logEntry.correctBool === true) stats.correct++;
        else if (logEntry.correctBool === false) stats.wrong++;
        stats.winRate = stats.total > 0 ? stats.correct / stats.total : 0;
        stats.lastSeen = logEntry.timestamp;
    }

    getStats() {
        const log = this.predictionLog;
        let total = 0, correct = 0, wrong = 0, pending = 0;
        let last20Correct = 0, last20Total = 0;
        let last50Correct = 0, last50Total = 0;
        
        const sessions = Object.keys(log).map(Number).sort((a, b) => a - b);
        
        for (const sess of sessions) {
            const entry = log[sess];
            if (entry.correctBool === true) {
                total++;
                correct++;
            } else if (entry.correctBool === false) {
                total++;
                wrong++;
            } else {
                pending++;
            }
        }
        
        const last20Sessions = sessions.slice(-20);
        for (const sess of last20Sessions) {
            const entry = log[sess];
            if (entry.correctBool === true) {
                last20Total++;
                last20Correct++;
            } else if (entry.correctBool === false) {
                last20Total++;
            }
        }
        
        const last50Sessions = sessions.slice(-50);
        for (const sess of last50Sessions) {
            const entry = log[sess];
            if (entry.correctBool === true) {
                last50Total++;
                last50Correct++;
            } else if (entry.correctBool === false) {
                last50Total++;
            }
        }
        
        return {
            game: GAME_LABELS[this.tableKey] || this.tableKey,
            tableKey: this.tableKey,
            totalPredictions: total,
            correct,
            wrong,
            pending,
            accuracy: total > 0 ? ((correct / total) * 100).toFixed(1) + "%" : "0%",
            accuracyLast20: last20Total > 0 ? ((last20Correct / last20Total) * 100).toFixed(1) + "%" : "0%",
            accuracyLast50: last50Total > 0 ? ((last50Correct / last50Total) * 100).toFixed(1) + "%" : "0%",
            winStreak: this.streakStats.currentWinStreak,
            loseStreak: this.streakStats.currentLoseStreak,
            maxWinStreak: this.streakStats.maxWinStreak,
            maxLoseStreak: this.streakStats.maxLoseStreak,
            totalWins: this.streakStats.totalWins,
            totalLosses: this.streakStats.totalLosses,
            historyLength: this.history.length,
            patternStats: this.patternStats,
            recentHistory: this.getRecentHistory(20)
        };
    }

    getRecentHistory(limit = 50) {
        const log = this.predictionLog;
        const sessions = Object.keys(log).map(Number).sort((a, b) => b - a).slice(0, limit);
        
        return sessions.map(sess => {
            const entry = log[sess];
            return {
                session: entry.session,
                dice: entry.actualDice,
                total: entry.actualTotal,
                result: entry.actualText,
                tx_label: entry.actual === 'T' ? 'tài' : 'xỉu',
                prediction: entry.predText,
                prediction_raw: entry.pred === 'T' ? 'tài' : 'xỉu',
                prediction_confidence: Math.round(entry.conf * 100),
                correct: entry.correct,
                correctBool: entry.correctBool,
                li_do: entry.li_do,
                pattern: entry.pattern
            };
        });
    }
}
// ============================================================
// PHẦN 8/10 — FETCH & PROCESS
// ============================================================

async function fetchAndProcessTable(tableKey) {
    const table = TABLES[tableKey];
    try {
        const response = await fetch(table.apiUrl);
        const data = await response.json();

        let newHistory;
        if (table.parseType === 'lc79_md5') newHistory = parseLc79Md5Data(data);
        else if (table.parseType === 'lc79_hu') newHistory = parseLc79HuData(data);
        else if (table.parseType === 'hitclub') newHistory = parseHitClubLines(data);
        else if (table.parseType === 'max789') newHistory = parseMax789Data(data);
        else if (table.parseType === 'sunwin') newHistory = parseSunwinLines(data);
        else newHistory = [];

        if (newHistory.length === 0) return;

        const lastSessionInHistory = newHistory[newHistory.length - 1];

        if (!table.currentSessionId) {
            table.manager = new Manager(tableKey);
            table.manager.loadInitial(newHistory);
            table.history = newHistory;
            table.currentSessionId = lastSessionInHistory.session;
            console.log(`✅ ${table.name}: Đã tải ${newHistory.length} phiên`);
        } else if (lastSessionInHistory.session > table.currentSessionId) {
            const newRecords = newHistory.filter(r => r.session > table.currentSessionId);
            for (const record of newRecords) {
                table.manager.pushRecord(record);
                table.history.push(record);
            }
            if (table.history.length > MAX_HISTORY) table.history = table.history.slice(-MAX_HISTORY);
            table.currentSessionId = lastSessionInHistory.session;
            if (newRecords.length > 0) {
                console.log(`🆕 ${table.name}: +${newRecords.length} phiên`);
            }
        }
    } catch (e) {
        console.error(`❌ ${table.name}:`, e.message);
    }
}

async function fetchAllTables() {
    await Promise.all(Object.keys(TABLES).map(k => fetchAndProcessTable(k)));
}
// ============================================================
// PHẦN 9/10 — API ENDPOINTS
// ============================================================

const app = fastify({ logger: false });

async function setupApp() {
    await app.register(cors, { origin: "*" });
}

function buildPredictionResponse(tableKey) {
    const table = TABLES[tableKey];
    const lastResult = table.history[table.history.length - 1] || null;
    const currentPrediction = table.manager?.currentPrediction;

    if (!lastResult || !currentPrediction) {
        return {
            id: "@cskhgiabao",
            game: GAME_LABELS[tableKey] || tableKey,
            phien_truoc: null, xuc_xac: null, ket_qua: "đang chờ...",
            phien_nay: null, du_doan: "chưa có", do_tin_cay: "0%",
            li_do: "Chưa có dữ liệu"
        };
    }

    return {
        id: "@cskhgiabao",
        game: GAME_LABELS[tableKey] || tableKey,
        phien_truoc: lastResult.session,
        xuc_xac: lastResult.dice,
        ket_qua: lastResult.result.toLowerCase(),
        phien_nay: lastResult.session + 1,
        du_doan: currentPrediction.prediction,
        do_tin_cay: `${Math.round(currentPrediction.confidence * 100)}%`,
        li_do: currentPrediction.li_do || "Không có lý do"
    };
}

function buildHistoryResponse(tableKey) {
    const table = TABLES[tableKey];
    if (!table.history.length) return [];

    const reversed = [...table.history].sort((a, b) => b.session - a.session);
    const log = table.manager?.predictionLog || {};

    return reversed.map((i) => {
        const predLog = log[i.session];
        let prediction = null;
        let predictionConfidence = null;
        let correct = 'chờ⏳';
        let correctBool = null;
        let li_do = null;
        let pattern = null;
        
        if (predLog) {
            prediction = predLog.predText;
            predictionConfidence = Math.round(predLog.conf * 100);
            correct = predLog.correct;
            correctBool = predLog.correctBool;
            li_do = predLog.li_do;
            pattern = predLog.pattern;
        }
        
        return {
            session: i.session,
            dice: i.dice,
            total: i.total,
            result: i.result.toLowerCase(),
            tx_label: i.tx.toLowerCase(),
            prediction,
            prediction_confidence: predictionConfidence,
            correct,
            correct_bool: correctBool,
            li_do,
            pattern
        };
    });
}

app.get("/api/all", async () => {
    const result = {};
    for (const key of Object.keys(TABLES)) result[key] = buildPredictionResponse(key);
    return result;
});

for (const key of Object.keys(TABLES)) {
    app.get(`/api/${key}`, async () => buildPredictionResponse(key));
    app.get(`/api/${key}/history`, async () => buildHistoryResponse(key));
}

app.get("/api/history/all", async () => {
    const result = {};
    for (const key of Object.keys(TABLES)) {
        const table = TABLES[key];
        if (!table.manager) continue;
        
        const log = table.manager.predictionLog;
        let total = 0, correct = 0, wrong = 0, pending = 0;
        for (const sess in log) {
            const entry = log[sess];
            if (entry.correctBool === true) { total++; correct++; }
            else if (entry.correctBool === false) { total++; wrong++; }
            else pending++;
        }
        
        result[key] = {
            game: GAME_LABELS[key],
            history: table.manager.getRecentHistory(50),
            stats: {
                total,
                correct,
                wrong,
                pending,
                accuracy: total > 0 ? ((correct / total) * 100).toFixed(1) + '%' : '0%',
                wins: table.manager.streakStats.totalWins,
                losses: table.manager.streakStats.totalLosses,
                winStreak: table.manager.streakStats.currentWinStreak,
                loseStreak: table.manager.streakStats.currentLoseStreak,
                maxWinStreak: table.manager.streakStats.maxWinStreak,
                maxLoseStreak: table.manager.streakStats.maxLoseStreak
            }
        };
    }
    return result;
});

app.get("/api/stats", async () => {
    const result = {};
    for (const key of Object.keys(TABLES)) {
        const table = TABLES[key];
        if (!table.manager) { 
            result[key] = { error: "chưa load" }; 
            continue; 
        }
        result[key] = table.manager.getStats();
    }
    return result;
});

app.get("/api/stats/algo", async () => {
    const result = {};
    for (const key of Object.keys(TABLES)) {
        const table = TABLES[key];
        if (!table.manager) continue;
        const stats = table.manager.ensemble.stats;
        const algoStats = {};
        for (const id in stats) {
            const s = stats[id];
            algoStats[id] = {
                tier: s.tier,
                winRate: (s.winRate * 100).toFixed(1) + '%',
                total: s.total,
                wins: s.wins,
                losses: s.losses,
                weight: s.weight.toFixed(2),
                disabled: s.disabled
            };
        }
        result[key] = algoStats;
    }
    return result;
});

app.get("/api/:game/stats/detail", async (req) => {
    const { game } = req.params;
    const table = TABLES[game];
    if (!table || !table.manager) {
        return { error: "Game không tồn tại hoặc chưa load" };
    }
    
    const stats = table.manager.getStats();
    const recent = table.manager.getRecentHistory(100);
    
    const patternBreakdown = {};
    for (const entry of recent) {
        if (!entry.pattern) continue;
        if (!patternBreakdown[entry.pattern]) {
            patternBreakdown[entry.pattern] = { total: 0, correct: 0, wrong: 0 };
        }
        patternBreakdown[entry.pattern].total++;
        if (entry.correctBool === true) patternBreakdown[entry.pattern].correct++;
        else if (entry.correctBool === false) patternBreakdown[entry.pattern].wrong++;
    }
    
    for (const p in patternBreakdown) {
        const totalDecided = patternBreakdown[p].correct + patternBreakdown[p].wrong;
        patternBreakdown[p].winRate = totalDecided > 0 
            ? (patternBreakdown[p].correct / totalDecided * 100).toFixed(1) + '%'
            : '0%';
    }
    
    return {
        summary: {
            game: stats.game,
            total: stats.totalPredictions,
            correct: stats.correct,
            wrong: stats.wrong,
            pending: stats.pending,
            accuracy: stats.accuracy,
            accuracyLast20: stats.accuracyLast20,
            accuracyLast50: stats.accuracyLast50,
            currentWinStreak: stats.winStreak,
            currentLoseStreak: stats.loseStreak,
            maxWinStreak: stats.maxWinStreak,
            maxLoseStreak: stats.maxLoseStreak
        },
        patternBreakdown,
        recentPredictions: recent.slice(0, 30)
    };
});

app.get("/api/pattern/stats", async () => {
    const stats = {
        total: PATTERN_DB.length,
        byLength: {},
        byNext: { T: 0, X: 0 }
    };
    for (const p of PATTERN_DB) {
        stats.byLength[p.len] = (stats.byLength[p.len] || 0) + 1;
        stats.byNext[p.next]++;
    }
    return stats;
});

app.get("/", async (req, reply) => {
    try {
        const html = fs.readFileSync(path.join(__dirname, "dashboard.html"), "utf-8");
        reply.type("text/html; charset=utf-8").send(html);
    } catch (e) {
        reply.type("text/html; charset=utf-8").send("<h1>Dashboard không tìm thấy</h1><p>API vẫn chạy bình thường</p>");
    }
});

app.get("/xem", async (req, reply) => {
    try {
        const html = fs.readFileSync(path.join(__dirname, "dashboard.html"), "utf-8");
        reply.type("text/html; charset=utf-8").send(html);
    } catch (e) {
        reply.type("text/html; charset=utf-8").send("<h1>Dashboard không tìm thấy</h1>");
    }
});
// ============================================================
// PHẦN 10/10 — START SERVER
// ============================================================

const start = async () => {
    console.log("\n🚀 AI Tài Xỉu Tổng Hợp V12.0 - FULL EDITION!");
    console.log("================================================\n");

    // === ĐĂNG KÝ CORS ===
    await setupApp();

    // === LOAD PATTERN DB TỔNG HỢP ===
    PATTERN_DB = await loadAllPatterns();

    if (PATTERN_DB.length > 0) {
        console.log(`✅ Pattern DB sẵn sàng: ${PATTERN_DB.length} mẫu cầu`);
    } else {
        console.log("⚠️ Không có Pattern DB, hệ thống vẫn chạy bình thường");
    }

    try {
        await app.listen({ port: PORT, host: "0.0.0.0" });
    } catch (err) {
        console.error("Server error:", err.message);
        process.exit(1);
    }

    let publicIP = "0.0.0.0";
    try {
        const res = await fetch("https://ifconfig.me/ip");
        publicIP = (await res.text()).trim();
    } catch (e) {}

    console.log(`\n📡 Server đã sẵn sàng:`);
    console.log(`   ➜ Local:   http://localhost:${PORT}/`);
    console.log(`   ➜ Network: http://${publicIP}:${PORT}/`);
    console.log("\n📌 API:");
    console.log("   GET /                       → Dashboard HTML");
    console.log("   GET /api/all                → Tất cả game");
    console.log("   GET /api/stats              → Thống kê tổng");
    console.log("   GET /api/stats/algo         → Hiệu suất từng thuật toán");
    console.log("   GET /api/pattern/stats      → Thống kê Pattern DB");
    console.log("   GET /api/history/all        → Lịch sử tất cả");
    console.log("   GET /api/:game/stats/detail → Chi tiết 1 game");
    console.log("   GET /api/{game}             → Dự đoán 1 game");
    console.log("   GET /api/{game}/history     → Lịch sử 1 game");
    console.log("\n🎯 7 GAME:");
    for (const key in TABLES) console.log(`   • ${key}: ${GAME_LABELS[key]}`);
    console.log(`\n🔧 ${ALL_ALGS.length} thuật toán trong 4 tầng (S/A/B/C)`);
    console.log(`📚 Pattern DB: ${PATTERN_DB.length} mẫu cầu`);
    console.log(`🔄 Fetch mỗi ${FETCH_INTERVAL / 1000}s\n`);

    await fetchAllTables();
    setInterval(fetchAllTables, FETCH_INTERVAL);
};

start();