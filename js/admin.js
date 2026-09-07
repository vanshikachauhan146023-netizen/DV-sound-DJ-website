let sb = null;

const loginView = document.getElementById("login-view");
const dashboardView = document.getElementById("dashboard-view");
const loginForm = document.getElementById("login-form");
const loginMessage = document.getElementById("login-message");
const dashboardMessage = document.getElementById("dashboard-message");

window.addEventListener("DOMContentLoaded", async () => {
  if(!window.supabase || !window.SUPABASE_URL || !window.SUPABASE_PUBLISHABLE_KEY){
    loginMessage.textContent = "Supabase configuration is missing.";
    return;
  }
  sb = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_PUBLISHABLE_KEY);
  loginForm.addEventListener("submit", login);
  document.getElementById("logout-btn").addEventListener("click", logout);
  document.getElementById("refresh-btn").addEventListener("click", loadDashboard);
  sb.auth.onAuthStateChange((_event, session) => {
    if(session) loadDashboard();
    else showLogin();
  });
  const {data:{session}} = await sb.auth.getSession();
  if(session) await loadDashboard(); else showLogin();
});

async function login(e){
  e.preventDefault();
  loginMessage.textContent = "Signing in…";
  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;
  const {error} = await sb.auth.signInWithPassword({email,password});
  if(error){ loginMessage.textContent = error.message; return; }
  loginMessage.textContent = "";
}

async function logout(){ await sb.auth.signOut(); }

function showLogin(){ loginView.hidden=false; dashboardView.hidden=true; }
function showDashboard(){ loginView.hidden=true; dashboardView.hidden=false; }

async function loadDashboard(){
  showDashboard();
  setLoading("today-reviews", "Loading today's reviews…");
  setLoading("pending-reviews", "Loading pending reviews…");
  dashboardMessage.textContent = "";
  try{
    const {data:adminCheck, error:adminError} = await sb.rpc("is_current_user_admin");
    if(adminError) throw adminError;
    if(adminCheck !== true){
      dashboardMessage.textContent = "This account is not authorised as an admin. Add its Supabase user ID to the admin_users table.";
      return;
    }

    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end = new Date(start.getTime() + 86400000);
    document.getElementById("today-label").textContent = start.toLocaleDateString(undefined,{weekday:"long",year:"numeric",month:"long",day:"numeric"});

    const [{data:today,error:tErr},{data:pending,error:pErr},{data:stats,error:sErr}] = await Promise.all([
      sb.from("reviews").select("id,name,rating,review,created_at,status").gte("created_at", start.toISOString()).lt("created_at", end.toISOString()).order("created_at",{ascending:false}),
      sb.from("reviews").select("id,name,rating,review,created_at,status").eq("status","pending").order("created_at",{ascending:false}),
      sb.rpc("get_review_stats")
    ]);
    if(tErr) throw tErr; if(pErr) throw pErr; if(sErr) throw sErr;

    renderAdminReviews("today-reviews", "today-empty", today || [], true);
    renderAdminReviews("pending-reviews", "pending-empty", pending || [], true);

    const approvedCount = Number(stats?.[0]?.review_count || 0);
    const average = Number(stats?.[0]?.average_rating || 0);
    document.getElementById("approved-count").textContent = approvedCount.toLocaleString();
    document.getElementById("pending-count").textContent = String((pending||[]).length);
    document.getElementById("admin-average").textContent = average.toFixed(1);
  }catch(err){
    console.error(err);
    dashboardMessage.textContent = "Could not load the dashboard. Check the Supabase setup and admin permissions.";
  }
}

function renderAdminReviews(containerId, emptyId, reviews, moderation){
  const container = document.getElementById(containerId);
  const empty = document.getElementById(emptyId);
  if(!reviews.length){ container.innerHTML=""; empty.hidden=false; return; }
  empty.hidden=true;
  container.innerHTML = reviews.map(r => {
    const action = moderation && r.status === "pending" ? `
      <div class="admin-review-actions">
        <button class="button approve" data-action="approve" data-id="${r.id}">ACCEPT</button>
        <button class="button reject" data-action="delete" data-id="${r.id}">DELETE</button>
      </div>` : `<span class="status-badge status-${escapeHtml(r.status)}">${String(r.status).toUpperCase()}</span>`;
    return `<article class="admin-review">
      <div class="admin-review-main">
        <div class="admin-review-top"><span class="admin-review-name">${escapeHtml(r.name)}</span><span class="admin-review-date">${formatDateTime(r.created_at)}</span></div>
        <div class="admin-review-stars">${"★".repeat(Number(r.rating))}${"☆".repeat(5-Number(r.rating))}</div>
        <p class="admin-review-text">“${escapeHtml(r.review)}”</p>
        <div class="admin-review-status">STATUS: ${String(r.status).toUpperCase()}</div>
      </div>${action}</article>`;
  }).join("");
  container.querySelectorAll("button[data-action]").forEach(btn => btn.addEventListener("click", () => moderate(Number(btn.dataset.id), btn.dataset.action)));
}

async function moderate(id, action){
  const message = action === "approve" ? "Accepting review…" : "Deleting review…";
  dashboardMessage.textContent = message;
  try{
    if(action === "approve") {
      const {error} = await sb.rpc("moderate_review", {review_id:id, new_status:"approved"});
      if(error) throw error;
      dashboardMessage.textContent = "Review accepted and published.";
    } else if(action === "delete") {
      const confirmed = window.confirm("Delete this review permanently? This cannot be undone.");
      if(!confirmed){ dashboardMessage.textContent = "Delete cancelled."; return; }
      const {error} = await sb.from("reviews").delete().eq("id", id);
      if(error) throw error;
      dashboardMessage.textContent = "Review deleted from the database.";
    }
    await loadDashboard();
  }catch(err){
    console.error(err);
    dashboardMessage.textContent = err.message || "Could not update this review.";
  }
}

function setLoading(id, message){ document.getElementById(id).innerHTML = `<div class="loading-bar">${message}</div>`; }
function escapeHtml(value){return String(value).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c]));}
function formatDateTime(value){const d=new Date(value);return isNaN(d)?"":d.toLocaleString(undefined,{year:"numeric",month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"});}
