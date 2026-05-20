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

  const headers = lines[0].split(",").map(h => h.trim());
  console.log("CSV 헤더:", headers);

  return lines.slice(1).map(line => {
    const values = line.split(",");
    const obj = {};

    headers.forEach((header, index) => {
      obj[header] = (values[index] || "").trim();
    });

    return obj;
  });
}

/**
 * CSV 파일 로드
 */
async function loadCSV() {
  try {
    result.innerHTML = `<p class="loading">CSV 데이터를 불러오는 중입니다...</p>`;

    const response = await fetch("promotions.csv");

    if (!response.ok) {
      throw new Error(`HTTP 오류: ${response.status}`);
    }

    const csvText = await response.text();
    productDB = parseCSV(csvText);

    console.log("로드된 데이터:", productDB);

    if (productDB.length === 0) {
      result.innerHTML = `<p class="error">CSV 데이터가 비어 있거나 형식이 올바르지 않습니다.</p>`;
      return;
    }

    result.innerHTML = `<p class="loading">CSV 로드 완료. 상품코드를 입력해 조회하세요.</p>`;
  } catch (error) {
    result.innerHTML = `
      <p class="error">
        CSV 파일을 불러오지 못했습니다.<br>
        파일명이 <strong>promotions.csv</strong> 인지 확인하고,<br>
        Live Server로 실행 중인지 확인해주세요.
      </p>
    `;
    console.error("CSV 로드 오류:", error);
  }
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

  const found = productDB.find(item => {
    const csvCode = String(item["상품코드"] || "").trim().toUpperCase();
    console.log("비교 중:", csvCode, code);
    return csvCode === code;
  });

  if (!found) {
    result.innerHTML = `<p class="error">해당 상품코드의 프로모션 정보를 찾지 못했습니다.</p>`;
    return;
  }

  result.innerHTML = `
    <div class="result-card">
      <div class="result-item"><strong>대표상품코드</strong> ${found["대표상품코드"] || "-"}</div>
      <div class="result-item"><strong>상품코드</strong> ${found["상품코드"] || "-"}</div>
      <div class="result-item"><strong>총상품가격</strong> ${found["총상품가격"] || "-"}</div>
      <div class="promo-name">
        <div class="promo-name-title">PROMOTION NAME</div>
        <div class="promo-name-value">${found["프로모션 명"] || "-"}</div>
      </div>
    </div>
  `;
}

/**
 * 이벤트 연결
 */
button.addEventListener("click", searchPromotion);

input.addEventListener("keydown", function (e) {
  if (e.key === "Enter") {
    searchPromotion();
  }
});

/**
 * 초기 실행
 */
loadCSV();
