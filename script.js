document.addEventListener("DOMContentLoaded", () => {
  console.log("script loaded");

  const input = document.getElementById("productCode");
  const button = document.getElementById("searchBtn");
  const result = document.getElementById("result");

  const CSV_FILE = "./master_promotion.csv";

  /**
   * true  -> 오늘 날짜 기준 유효한 프로모션만 표시
   * false -> CSV에 있는 해당 코드의 모든 프로모션 표시
   */
  const SHOW_ONLY_VALID_PROMOTIONS = false;

  let promotionDB = [];

  function normalizeText(value) {
    return String(value ?? "").replace(/^\uFEFF/, "").trim();
  }

  function normalizeCode(value) {
    return normalizeText(value).replace(/\s+/g, "").toUpperCase();
  }

  function escapeHTML(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

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

  function getProductCode(item) {
    return getValueByAliases(item, ["상품코드", "상품 코드", "productcode", "code"]);
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

  function parseDate(value) {
    const text = normalizeText(value);
    if (!text) return null;

    const normalized = text.replace(/\./g, "-").replace(/\//g, "-");
    const date = new Date(normalized);

    return Number.isNaN(date.getTime()) ? null : date;
  }

  function isValidPromotion(item) {
    const start = parseDate(getStartDate(item));
    const end = parseDate(getEndDate(item));
    const today = new Date();

    today.setHours(0, 0, 0, 0);

    if (start && today < start) return false;
    if (end && today > end) return false;

    return true;
  }

  function splitCSVLine(line) {
    const resultArr = [];
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
        resultArr.push(current);
        current = "";
      } else {
        current += char;
      }
    }

    resultArr.push(current);
    return resultArr;
  }

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
      const values = splitCSVLine(rowLine).map((value) => normalizeText(value));
      const record = {};

      headers.forEach((header, index) => {
        record[header] = values[index] ?? "";
      });

      return record;
    });
  }

  function showMessage(type, message) {
    result.innerHTML = `<p class="${type}">${escapeHTML(message)}</p>`;
  }

  function formatPrice(value) {
    const text = normalizeText(value);
    if (!text) return "-";

    const number = Number(text.replace(/,/g, ""));
    if (Number.isNaN(number)) return text;

    return `${number.toLocaleString("ko-KR")}원`;
  }

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

  function renderDateRows(rows) {
    return rows
      .map((item, index) => {
        const startDate = getStartDate(item) || "-";
        const endDate = getEndDate(item) || "-";

        return `
          <div class="promo-line">
            <span class="promo-order">${index + 1}.</span>
            <span class="promo-text">${escapeHTML(startDate)} ~ ${escapeHTML(endDate)}</span>
          </div>
        `;
      })
      .join("");
  }

  function renderPriceRows(rows) {
    return rows
      .map((item, index) => {
        const price = formatPrice(getTotalPrice(item));

        return `
          <div class="promo-line">
            <span class="promo-order">${index + 1}.</span>
            <span class="promo-text">${escapeHTML(price)}</span>
          </div>
        `;
      })
      .join("");
  }

  function renderResultCard({
    lookupCode,
    matchCount,
    promotionHtml,
    validDateHtml,
    priceHtml
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
          <div class="promo-box-value promo-list">${promotionHtml}</div>
        </div>

        <div class="promo-box">
          <div class="promo-box-title">VALID DATE</div>
          <div class="promo-box-value promo-list">${validDateHtml}</div>
        </div>

        <div class="promo-box">
          <div class="promo-box-title">TOTAL PRICE</div>
          <div class="promo-box-value promo-list">${priceHtml}</div>
        </div>
      </div>
    `;
  }

  async function loadCSV() {
    try {
      result.innerHTML = `<p class="guide">CSV 파일을 불러오는 중입니다...</p>`;

      let csvText = "";

      // 1) 우선 window.PROMOTION_CSV (master_promotion.js로 임베드된 데이터) 사용
      //    → file:// 로 index.html을 열어도 동작
      if (typeof window.PROMOTION_CSV === "string" && window.PROMOTION_CSV.length) {
        csvText = window.PROMOTION_CSV;
        console.log("CSV from embedded window.PROMOTION_CSV");
      } else {
        // 2) fallback: fetch (http(s):// 환경)
        const response = await fetch(CSV_FILE);
        if (!response.ok) {
          throw new Error(`master_promotion.csv 로드 실패: ${response.status}`);
        }
        csvText = await response.text();
        console.log("CSV from fetch");
      }

      promotionDB = parseCSV(csvText);

      if (!promotionDB.length) {
        throw new Error("프로모션 데이터가 비어 있습니다.");
      }

      result.innerHTML = `<p class="guide">CSV 로드 완료. 상품코드를 입력해 조회하세요.</p>`;
      console.log("CSV loaded:", promotionDB.length, "rows");
    } catch (error) {
      console.error("CSV 로드 오류:", error);
      showMessage(
        "error",
        `데이터 로드 중 오류가 발생했습니다. ${error.message} ` +
        `(file:// 로 열었다면 master_promotion.js 파일이 같은 폴더에 있는지 확인하세요)`
      );
    }
  }

  function searchPromotion() {
    console.log("search clicked");

    try {
      const inputCode = normalizeCode(input.value);

      if (!inputCode) {
        showMessage("guide", "상품코드를 입력하세요.");
        input.focus();
        return;
      }

      if (!promotionDB.length) {
        showMessage("error", "프로모션 데이터가 아직 로드되지 않았습니다.");
        return;
      }

      let matchedRows = promotionDB.filter(
        (item) => normalizeCode(getProductCode(item)) === inputCode
      );

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
      const priceHtml = renderPriceRows(matchedRows);

      result.innerHTML = renderResultCard({
        lookupCode: inputCode,
        matchCount: matchedRows.length,
        promotionHtml,
        validDateHtml,
        priceHtml
      });
    } catch (error) {
      console.error("조회 오류:", error);
      showMessage("error", `조회 중 오류가 발생했습니다. ${error.message}`);
    }
  }

  if (!input || !button || !result) {
    console.error("필수 DOM 요소를 찾지 못했습니다.", { input, button, result });
    alert("필수 DOM 요소를 찾지 못했습니다. id 값을 확인하세요.");
    return;
  }

  button.addEventListener("click", searchPromotion);

  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      searchPromotion();
    }
  });

  loadCSV();
});
