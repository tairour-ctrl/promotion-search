const input = document.getElementById("productCode");
const button = document.getElementById("searchBtn");
const result = document.getElementById("result");

let productDB = [];

/**
 * CSV 텍스트를 배열 객체로 변환
 */
function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.trim());
  console.log("CSV 헤더:", headers);

  return lines.slice(1).map((line) => {
    const values = line.split(",");
    const obj = {};

    headers.forEach((header, index) => {
      obj[header] = values[index] ? values[index].trim() : "";
    });

    return obj;
  });
}

/**
 * CSV 파일 로드
 */
async function loadCSV() {
  try {
    const response = await fetch("./promotions.csv");
    if (!response.ok) {
      throw new Error("CSV 파일 로드 실패");
    }

    const csvText = await response.text();
    productDB = parseCSV(csvText);
    console.log("불러온 데이터:", productDB);
  } catch (error) {
    result.innerHTML = `
      <p class="error">
        CSV 파일을 불러오지 못했습니다.<br>
        파일명이 <strong>promotions.csv</strong> 인지 확인하고,<br>
        Live Server 또는 정상 배포 환경에서 실행 중인지 확인해주세요.
      </p>
    `;
    console.error("CSV 로드 오류:", error);
  }
}

/**
 * 가격 포맷
 */
function formatPrice(value) {
  if (!value) return "-";

  const onlyNumber = String(value).replace(/[^\d.-]/g, "");
  if (!onlyNumber || isNaN(Number(onlyNumber))) return value;

  return `${Number(onlyNumber).toLocaleString("ko-KR")}원`;
}

/**
 * 유효기간 컬럼 유연 처리
 */
function getValidDate(item) {
  return (
    item["유효기간"] ||
    item["적용기간"] ||
    item["프로모션 기간"] ||
    item["VALID DATE"] ||
    item["valid date"] ||
    "-"
  );
}

/**
 * 프로모션명 컬럼 유연 처리
 */
function getPromotionName(item) {
  return (
    item["프로모션명"] ||
    item["프로모션 명"] ||
    item["PROMOTION NAME"] ||
    item["promotion name"] ||
    "-"
  );
}

/**
 * 대표상품코드 컬럼 유연 처리
 */
function getMasterCode(item) {
  return (
    item["대표상품코드"] ||
    item["대표 상품코드"] ||
    item["마스터상품코드"] ||
    item["MASTER CODE"] ||
    "-"
  );
}

/**
 * 상품코드 컬럼 유연 처리
 */
function getProductCode(item) {
  return item["상품코드"] || item["상품 코드"] || item["PRODUCT CODE"] || "-";
}

/**
 * 총상품가격 컬럼 유연 처리
 */
function getTotalPrice(item) {
  return (
    item["총상품가격"] ||
    item["총 상품가격"] ||
    item["판매가"] ||
    item["PRICE"] ||
    "-"
  );
}

/**
 * 상품코드로 프로모션 검색
 */
function searchPromotion() {
  const code = input.value.trim().toUpperCase();
  console.log("입력한 상품코드:", code);

  if (!code) {
    result.innerHTML = `<p class="error">상품코드를 입력해주세요.</p>`;
    return;
  }

  const found = productDB.find((item) => {
    const productCode = getProductCode(item);
    return String(productCode).trim().toUpperCase() === code;
  });

  if (!found) {
    result.innerHTML = `
      <p class="error">
        입력한 상품코드에 해당하는 프로모션 정보를 찾을 수 없습니다.
      </p>
    `;
    return;
  }

  const masterCode = getMasterCode(found);
  const productCode = getProductCode(found);
  const totalPrice = formatPrice(getTotalPrice(found));
  const promotionName = getPromotionName(found);
  const validDate = getValidDate(found);

  result.innerHTML = `
    <div class="result-card">
      <div class="result-list">
        <div class="result-item">
          <div class="key">대표상품코드</div>
          <div class="value">${masterCode}</div>
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

input.addEventListener("keypress", (event) => {
  if (event.key === "Enter") {
    searchPromotion();
  }
});

loadCSV();
