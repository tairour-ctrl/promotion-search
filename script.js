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
 * 헤더 정규화
 */
function normalizeHeader(header) {
  return normalizeText(header)
    .replace(/\s+/g, "")
    .toLowerCase();
}

/**
 * HTML escape
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
 * CSV 파서
 * - 따옴표 내부 쉼표 처리
 * - 개행 처리
 */
function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  const cleaned = String(text ?? "").replace(/^\uFEFF/, "");

  for (let i = 0; i < cleaned.length; i++) {
    const char = cleaned[i];
    const next = cleaned[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        field += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      row.push(field);
      field = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        i++;
      }

      row.push(field);
      field = "";

      if (row.some((cell) => normalizeText(cell) !== "")) {
        rows.push(row);
      }

      row = [];
    } else {
      field += char;
    }
  }

  row.push(field);

  if (row.some((cell) => normalizeText(cell) !== "")) {
    rows.push(row);
  }

  if (rows.length < 2) return [];

  const rawHeaders = rows[0];
  const normalizedHeaders = rawHeaders.map(normalizeHeader);

  return rows.slice(1).map((values) => {
    const item = {};

    normalizedHeaders.forEach((header, index) => {
      item[header] = normalizeText(values[index] || "");
    });

    return item;
  });
}

/**
 * 키 후보 중 첫 번째로 존재하는 값 반환
 */
function getValueByAliases(item, aliases) {
  for (const key of aliases) {
    const normalizedKey = normalizeHeader(key);
    if (item[normalizedKey] !== undefined && item[normalizedKey] !== "") {
      return item[normalizedKey];
    }
  }
  return "";
}

/**
 * 현재 CSV 기준 조회용 코드값
 * 현재 파일에는 상품코드 컬럼이 없고 대표상품코드만 있으므로
 * 대표상품코드도 fallback으로 사용.
 *
 * 나중에 CSV에 상품코드 컬럼이 추가되면 자동으로 상품코드 우선 조회됨.
 */
function getLookupCode(item) {
  return getValueByAliases(item, [
    "상품코드",
    "상품 코드",
    "대표상품코드",
    "대표 상품코드",
    "product code",
    "productcode",
    "representativecode"
  ]);
}

function getPromotionName(item) {
  return getValueByAliases(item, [
    "프로모션명",
    "프로모션 명",
    "promotion name",
    "promotionname"
  ]);
}

function getStartDate(item) {
  return getValueByAliases(item, [
    "시작일",
    "프로모션시작일",
    "start date",
    "startdate"
  ]);
}

function getEndDate(item) {
  return getValueByAliases(item, [
    "종료일",
    "프로모션종료일",
    "end date",
    "enddate"
  ]);
}

/**
 * 날짜 문자열 -> Date
 * 지원:
 * - 2026-05-01
 * - 2026/05/01
 * - 2026.05.01
 */
function toDate(dateString) {
  const raw = normalizeText(dateString);
  if (!raw) return null;

  const normalized = raw.replace(/[./]/g, "-");
  const match = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

/**
 * 오늘 날짜(시분초 제거)
 */
function getToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/**
 * 날짜 표시용 포맷
 */
function formatDate(dateString) {
  const date = toDate(dateString);
  if (!date) {
    return normalizeText(dateString) || "-";
  }

  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}.${m}.${d}`;
}

/**
 * 오늘 기준 유효 프로모션 여부
 */
function isValidPromotion(item) {
  const startDate = toDate(getStartDate(item));
  const endDate = toDate(getEndDate(item));
  const today = getToday();

  if (!startDate || !endDate) return false;
  return today >= startDate && today <= endDate;
}

/**
 * 날짜 범위 문자열
 */
function buildDateRange(item) {
  const start = formatDate(getStartDate(item));
  const end = formatDate(getEndDate(item));

  if (start === "-" && end === "-") {
    return "-";
  }

  return `${escapeHTML(start)} ~ ${escapeHTML(end)}`;
}

/**
 * 프로모션명 렌더링
 * 중복 제거 없이 전부 표시
 */
function renderPromotionRows(rows) {
  return rows
    .map((item, index) => {
      const promotionName = getPromotionName(item) || "-";

      return `
        <div class="promo-line">
          <span class="promo-order">${index + 1}.</span>
          <span class="promo-text">${escapeHTML(promotionName)}</span>
        </div>
      `;
    })
    .join("");
}

/**
 * 날짜 렌더링
 */
function renderDateRows(rows) {
  return rows
    .map((item) => {
      return `
        <div class="promo-line">
          ${buildDateRange(item)}
        </div>
      `;
    })
    .join("");
}

/**
 * 결과 카드 렌더링
 */
function renderResultCard({
  lookupCode,
  matchCount,
  promotionHtml,
  validDateHtml
}) {
  return `
    <div class="result-list">
      <div class="result-item">
        <div class="key">입력코드</div>
        <div class="value">${escapeHTML(lookupCode)}</div>
      </div>
      <div class="result-item">
        <div class="key">조회건수</div>
        <div class="value">${escapeHTML(String(matchCount))}건</div>
      </div>
    </div>

    <div class="promo-grid">
      <div class="promo-box">
        <div class="promo-box-title">PROMOTION NAME</div>
        <div class="promo-box-value promo-list">
          ${promotionHtml}
        </div>
      </div>

      <div class="promo-box">
        <div class="promo-box-title">VALID DATE</div>
        <div class="promo-box-value promo-list">
          ${validDateHtml}
        </div>
      </div>
    </div>
  `;
}

/**
 * 메시지 출력
 */
function showMessage(type, message) {
  result.innerHTML = `<p class="${type}">${escapeHTML(message)}</p>`;
}

/**
 * CSV 로드
 */
async function loadCSV() {
  try {
    result.innerHTML = `<p class="guide">CSV 파일을 불러오는 중입니다...</p>`;

    const response = await fetch(CSV_FILE);

    if (!response.ok) {
      throw new Error(`master_promotion.csv 로드 실패: ${response.status}`);
    }

    const csvText = await response.text();
    promotionDB = parseCSV(csvText);

    if (!promotionDB.length) {
      throw new Error("프로모션 데이터가 비어 있습니다.");
    }

    result.innerHTML = `<p class="guide">CSV 로드 완료. 상품코드를 입력해 조회하세요.</p>`;
  } catch (error) {
    console.error("CSV 로드 오류:", error);
    showMessage("error", `데이터 로드 중 오류가 발생했습니다. ${error.message}`);
  }
}

/**
 * 조회 실행
 */
function searchPromotion() {
  try {
    const inputCode = normalizeCode(input.value);

    if (!inputCode) {
      showMessage("error", "상품코드를 입력해주세요.");
      return;
    }

    if (!promotionDB.length) {
      showMessage("error", "프로모션 데이터가 아직 로드되지 않았습니다.");
      return;
    }

    let matchedRows = promotionDB.filter((item) => {
      return normalizeCode(getLookupCode(item)) === inputCode;
    });

    if (SHOW_ONLY_VALID_PROMOTIONS) {
      matchedRows = matchedRows.filter(isValidPromotion);
    }

    if (!matchedRows.length) {
      const noResultMessage = SHOW_ONLY_VALID_PROMOTIONS
        ? "해당 코드에 현재 적용 중인 프로모션이 없습니다."
        : "해당 코드에 연결된 프로모션이 없습니다.";

      showMessage("guide", noResultMessage);
      return;
    }

    const promotionHtml = renderPromotionRows(matchedRows);
    const validDateHtml = renderDateRows(matchedRows);

    result.innerHTML = renderResultCard({
      lookupCode: inputCode,
      matchCount: matchedRows.length,
      promotionHtml,
      validDateHtml
    });
  } catch (error) {
    console.error("조회 오류:", error);
    showMessage("error", `조회 중 오류가 발생했습니다. ${error.message}`);
  }
}

button.addEventListener("click", searchPromotion);

input.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    searchPromotion();
  }
});

loadCSV();
