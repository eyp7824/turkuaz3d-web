/*
 * Turkuaz 3D yerel yorum görünümü.
 * API adresi, Worker kurulup Google Business Profile API erişimi onaylanana dek BOŞ kalır.
 * Güvenlik: Google'dan gelen yorumlar innerHTML değil textContent ile oluşturulur.
 * Gerçek yorum gelmiyorsa uydurma yıldız, kişi veya değerlendirme gösterilmez.
 */
(() => {
  "use strict";
  const root = document.querySelector("[data-native-google-reviews]");
  if (!root) return;
  const endpoint = root.getAttribute("data-reviews-endpoint") || "";
  const status = root.querySelector("[data-review-status]");
  const reviewsBox = root.querySelector("[data-review-cards]");
  const summary = root.querySelector("[data-review-summary]");
  if (!endpoint || !/^https:\/\/[^\s]+$/i.test(endpoint)) return;

  const el = (tag, cls, str) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (str !== undefined && str !== null) node.textContent = String(str);
    return node;
  };
  const safeHttps = value => {
    try { const url = new URL(value); return url.protocol === "https:" ? url.href : null; }
    catch { return null; }
  };
  const labels = ["", "★", "★★", "★★★", "★★★★", "★★★★★"];
  const abort = new AbortController();
  const timeout = setTimeout(() => abort.abort(), 10000);
  fetch(endpoint, { method: "GET", mode: "cors", credentials: "omit", signal: abort.signal })
    .then(async res => {
      if (!res.ok) throw new Error("Yorumlar alınamadı");
      return res.json();
    })
    .then(data => {
      if (!Array.isArray(data.reviews)) throw new Error("Beklenmeyen veri biçimi");
      reviewsBox.replaceChildren();
      if (!data.reviews.length) {
        status.textContent = "Henüz gösterilecek Google yorumu bulunamadı. Google İşletme profilinden inceleyebilirsiniz.";
        return;
      }
      const count = Number(data.totalReviewCount);
      const average = Number(data.averageRating);
      if (Number.isFinite(average) && average >= 1 && average <= 5 &&
          Number.isInteger(count) && count >= 0) {
        summary.textContent = "Google İşletme değerlendirmesi: " +
          average.toLocaleString("tr-TR", { maximumFractionDigits: 1 }) +
          "/5 • " + count.toLocaleString("tr-TR") + " yorum";
        summary.hidden = false;
      }
      for (const review of data.reviews) {
        const card = el("article", "native-review-card");
        const heading = el("div", "native-review-heading");
        if (review.avatar && safeHttps(review.avatar)) {
          const img = document.createElement("img");
          img.src = safeHttps(review.avatar);
          img.alt = "";
          img.loading = "lazy";
          img.width = 42; img.height = 42;
          heading.appendChild(img);
        }
        heading.appendChild(el("strong", "", review.author || "Google kullanıcısı"));
        card.appendChild(heading);
        const rating = Number(review.rating);
        if (Number.isInteger(rating) && rating >= 1 && rating <= 5) {
          card.appendChild(el("p", "native-review-stars", labels[rating] + " (" + rating + "/5)"));
        }
        if (review.comment) card.appendChild(el("p", "native-review-text", review.comment));
        const footer = el("div", "native-review-footer");
        if (review.updatedAt && !Number.isNaN(Date.parse(review.updatedAt))) {
          footer.appendChild(el("time", "", new Date(review.updatedAt).toLocaleDateString("tr-TR")));
        }
        const link = el("a", "", "Google üzerinde görüntüle");
        link.href = safeHttps(review.sourceUrl) ||
          "https://www.google.com/maps/search/?api=1&query=Turkuaz%203D%20Bursa&query_place_id=ChIJVaBnoe2MlicReTWnbVpiZPc";
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        footer.appendChild(link);
        card.appendChild(footer);
        reviewsBox.appendChild(card);
      }
      status.hidden = true;
      reviewsBox.hidden = false;
    })
    .catch(() => {
      status.textContent = "Yorumlar şu an yüklenemiyor. Güncel yorumları Google Haritalar'dan görüntüleyebilirsiniz.";
    })
    .finally(() => clearTimeout(timeout));
})();
