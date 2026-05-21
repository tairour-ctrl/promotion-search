const input = document.getElementById("productCode");
const button = document.getElementById("searchBtn");
const result = document.getElementById("result");

const CSV_FILE = "./master_promotion.csv";

/**
 * true  -> 오늘 날짜 기준 유효한 프로모션만 표시
 * false -> CSV에 있는 해당 코드의 모든 프로모션 표시
 */
const SHOW_ONLY_VALID_PROMOTIONS = true;

let promotionDB = [];

/**
 * 문자열 정리
 */
function normalizeText(value) {
  return String(value ?? "").replace(/^\uFEFF/, "").trim();
}

/**
 * 코드값 비교용 정규화
 */
function normalizeCode(value) {
  return normalizeText(value).replace(/\s+/g, "").toUpperCase();
}

/**
 * HTML 이스케이프
 */
function escapeHTML(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * 헤더 alias로 값 찾기
 */
function getValueByAliases(row, aliases) {
  const keys = Object.keys(row);
  const normalizedKeyMap = new Map(
    keys.map((key) => [normalizeText(key).replace(/\s+/g, "").toLowerCase(), key])
  );

  for (const alias of aliases) {
    const normalizedAlias = normalizeText(alias)
      .replace(/\s+/g, "")
      .toLowerCase();

    if (normalizedKeyMap.has(normalizedAlias)) {
      return normalizeText(row[normalizedKeyMap.get(normalizedAlias)]);
    }
  }

  return "";
}

/**
 * 컬럼값 추출
 */
function getProductCode(item) {
  return getValueByAliases(item, [
    "상품코드",
    "상품 코드",
    "productcode",
    "code"
  ]);
}

function getPromotionName(item) {
  return getValueByAliases(item, [
    "프로모션명",
    "프로모션 명",
    "행사명",
    "행사 명",
    "promotionname",
    "promotion"
  ]);
}

function getStartDate(item) {
  return getValueByAliases(item, [
    "시작일",
    "시작 일",
    "적용시작일",
    "프로모션시작일",
    "startdate"
  ]);
}

function getEndDate(item) {
  return getValueByAliases(item, [
    "종료일",
    "종료 일",
    "적용종료일",
    "프로모션종료일",
    "enddate"
  ]);
}

function getTotalPrice(item) {
  return getValueByAliases(item, [
    "총상품가격",
    "총 상품가격",
    "총가격",
    "판매가격",
    "price",
    "totalprice"
  ]);
}

/**
 * 날짜 파싱
 */
function parseDate(value) {
  const text = normalizeText(value);
  if (!text) return null;

  const normalized = text.replace(/\./g, "-").replace(/\//g, "-");
  const date = new Date(normalized);

  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * 오늘 기준 유효한 프로모션인지 체크
 */
function isValidPromotion(item) {
  const start = parseDate(getStartDate(item));
  const end = parseDate(getEndDate(item));
  const today = new Date();

  today.setHours(0, 0, 0, 0);

  if (start && today < start) return false;
  if (end && today > end) return false;

  return true;
}

/**
 * CSV 한 줄 파싱
 */
function splitCSVLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

/**
 * CSV 텍스트를 객체 배열로 변환
 */
function parseCSV(text) {
  const rows = [];
  let currentLine = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        currentLine += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (currentLine.trim()) rows.push(currentLine);

      currentLine = "";

      if (char === "\r" && next === "\n") {
        i += 1;
      }
    } else {
      currentLine += char;
    }
  }

  if (currentLine.trim()) rows.push(currentLine);

  if (!rows.length) return [];

  const headers = splitCSVLine(rows[0]).map((header) => normalizeText(header));

  return rows.slice(1).map((rowLine) => {
    const
