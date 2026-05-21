const input = document.getElementById("productCode");
const button = document.getElementById("searchBtn");
const result = document.getElementById("result");

let productMapDB = [];
let promotionDB = [];

/**
 * 단순 CSV 파서
 */
function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
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

    console.log("상품 데이터:", productMapDB);
    console.log("프로모션 데이터:", promotionDB);

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

/**
 * 날짜 변환
 */
function toDate(dateString) {
  if (!dateString) return null;
  return new Date(dateString + "T00:00:00");
}

/**
 * 오늘 날짜
 */
function getToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/**
 * 가격 포맷
 */
function formatPrice(value) {
  if (!value) return "-";

  const numeric = String(value).replace(/[^\d.-]/g, "");
  if (!numeric || isNaN(Number(numeric))) return value;

  return `${Number(numeric).toLocaleString("ko-KR")}원`;
}

/**
 * 오늘 기준 유효한 프로모션인지 체크
 */
function isValidPromotion(promo) {
  const startDate = toDate(promo["시작일"]);
  const endDate = toDate(promo["종료일"]);
  const today = getToday();

  if (!startDate || !endDate) return false;

  return today >= startDate && today <= endDate;
}

/**
 * 우선순위 정렬
 */
function sortByPriority(a, b) {
  const priorityA = Number(a["우선순위"] || 9999);
  const priorityB = Number(b["우선순위"] || 9999);

  return priorityA - priorityB;
}

/**
 * 상품코드 가져오기
 */
function getProductCode(item) {
  return (
    item["상품코드"] ||
    item["상품 코드"] ||
    item["PRODUCT CODE"] ||
    ""
  );
}

/**
 * 대표상품코드 가져오기
 */
function getRepresentativeCode(item) {
  return (
    item["대표상품코드"] ||
    item["대표상품코드"] ||
    item["REPRESENTATIVE CODE"] ||
    ""
  );
}

/**
 * 총상품가격 가져오기
 */
function getTotalPrice(item) {
  return (
    item["총상품가격"] ||
    item["총 상품가격"] ||
    item["판매가"] ||
    ""
  );
}

/**
 * 프로모션 파일의 대표상품코드 가져오기
 */
function getPromoRepresentativeCode(item) {
  return (
    item["대표상품코드"] ||
    item["대표상품코드"] ||
    item["REPRESENTATIVE CODE"] ||
    ""
  );
}

/**
 * 프로모션 조회
 * 상품코드 -> 대표상품코드 -> 오늘 유효한 프로모션 조회
 */
function searchPromotion() {
  const inputCode = input.value.trim().toUpperCase();

  if (!inputCode) {
    result.innerHTML = `<p class="error">상품코드를 입력해주세요.</p>`;
    return;
  }

  // 1) 상품코드로 상품 정보 찾기
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

  const representativeCode = getRepresentativeCode(product);
  const productCode = getProductCode(product) || "-";
  const totalPrice = formatPrice(getTotalPrice(product) || "-");

  if (!representativeCode) {
    result.innerHTML = `
      <p class="error">
        해당 상품코드에 연결된 대표상품코드가 없습니다.
      </p>
    `;
    return;
  }

  // 2) 대표상품코드로 연결된 프로모션 전체 찾기
  const matchedPromotions = promotionDB.filter((promo) => {
    return getPromoRepresentativeCode(promo).trim() === representativeCode.trim();
  });

  // 3) 오늘 기준 유효한 프로모션만 필터
  const validPromotions = matchedPromotions.filter(isValidPromotion);

  if (validPromotions.length === 0) {
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
            <div class="promo-box-value">현재 유효한 프로모션 없음</div>
          </div>
          <div class="promo-box">
            <div class="promo-box-title">VALID DATE</div>
            <div class="promo-box-value">-</div>
          </div>
        </div>
      </div>
    `;
    return;
  }

  // 4) 여러 개면 우선순위 높은 것 1개 선택
  validPromotions.sort(sortByPriority);
  const selectedPromotion = validPromotions[0];

  const promotionName = selectedPromotion["프로모션명"] || "-";
  const validDate = `${selectedPromotion["시작일"] || "-"} ~ ${selectedPromotion["종료일"] || "-"}`;

  // 5) 출력
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
          <div class="promo-box-value">${promotionName}</div>
        </div>
        <div class="promo-box">
          <div class="promo-box-title">VALID DATE</div>
          <div class="promo-box-value">${validDate}</div>
        </div>
      </div>
    </div>
  `;
}

button.addEventListener("click", searchPromotion);

input.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    searchPromotion();
  }
});

loadCSVs();
