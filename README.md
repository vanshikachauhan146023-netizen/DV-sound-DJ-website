# DV SOUND & DJ KUKMA — Client Website

Premium DJ/event-production website built with plain HTML, CSS and JavaScript, plus Supabase for reviews and owner moderation.

## Included
- Premium dark DJ aesthetic with pink, electric blue and purple neon accents, inspired by the supplied reference.
- Responsive mobile/tablet/desktop layout.
- About, Services, Gallery, Reviews, Location and Contact sections.
- Scroll reveal animations, hover effects, animated equalizer and back-to-top button.
- Floating WhatsApp button using the provided contact number.
- Customer review form: name + 1–5 stars + review text.
- Customer sees a success message after submitting; reviews start as `pending`.
- The public site starts at 0 reviews and shows no fake/demo reviews.
- Owner/admin page at `admin.html` with Supabase email/password login.
- Admin can ACCEPT or DELETE pending reviews; DELETE removes the row from Supabase.
- Public site shows at most 50 approved reviews.
- Public initial batch is 5 reviews; every LOAD MORE click fetches 5 more; never more than 50 are displayed.
- The average rating and total approved review count are calculated across ALL approved reviews, even when only 50 are displayed.
- Database has NO artificial review-count cap.

## Supabase setup
1. Open Supabase Dashboard -> SQL Editor.
2. Run `supabase/reviews.sql`.
3. Go to Authentication -> Users and create the owner's email/password account. Keep registration closed; do not add a public sign-up page.
4. Copy the owner's Auth user UUID.
5. In SQL Editor run:
   `insert into public.admin_users(user_id) values ('OWNER-USER-UUID');`
6. Open `admin.html` and sign in with that owner account.

## Public review workflow
Customer -> submits name/rating/review -> row is stored as `pending` -> owner sees it in admin -> owner ACCEPTS or REJECTS -> accepted review becomes public and immediately contributes to the average.

Deleted reviews are removed from Supabase. Accepted reviews become public and are included in the average.

## Review scalability
The website does NOT download the whole review table. It retrieves 5 approved reviews at a time with database pagination. The database can keep growing until the Supabase project's plan/storage/compute limits are reached.

## Security
- The browser uses only the supplied Supabase publishable key.
- Never place a Supabase `service_role` or secret key in frontend files.
- Row Level Security is enabled.
- Anonymous visitors can insert only `pending` reviews.
- Anonymous visitors can read only approved reviews.
- Only users listed in `admin_users` can moderate reviews.
- For production, add CAPTCHA/rate-limiting to the public review form to reduce bot/spam submissions.

## Replace demo images
Replace the SVG files in `images/` with the client's own images, or change the `<img src="...">` paths in `index.html`.

## Contact details currently used
- Dharmesh Tank: +91 96010 86200
- Vivek Chauhan: +91 99986 13796
- Linktree: https://linktr.ee/stardjsoundkukma
- Location: Kukma, Kutch, Gujarat

## Local development
Use VS Code + Live Server (recommended). Then open `index.html` for the public website and `admin.html` for the owner dashboard.

## Latest UI update
- The Home-page **BOOK YOUR EVENT** button opens a booking popup with Dharmesh Tank and Vivek Chauhan's phone numbers plus WhatsApp.
- Header now contains HOME and CONTACTS, with BOOK NOW removed.
- The services ticker is a continuous seamless loop.
