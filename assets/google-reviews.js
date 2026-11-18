/* The browser receives public review text only. OAuth credentials stay on GitHub Actions. */
(() => {
  const target = document.getElementById('turkuaz-google-reviews');
  if (!target) return;

  const source = '/data/google-reviews.json';
  const note = document.querySelector('.google-reviews-note');
  const dateFormat = new Intl.DateTimeFormat('tr-TR', { year: 'numeric', month: 'long', day: 'numeric' });

  function fallback() {
    // This site uses its own Google Business Profile data, with no paid widget dependency.
    const message = document.createElement('p');
    message.className = 'google-reviews-unavailable';
    message.textContent = 'Google yorumları şu anda sitede yüklenemedi. Güncel yorumları Google İşletme profilimizden görebilirsiniz.';

    const link = document.createElement('a');
    link.className = 'btn btn-light';
    link.href = 'https://www.google.com/maps/search/?api=1&query=Turkuaz%203D%20Bursa&query_place_id=ChIJVaBnoe2MlicReTWnbVpiZPc';
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = 'Google Yorumlarını Gör ↗';
    target.replaceChildren(message, link);
  }

  function reviewCard(review) {
    const card = document.createElement('article');
    card.className = 'direct-review-card';
    const name = document.createElement('strong');
    name.className = 'direct-review-name';
    name.textContent = String(review.reviewer || 'Google kullanıcısı');

    const stars = document.createElement('span');
    stars.className = 'direct-review-stars';
    const rating = Number(review.rating);
    const score = Number.isInteger(rating) ? Math.max(0, Math.min(5, rating)) : 0;
    stars.textContent = '★'.repeat(score) + '☆'.repeat(5 - score);
    stars.setAttribute('aria-label', `${score} / 5 yıldız`);

    card.append(name, stars);
    if (review.comment) {
      const comment = document.createElement('p');
      comment.textContent = String(review.comment);
      card.append(comment);
    }
    if (review.created_at) {
      const stamp = new Date(review.created_at);
      if (!Number.isNaN(stamp.getTime())) {
        const time = document.createElement('time');
        time.dateTime = String(review.created_at);
        time.textContent = dateFormat.format(stamp);
        card.append(time);
      }
    }
    return card;
  }

  function showReviews(data) {
    const wrapper = document.createElement('div');
    wrapper.className = 'direct-google-reviews';
    const summary = document.createElement('div');
    summary.className = 'direct-review-summary';
    const rating = Number(data.average_rating);
    const count = Number(data.total_review_count);
    summary.textContent = `${Number.isFinite(rating) && rating > 0 ? rating.toLocaleString('tr-TR', {maximumFractionDigits: 1}) + ' / 5 ★ · ' : ''}${Number.isFinite(count) ? count : data.reviews.length} Google değerlendirmesi`;
    wrapper.append(summary);

    const grid = document.createElement('div');
    grid.className = 'direct-review-grid';
    data.reviews.slice(0, 9).forEach(review => grid.append(reviewCard(review)));
    wrapper.append(grid);
    target.replaceChildren(wrapper);
    if (note) note.textContent = 'Gerçek Google İşletme yorumlarımız doğrudan Google verileriyle otomatik güncellenir. Yeni yorumların sitede görünmesi biraz zaman alabilir.';
  }

  fetch(`${source}?t=${Math.floor(Date.now() / 60000)}`, { cache: 'no-store' })
    .then(response => {
      if (!response.ok) throw new Error('Not configured');
      return response.json();
    })
    .then(data => {
      if (!Array.isArray(data.reviews) || data.reviews.length === 0 || data.business !== 'Turkuaz 3D') {
        throw new Error('No verified reviews');
      }
      showReviews(data);
    })
    .catch(fallback);
})();
