const input = document.getElementById("productCode");
const button = document.getElementById("searchBtn");
const result = document.getElementById("result");

let productMapDB = [];
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
  return normalizeText(value).toUpperCase();
}

/**
 * 헤더 정규화
 * - 공백/탭 제거
 * - 소문자화
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
 * 상품 관련 getter
 */
function getRepresentativeCode(item) {
  return getValueByAliases(item, [
    "대표상품코드",
    "대표 상품코드",
    "representative code",
    "representativecode"
  ]);
}

function getProductCode(item) {
  return getValueByAliases(item, [
    "상품코드",
    "상품 코드",
    "product code",
    "productcode"
  ]);
}

function getTotalPrice(item) {
  return getValueByAliases(item, [
    "총상품가격",
    "총 상품가격",
    "판매가",
    "price"
  ]);
}

/**
 * 프로모션 관련 getter
 */
function getPromoRepresentativeCode(item) {
  return getValueByAliases(item, [
    "대표상품코드",
    "대표 상품코드",
    "representative code",
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

function getPriority(item) {
  return getValueByAliases(item, [
    "우선순위",
    "priority"
  ]);
}

/**
 * 가격 포맷
 */
function formatPrice(value) {
  const raw = normalizeText(value);
  if (!raw) return "-";

  const numeric = raw.replace(/[^\d.-]/g, "");
  if (!numeric || Number.isNaN(Number(numeric))) return escapeHTML(raw);

  return `${Number(numeric).toLocaleString("ko-KR")}원`;
}

/**
 * 날짜 문자열 -> Date
 * 지원 예:
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
 * YYYY-MM-DD -> YYYY.MM.DD
 */
function formatDate(dateString) {
  const date = toDate(dateString);
  if (!date) return "-";

  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}.${m}.${d}`;
}

/**
 * 유효 프로모션 여부
 */
function isValidPromotion(promo) {
  const startDate = toDate(getStartDate(promo));
  const endDate = toDate(getEndDate(promo));
  const today = getToday();

  if (!startDate || !endDate) return false;
  return today >= startDate && today <= endDate;
}

/**
 * 우선순위 숫자 변환
 */
function parsePriority(value) {
  const raw = normalizeText(value);
  if (!raw) return Number.POSITIVE_INFINITY;

  const num = Number(raw);
  return Number.isFinite(num) ? num : Number.POSITIVE_INFINITY;
}

/**
 * 중복 제거
 * 같은 프로모션명 + 같은 시작일 + 같은 종료일 + 같은 대표상품코드
 */
function removeDuplicatePromotions(promotions) {
  const seen = new Set();

  return promotions.filter((promo) => {
    const key = [
      normalizeCode(getPromoRepresentativeCode(promo)),
      normalizeText(getPromotionName(promo)),
      normalizeText(getStartDate(promo)),
      normalizeText(getEndDate(promo))
    ].join("||");

    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * 프로모션 정렬
 * 1) 우선순위 오름차순
 * 2) 시작일 오름차순
 * 3) 프로모션명 오름차순
 */
function sortPromotions(promotions) {
  return [...promotions].sort((a, b) => {
    const priorityDiff = parsePriority(getPriority(a)) - parsePriority(getPriority(b));
    if (priorityDiff !== 0) return priorityDiff;

    const aStart = toDate(getStartDate(a));
    const bStart = toDate(getStartDate(b));

    if (aStart && bStart) {
      const dateDiff = aStart - bStart;
      if (dateDiff !== 0) return dateDiff;
    }

    return normalizeText(getPromotionName(a)).localeCompare(
      normalizeText(getPromotionName(b)),
      "ko"
    );
  });
}

/**
 * 프로모션 HTML 렌더링
 */
function renderPromotionList(promotions) {
  const nameHtml = promotions
    .map((promo) => {
      return `<div class="promo-line">${escapeHTML(getPromotionName(promo) || "-")}</div>`;
    })
    .join("");

  const dateHtml = promotions
    .map((promo) => {
      const start = formatDate(getStartDate(promo));
      const end = formatDate(getEndDate(promo));
      return `<div class="promo-line">${escapeHTML(start)} ~ ${escapeHTML(end)}</div>`;
    })
    .join("");

  return { nameHtml, dateHtml };
}

/**
 * 결과 카드 렌더링
 */
function renderResultCard({
  representativeCode,
  productCode,
  totalPrice,
  promotionHtml,
  validDateHtml
}) {
  return `
    <div class="result-card">
      <div class="result-row">
        <div class="label">대표상품코드</div>
        <div class="value">${escapeHTML(representativeCode)}</div>
      </div>
      <div class="result-row">
        <div class="label">상품코드</div>
        <div class="value">${escapeHTML(productCode)}</div>
      </div>
      <div class="result-row">
        <div class="label">총상품가격</div>
        <div class="value">${totalPrice}</div>
      </div>
      <div class="result-row promotion-row">
        <div class="label">프로모션명</div>
        <div class="value promotion-list">${promotionHtml}</div>
      </div>
      <div class="result-row promotion-row">
        <div class="label">유효기간</div>
        <div class="value promotion-list">${validDateHtml}</div>
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
 * CSV 2개 로드
 */
async function loadCSVs() {
  try {
    showMessage("guide", "데이터를 불러오는 중입니다...");

    const [productRes, promoRes] = await Promise.all([
      fetch("./product_master_map.csv"),
      fetch("./master_promotion.csv")
    ]);

    if (!productRes.ok) {
      throw new Error(`product_master_map.csv 로드 실패: ${productRes.status}`);
    }

    if (!promoRes.ok) {
      throw new Error(`master_promotion.csv 로드 실패: ${promoRes.status}`);
    }

    const [productText, promoText] = await Promise.all([
      productRes.text(),
      promoRes.text()
    ]);

    productMapDB = parseCSV(productText);
    promotionDB = parseCSV(promoText);

    if (!productMapDB.length) {
      throw new Error("상품 마스터 데이터가 비어 있습니다.");
    }

    if (!promotionDB.length) {
      console.warn("프로모션 데이터가 비어 있습니다.");
    }

    showMessage("guide", "조회할 상품코드를 입력해 주세요.");
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

    if (!productMapDB.length) {
      showMessage("error", "상품 데이터가 아직 로드되지 않았습니다.");
      return;
    }

    const product = productMapDB.find((item) => {
      return normalizeCode(getProductCode(item)) === inputCode;
    });

    if (!product) {
      showMessage("error", "입력한 상품코드에 해당하는 상품 정보를 찾을 수 없습니다.");
      return;
    }

    const representativeCode = normalizeText(getRepresentativeCode(product));
    const productCode = normalizeText(getProductCode(product));
    const totalPrice = formatPrice(getTotalPrice(product));

    if (!representativeCode) {
      showMessage("error", "해당 상품코드에 연결된 대표상품코드가 없습니다.");
      return;
    }

    const matchedPromotions = promotionDB.filter((promo) => {
      return normalizeCode(getPromoRepresentativeCode(promo)) === normalizeCode(representativeCode);
    });

    const validPromotions = sortPromotions(
      removeDuplicatePromotions(
        matchedPromotions.filter(isValidPromotion)
      )
    );

    let promotionHtml = `<div class="promo-line">현재 유효한 프로모션 없음</div>`;
    let validDateHtml = `<div class="promo-line">-</div>`;

    if (validPromotions.length > 0) {
      const rendered = renderPromotionList(validPromotions);
      promotionHtml = rendered.nameHtml;
      validDateHtml = rendered.dateHtml;
    }

    result.innerHTML = renderResultCard({
      representativeCode: representativeCode || "-",
      productCode: productCode || "-",
      totalPrice: totalPrice || "-",
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

loadCSVs();
