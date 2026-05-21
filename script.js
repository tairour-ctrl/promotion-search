const input = document.getElementById("productCode");
const button = document.getElementById("searchBtn");
const result = document.getElementById("result");

let productMapDB = [];
let promotionDB = [];

/**
 * 단순 CSV 파서
 * 주의: 값 안에 쉼표가 들어가는 복잡한 CSV는 별도 보완 필요
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
    const [productRes, promoRes] = await Promise.all([
      fetch("./product_master_map.csv"),
      fetch("./master_promotion.csv")
    ]);

    if (!productRes.ok) {
      throw new Error("product_master_map.csv 로드 실패");
    }

    if (!promoRes.ok) {
      throw new Error("master_promotion.csv 로드 실패");
    }

    const productText = await productRes.text();
    const promoText = await promoRes.text();

    productMapDB = parseCSV(productText);
    promotionDB = parseCSV(promoText);

    console.log("상품-마스터 데이터:", productMapDB);
    console.log("프로모션 데이터:", promotionDB);

    result.innerHTML = `<p class="guide">조회할 상품코드를 입력해 주세요.</p>`;
  } catch (error) {
    console.error(error);
    result.innerHTML = `
      <p class="error">
        CSV 파일을 불러오지 못했습니다.<br>
        파일 경로와 파일명을 확인해주세요.
      </p>
    `;
  }
}

/**
 * 날짜를 YYYY-MM-DD 기준으로 안전하게 비교하기 위한 Date 생성
 */
function toDate(dateString) {
  if (!dateString) return null;
  return new Date(dateString + "T00:00:00");
}

/**
 * 오늘 날짜 구하기
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
 * 우선순위 오름차순 정렬
 * 우선순위가 없으면 큰 숫자로 처리
 */
function sortByPriority(a, b) {
  const priorityA = Number(a["우선순위"] || 9999);
  const priorityB = Number(b["우선순위"] || 9999);

  return priorityA - priorityB;
}

/**
 * 프로모션 조회
 * 상품코드 -> 마스터코드 -> 유효 프로모션 필터 -> 우선순위 1건 선택
 */
function searchPromotion() {
  const inputCode = input.value.trim().toUpperCase();

  if (!inputCode) {
    result.innerHTML = `<p class="error">상품코드를 입력해주세요.</p>`;
    return;
  }

  // 1) 상품코드로 상품 정보 찾기
  const product = productMapDB.find((item) => {
    return (item["상품코드"] || "").trim().toUpperCase() === inputCode;
  });

  if (!product) {
    result.innerHTML = `
      <p class="error">
        입력한 상품코드에 해당하는 상품 정보를 찾을 수 없습니다.
      </p>
    `;
    return;
  }

  const masterCode = product["마스터코드"] || "";
  const displayMasterCode = product["대표상품코드"] || masterCode || "-";
  const productCode = product["상품코드"] || "-";
  const totalPrice = formatPrice(product["총상품가격"] || "-");

  if (!masterCode) {
    result.innerHTML = `
      <p class="error">
        해당 상품코드에 연결된 마스터코드가 없습니다.
      </p>
    `;
    return;
  }

  // 2) 마스터코드로 연결된 프로모션 전체 찾기
  const matchedPromotions = promotionDB.filter((promo) => {
    return (promo["마스터코드"] || "").trim() === masterCode.trim();
  });

  if (matchedPromotions.length === 0) {
    result.innerHTML = `
      <div class="result-card">
        <div class="result-list">
          <div class="result-item">
            <div class="key">대표상품코드</div>
            <div class="value">${displayMasterCode}</div>
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

  // 3) 오늘 기준 유효한 프로모션만 필터
  const validPromotions = matchedPromotions.filter(isValidPromotion);

  if (validPromotions.length === 0) {
    result.innerHTML = `
      <div class="result-card">
        <div class="result-list">
          <div class="result-item">
            <div class="key">대표상품코드</div>
            <div class="value">${displayMasterCode}</div>
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

  // 4) 여러 개면 우선순위 가장 높은 것 1개 선택
  validPromotions.sort(sortByPriority);
  const selectedPromotion = validPromotions[0];

  const promotionName = selectedPromotion["프로모션명"] || "-";
  const validDate = `${selectedPromotion["시작일"] || "-"} ~ ${selectedPromotion["종료일"] || "-"}`;

  // 5) 화면 출력
  result.innerHTML = `
    <div class="result-card">
      <div class="result-list">
        <div class="result-item">
          <div class="key">대표상품코드</div>
          <div class="value">${displayMasterCode}</div>
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
