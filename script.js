const input = document.getElementById("productCode");
const button = document.getElementById("searchBtn");
const result = document.getElementById("result");

let productMapDB = [];
let promotionDB = [];

/**
 * 단순 CSV 파서 + BOM 제거
 */
function parseCSV(text) {
  const cleanedText = text.replace(/^\uFEFF/, "");
  const lines = cleanedText.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.trim());

  return lines.slice(1).map((line) => {
    const values = line.split(",");
    const row = {};

    headers.forEach((header, index) => {
      row[header] = (values[index] || "").trim();
    });

    return row;
  });
}

/**
 * CSV 2개 로드
 */
async function loadCSVs() {
  try {
    const productRes = await fetch("./product_master_map.csv");
    const promoRes = await fetch("./master_promotion.csv");

    if (!productRes.ok) {
      throw new Error(`product_master_map.csv 로드 실패: ${productRes.status}`);
    }

    if (!promoRes.ok) {
      throw new Error(`master_promotion.csv 로드 실패: ${promoRes.status}`);
    }

    const productText = await productRes.text();
    const promoText = await promoRes.text();

    productMapDB = parseCSV(productText);
    promotionDB = parseCSV(promoText);

    result.innerHTML = `<p class="guide">조회할 상품코드를 입력해 주세요.</p>`;
  } catch (error) {
    console.error("CSV 로드 오류:", error);
    result.innerHTML = `
      <p class="error">
        CSV 파일을 불러오지 못했습니다.<br>
        ${error.message}
      </p>
    `;
  }
}

function toDate(dateString) {
  if (!dateString) return null;
  return new Date(dateString + "T00:00:00");
}

function getToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function formatPrice(value) {
  if (!value) return "-";

  const numeric = String(value).replace(/[^\d.-]/g, "");
  if (!numeric || isNaN(Number(numeric))) return value;

  return `${Number(numeric).toLocaleString("ko-KR")}원`;
}

function formatDate(dateString) {
  if (!dateString) return "-";
  return dateString.replaceAll("-", ".");
}

function getProductCode(item) {
  return (
    item["상품코드"] ||
    item["상품 코드"] ||
    item["PRODUCT CODE"] ||
    item["product code"] ||
    ""
  );
}

function getRepresentativeCode(item) {
  return (
    item["대표상품코드"] ||
    item["대표 상품코드"] ||
    item["REPRESENTATIVE CODE"] ||
    item["representative code"] ||
    ""
  );
}

function getTotalPrice(item) {
  return (
    item["총상품가격"] ||
    item["총 상품가격"] ||
    item["판매가"] ||
    item["PRICE"] ||
    item["price"] ||
    ""
  );
}

function getPromoRepresentativeCode(item) {
  return (
    item["대표상품코드"] ||
    item["대표 상품코드"] ||
    item["REPRESENTATIVE CODE"] ||
    item["representative code"] ||
    ""
  );
}

function getPromotionName(item) {
  return (
    item["프로모션명"] ||
    item["프로모션 명"] ||
    item["PROMOTION NAME"] ||
    item["promotion name"] ||
    item["프로모션"] ||
    item["행사명"] ||
    item["판촉명"] ||
    "-"
  );
}

function getStartDate(item) {
  return (
    item["시작일"] ||
    item["프로모션시작일"] ||
    item["START DATE"] ||
    item["start date"] ||
    ""
  );
}

function getEndDate(item) {
  return (
    item["종료일"] ||
    item["프로모션종료일"] ||
    item["END DATE"] ||
    item["end date"] ||
    ""
  );
}

function isValidPromotion(promo) {
  const startDate = toDate(getStartDate(promo));
  const endDate = toDate(getEndDate(promo));
  const today = getToday();

  if (!startDate || !endDate) return false;

  return today >= startDate && today <= endDate;
}

/**
 * 중복 제거
 * 같은 프로모션명 + 같은 시작일 + 같은 종료일이면 1개로 처리
 */
function removeDuplicatePromotions(promotions) {
  const seen = new Set();

  return promotions.filter((promo) => {
    const key = [
      getPromotionName(promo),
      getStartDate(promo),
      getEndDate(promo)
    ].join("||");

    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * 여러 프로모션 HTML 렌더링
 */
function renderPromotionList(promotions) {
  const nameHtml = promotions
    .map((promo) => `<div class="promo-line">${getPromotionName(promo)}</div>`)
    .join("");

  const dateHtml = promotions
    .map((promo) => {
      const start = formatDate(getStartDate(promo));
      const end = formatDate(getEndDate(promo));
      return `<div class="promo-line">${start} ~ ${end}</div>`;
    })
    .join("");

  return { nameHtml, dateHtml };
}

function renderResultCard({ representativeCode, productCode, totalPrice, promotionHtml, validDateHtml }) {
  result.innerHTML = `
    <div class="result-card">
      <div class="result-list">
        <div class="result-item">
          <div class="key">대표상품코드</div>
          <div class="value">${representativeCode}</div>
        </div>
        <div class="result-item">
          <div class="key">상품코드</div>
          <div class="value">${productCode}</div>
        </div>
        <div class="result-item">
          <div class="key">총상품가격</div>
          <div class="value">${totalPrice}</div>
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
    </div>
  `;
}

/**
 * 조회
 * 상품코드 -> 대표상품코드 -> 오늘 유효한 프로모션 전부 표시
 */
function searchPromotion() {
  const inputCode = input.value.trim().toUpperCase();

  if (!inputCode) {
    result.innerHTML = `<p class="error">상품코드를 입력해주세요.</p>`;
    return;
  }

  const product = productMapDB.find((item) => {
    return getProductCode(item).trim().toUpperCase() === inputCode;
  });

  if (!product) {
    result.innerHTML = `
      <p class="error">
        입력한 상품코드에 해당하는 상품 정보를 찾을 수 없습니다.
      </p>
    `;
    return;
  }

  const representativeCode = getRepresentativeCode(product) || "-";
  const productCode = getProductCode(product) || "-";
  const totalPrice = formatPrice(getTotalPrice(product) || "-");

  if (representativeCode === "-") {
    result.innerHTML = `
      <p class="error">
        해당 상품코드에 연결된 대표상품코드가 없습니다.
      </p>
    `;
    return;
  }

  const matchedPromotions = promotionDB.filter((promo) => {
    return getPromoRepresentativeCode(promo).trim() === representativeCode.trim();
  });

  const validPromotions = removeDuplicatePromotions(
    matchedPromotions.filter(isValidPromotion)
  );

  if (validPromotions.length === 0) {
    renderResultCard({
      representativeCode,
      productCode,
      totalPrice,
      promotionHtml: `<div class="promo-line">현재 유효한 프로모션 없음</div>`,
      validDateHtml: `<div class="promo-line">-</div>`
    });
    return;
  }

  const { nameHtml, dateHtml } = renderPromotionList(validPromotions);

  renderResultCard({
    representativeCode,
    productCode,
    totalPrice,
    promotionHtml: nameHtml,
    validDateHtml: dateHtml
  });
}

button.addEventListener("click", searchPromotion);

input.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    searchPromotion();
  }
});

loadCSVs();
