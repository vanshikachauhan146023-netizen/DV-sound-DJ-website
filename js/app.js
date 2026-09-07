const REVIEW_PAGE_SIZE = 5;
const PUBLIC_REVIEW_CAP = 50;
let displayedReviews = [];
let reviewOffset = 0;
let totalApprovedReviews = 0;
let supabaseClient = null;


document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("year").textContent = new Date().getFullYear();
  setupNavigation();
  setupReveal();
  setupBackTop();
  setupRatingPicker();
  setupReviewForm();
  setupLoadMore();
  initReviews();
});

function setupNavigation(){
  const toggle = document.querySelector(".menu-toggle");
  const nav = document.querySelector(".nav");
  if(!toggle || !nav) return;
  toggle.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    toggle.setAttribute("aria-expanded", open);
  });
  nav.querySelectorAll("a").forEach(a => a.addEventListener("click", () => nav.classList.remove("open")));
}

function setupReveal(){
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if(entry.isIntersecting){
        entry.target.classList.add("visible");
        observer.unobserve(entry.target);
      }
    });
  }, {threshold:.12});
  document.querySelectorAll(".reveal").forEach(el => observer.observe(el));
}

function setupBackTop(){
  const btn = document.getElementById("back-top");
  if(!btn) return;
  window.addEventListener("scroll", () => btn.classList.toggle("show", window.scrollY > 600), {passive:true});
  btn.addEventListener("click", () => window.scrollTo({top:0, behavior:"smooth"}));
}

function setupRatingPicker(){
  const picker = document.querySelector(".rating-picker");
  if(!picker) return;
  const inputs = picker.querySelectorAll("input");
  const update = () => {
    const selected = picker.querySelector("input:checked");
    picker.dataset.value = selected ? selected.value : "";
  };
  inputs.forEach(input => input.addEventListener("change", update));
}

async function initReviews(){
  try{
    if(!window.supabase || !window.SUPABASE_URL || !window.SUPABASE_PUBLISHABLE_KEY) throw new Error("Supabase config is missing");
    supabaseClient = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_PUBLISHABLE_KEY);
    await loadReviewPage();
    const {data:stats, error:statsError} = await supabaseClient.rpc("get_review_stats");
    if(statsError) throw statsError;
    const row = stats?.[0] || {};
    totalApprovedReviews = Number(row.review_count || 0);
    updateRating(Number(row.average_rating || 0), totalApprovedReviews);
    renderReviews();
  }catch(err){
    console.error("Review system could not load:", err);
    displayedReviews = [];
    reviewOffset = 0;
    totalApprovedReviews = 0;
    updateRating(0, 0);
    renderReviews();
    const msg = document.getElementById("reviews-error");
    if(msg) msg.textContent = "Reviews are temporarily unavailable. Please try again later.";
  }
}

async function loadReviewPage(){
  const from = reviewOffset;
  const to = Math.min(reviewOffset + REVIEW_PAGE_SIZE - 1, PUBLIC_REVIEW_CAP - 1);
  if(from >= PUBLIC_REVIEW_CAP || (totalApprovedReviews > 0 && from >= totalApprovedReviews)) return;

  const {data, error, count} = await supabaseClient
    .from("reviews")
    .select("id,name,rating,review,created_at", {count:"exact"})
    .eq("status", "approved")
    .order("created_at", {ascending:false})
    .range(from, to);
  if(error) throw error;
  if(typeof count === "number") totalApprovedReviews = count;
  displayedReviews = displayedReviews.concat(data || []);
  reviewOffset = displayedReviews.length;
}



function updateRating(avg, count){
  const ratingEl = document.getElementById("average-rating");
  const countEl = document.getElementById("review-count");
  const starsEl = document.getElementById("average-stars");
  if(ratingEl) ratingEl.textContent = avg ? Number(avg).toFixed(1) : "0.0";
  if(countEl) countEl.textContent = Number(count || 0).toLocaleString();
  if(starsEl){
    const rounded = Math.max(0, Math.min(5, Math.round(Number(avg) || 0)));
    starsEl.textContent = "★".repeat(rounded) + "☆".repeat(5-rounded);
  }
}

function renderReviews(){
  const list = document.getElementById("reviews-list");
  if(!list) return;
  list.innerHTML = displayedReviews.slice(0, PUBLIC_REVIEW_CAP).map(r => `
    <article class="review-card reveal visible">
      <div>
        <div class="stars">${"★".repeat(Number(r.rating))}${"☆".repeat(5-Number(r.rating))}</div>
        <p class="review-text">“${escapeHtml(r.review)}”</p>
      </div>
      <div>
        <div class="review-name">${escapeHtml(r.name)}</div>
        <div class="review-date">${formatDate(r.created_at)}</div>
      </div>
    </article>`).join("");

  const button = document.getElementById("load-more");
  const noMore = document.getElementById("no-more");
  const atCap = displayedReviews.length >= PUBLIC_REVIEW_CAP;
  const reachedDatabaseEnd = totalApprovedReviews > 0 && displayedReviews.length >= totalApprovedReviews;
  const noReviewsYet = totalApprovedReviews === 0 && displayedReviews.length === 0;
  const shouldStop = noReviewsYet || atCap || reachedDatabaseEnd;
  if(button) button.hidden = shouldStop;
  if(noMore){
    noMore.hidden = !shouldStop;
    noMore.textContent = noReviewsYet ? "NO REVIEWS YET" : "NO MORE REVIEWS";
  }
}

function setupLoadMore(){
  const button = document.getElementById("load-more");
  if(!button) return;
  button.addEventListener("click", async () => {
    button.disabled = true;
    button.innerHTML = "LOADING…";
    try{
      if(!supabaseClient) throw new Error("Database unavailable");
      await loadReviewPage();
      renderReviews();
    }catch(err){
      console.error(err);
      const msg = document.getElementById("reviews-error");
      if(msg) msg.textContent = "Could not load more reviews. Please try again.";
    }finally{
      button.disabled = false;
      button.innerHTML = "LOAD MORE <span>↓</span>";
    }
  });
}

function setupReviewForm(){
  const form = document.getElementById("review-form");
  const msg = document.getElementById("form-message");
  if(!form || !msg) return;
  form.addEventListener("submit", async e => {
    e.preventDefault();
    const data = new FormData(form);
    const payload = {
      name: String(data.get("name") || "").trim(),
      rating: Number(data.get("rating") || 0),
      review: String(data.get("review") || "").trim()
    };
    if(!payload.name || !payload.review || !Number.isInteger(payload.rating) || payload.rating < 1 || payload.rating > 5){
      msg.textContent = "Please enter your name, choose a star rating, and write your review.";
      return;
    }
    msg.textContent = "Submitting…";
    try{
      if(!supabaseClient) throw new Error("Database unavailable");
      const {error} = await supabaseClient.from("reviews").insert(payload);
      if(error) throw error;
      form.reset();
      const picker = document.querySelector(".rating-picker");
      if(picker) picker.dataset.value = "";
      msg.textContent = "Your review was submitted successfully and is awaiting owner approval.";
    }catch(err){
      console.error(err);
      msg.textContent = "Your review could not be submitted right now. Please try again.";
    }
  });
}

function escapeHtml(value){
  return String(value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c]));
}
function formatDate(value){
  if(!value) return "";
  const d = new Date(value);
  return isNaN(d) ? "" : d.toLocaleDateString(undefined,{year:"numeric",month:"short",day:"numeric"});
}


function setupBookingModal(){
  const modal = document.getElementById("booking");
  if(!modal) return;
  const openers = document.querySelectorAll("[data-booking-open]");
  const closers = modal.querySelectorAll("[data-booking-close]");
  const dialog = modal.querySelector(".booking-dialog");
  let lastFocused = null;
  const open = (event) => {
    event?.preventDefault();
    lastFocused = document.activeElement;
    modal.classList.add("open");
    modal.setAttribute("aria-hidden","false");
    document.body.classList.add("modal-open");
    dialog?.querySelector(".booking-close")?.focus();
  };
  const close = () => {
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden","true");
    document.body.classList.remove("modal-open");
    lastFocused?.focus?.();
  };
  openers.forEach(el => el.addEventListener("click", open));
  closers.forEach(el => el.addEventListener("click", close));
  document.addEventListener("keydown", e => {
    if(e.key === "Escape" && modal.classList.contains("open")) close();
  });
}

const __previousDOMContentLoaded = window.__dvDOMContentLoadedSetup;
window.__dvDOMContentLoadedSetup = true;
document.addEventListener("DOMContentLoaded", setupBookingModal);
