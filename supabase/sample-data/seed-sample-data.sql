-- ============================================================================
-- Workido: TEMPORARY sample data for testing a hosted project
-- ============================================================================
--
-- What it creates (every profile is flagged is_sample and shows a "Sample"
-- badge; every email uses the reserved, undeliverable sample.workido.test
-- domain):
--
--   * test-buyer@sample.workido.test       a buyer account for you to log in with
--   * test-specialist@sample.workido.test  a specialist account for you to log in with
--   * six sample specialists with published services, two sample buyers
--   * orders between the two test accounts waiting on each side
--     (paid, in progress, submitted, completed), completed orders with
--     sample reviews, an open requirement with two offers, an invitation,
--     and pre-order chats (one answered, one waiting for the specialist)
--
-- Requires every migration up to 20261010000300_enquiries.sql.
--
-- How to run:
--   1. Replace CHANGE-ME-BEFORE-RUNNING below with a password (10+ characters).
--      Every sample account uses it.
--   2. Paste the whole file into Supabase -> SQL Editor and click Run.
--      It runs as one transaction: on any error nothing is created.
--
-- How to remove it: run supabase/sample-data/remove-sample-data.sql.
--
-- Orders are created and moved through the same database functions the app
-- uses. Payments are recorded as test-mode ("dev") payments, so order pages
-- say "via test mode". No real money is involved and no emails are sent.
-- ============================================================================

do $seed$
declare
  v_password constant text := 'CHANGE-ME-BEFORE-RUNNING';
  v_domain constant text := 'sample.workido.test';

  v_users constant jsonb := $json$[
    {"key": "tb", "handle": "sample-test-buyer", "email": "test-buyer", "name": "Test Buyer", "role": "buyer"},
    {"key": "ts", "handle": "sample-test-specialist", "email": "test-specialist", "name": "Test Specialist", "role": "specialist",
     "headline": "Brand and social media designer (test account)",
     "bio": "Sample profile for testing Workido. Designs Instagram posts, carousels and simple brand kits for small businesses, working from your references and brand guidelines.",
     "experience": "intermediate", "years": 3, "availability": "available", "verified": true,
     "skills": ["social-media-creatives", "instagram-carousels", "canva", "brand-identity"],
     "categories": ["graphic-design"],
     "services": [
       {"title": "Instagram post design (set of 3)", "category": "social-media-creatives", "price": 900, "hours": 48, "revisions": 1,
        "description": "Sample listing for testing. Three on-brand static Instagram posts designed from your copy, logo and colours.",
        "deliverables": "3 static posts (1080x1350 PNG) plus editable Canva links.",
        "instructions": "Share your copy, logo, brand colours and one or two posts you like."},
       {"title": "Simple brand kit: logo refresh, colours and fonts", "category": "graphic-design", "price": 2500, "hours": 96, "revisions": 2,
        "description": "Sample listing for testing. A light refresh of your existing logo with a matching colour palette and font pairing.",
        "deliverables": "Refreshed logo (PNG and SVG), colour palette and font guide (PDF).",
        "instructions": "Upload your current logo and tell me about your audience."}
     ]},
    {"key": "aarav", "handle": "sample-aarav-designs", "email": "sample-aarav-designs", "name": "Aarav Mehta", "role": "specialist",
     "headline": "Social media designer for D2C and lifestyle brands",
     "bio": "Fictional sample profile. Designs scroll-stopping Instagram carousels, story sets and ad creatives that stay on brand. Works from your brand kit and references.",
     "experience": "intermediate", "years": 4, "availability": "available", "verified": true,
     "skills": ["instagram-carousels", "social-media-creatives", "canva", "adobe-photoshop"],
     "categories": ["graphic-design"],
     "services": [
       {"title": "Instagram carousel design", "category": "social-media-creatives", "price": 1500, "hours": 48, "revisions": 1,
        "description": "A polished Instagram carousel of up to eight slides, designed around your message and brand guidelines. Great for launches, explainers and educational posts.",
        "deliverables": "One carousel with up to 8 slides (1080x1350 PNG) plus editable source file.",
        "instructions": "Share your copy (or key points), brand colours/fonts, logo and any reference posts you like."},
       {"title": "YouTube thumbnail design (set of 3)", "category": "thumbnails", "price": 1200, "hours": 24, "revisions": 2,
        "description": "Three bold, high-contrast thumbnail options for a single video, optimised to stay readable at small sizes on mobile.",
        "deliverables": "3 thumbnail concepts (1280x720 PNG); final chosen design in source format."}
     ]},
    {"key": "kavya", "handle": "sample-kavya-edits", "email": "sample-kavya-edits", "name": "Kavya Iyer", "role": "specialist",
     "headline": "Short-form video editor for Reels and Shorts",
     "bio": "Fictional sample profile. Turns raw footage into punchy short-form edits with captions, pacing and hooks designed for retention on Reels and Shorts.",
     "experience": "expert", "years": 6, "availability": "available", "verified": false,
     "skills": ["short-form-video-editing", "subtitles-captions", "adobe-premiere-pro", "motion-graphics"],
     "categories": ["video-editing"],
     "services": [
       {"title": "Short-form video editing (Reels / Shorts)", "category": "short-form-video", "price": 2000, "hours": 72, "revisions": 2,
        "description": "Edit up to 60 seconds of vertical video with hook-first pacing, burned-in captions, music and simple motion text.",
        "deliverables": "One 9:16 MP4 up to 60 seconds with captions; project file on request.",
        "instructions": "Upload raw clips (or a drive link), your script or talking points and any brand fonts."}
     ]},
    {"key": "rohan", "handle": "sample-rohan-ads", "email": "sample-rohan-ads", "name": "Rohan Kapoor", "role": "specialist",
     "headline": "Performance marketer: Google & Meta Ads",
     "bio": "Fictional sample profile. Sets up and audits paid campaigns for small businesses, with clear reports and practical next steps rather than jargon.",
     "experience": "expert", "years": 8, "availability": "busy", "verified": true,
     "skills": ["meta-ads", "google-ads", "ad-account-audits", "conversion-tracking"],
     "categories": ["performance-marketing"],
     "services": [
       {"title": "Meta Ads account audit", "category": "meta-ads", "price": 4000, "hours": 72, "revisions": 1,
        "description": "A structured audit of your Meta Ads account covering campaign structure, audiences, creatives, tracking and budget allocation, with prioritised fixes.",
        "deliverables": "Audit report (PDF) with findings, priority list and a 30-minute walkthrough call.",
        "instructions": "Grant analyst access to your ad account and share your main business goal."},
       {"title": "Google Ads search campaign setup", "category": "google-ads", "price": 6000, "hours": 96, "revisions": 1,
        "description": "Keyword research, ad groups, responsive search ads and conversion tracking for one search campaign, ready to launch.",
        "deliverables": "One live-ready search campaign with up to 3 ad groups and setup notes."}
     ]},
    {"key": "meera", "handle": "sample-meera-writes", "email": "sample-meera-writes", "name": "Meera Nair", "role": "specialist",
     "headline": "Conversion copywriter for landing pages",
     "bio": "Fictional sample profile. Writes clear, benefit-led landing page copy and LinkedIn posts for SaaS and service businesses.",
     "experience": "intermediate", "years": 3, "availability": "available", "verified": false,
     "skills": ["landing-page-copywriting", "linkedin-content", "ad-copywriting"],
     "categories": ["content-writing"],
     "services": [
       {"title": "Landing-page copywriting", "category": "content-writing", "price": 3500, "hours": 72, "revisions": 2,
        "description": "Complete copy for one landing page: hero, benefits, social proof prompts, FAQs and calls to action, written for your audience.",
        "deliverables": "Copy document for one landing page (up to 800 words) with headline options.",
        "instructions": "Share your product, audience, offer and any existing copy or competitors you admire."}
     ]},
    {"key": "dev", "handle": "sample-dev-analytics", "email": "sample-dev-analytics", "name": "Dev Sharma", "role": "specialist",
     "headline": "GA4 & Google Tag Manager specialist",
     "bio": "Fictional sample profile. Fixes broken tracking, configures GA4 events and conversions, and documents everything so your team can maintain it.",
     "experience": "expert", "years": 7, "availability": "available", "verified": false,
     "skills": ["ga4-configuration", "google-tag-manager", "conversion-tracking", "looker-studio"],
     "categories": ["analytics-tracking"],
     "services": [
       {"title": "GA4 event configuration", "category": "analytics-tracking", "price": 3000, "hours": 48, "revisions": 1,
        "description": "Configure up to 10 GA4 events and key conversions through Google Tag Manager, tested in preview mode and documented.",
        "deliverables": "Configured GTM container, GA4 events/conversions and a tracking plan document.",
        "instructions": "Provide GTM and GA4 access plus the actions you want to track."}
     ]},
    {"key": "isha", "handle": "sample-isha-decks", "email": "sample-isha-decks", "name": "Isha Verma", "role": "specialist",
     "headline": "Presentation designer for pitch and sales decks",
     "bio": "Fictional sample profile. Turns dense content into clean, persuasive slides for investor pitches and sales conversations.",
     "experience": "intermediate", "years": 2, "availability": "unavailable", "verified": false,
     "skills": ["pitch-deck-design", "powerpoint", "google-slides"],
     "categories": ["presentations"],
     "services": [
       {"title": "Presentation design (up to 12 slides)", "category": "presentations", "price": 2500, "hours": 72, "revisions": 2,
        "description": "Redesign up to 12 slides into a consistent, on-brand deck with clear hierarchy, charts and icons.",
        "deliverables": "Up to 12 designed slides in PowerPoint or Google Slides plus PDF export."}
     ]},
    {"key": "nisha", "handle": "sample-buyer-nisha", "email": "sample-buyer-nisha", "name": "Nisha Rao", "role": "buyer"},
    {"key": "arjun", "handle": "sample-buyer-arjun", "email": "sample-buyer-arjun", "name": "Arjun Das", "role": "buyer"}
  ]$json$;

  -- Orders, oldest first. "state" is where the order is left.
  v_orders constant jsonb := $json$[
    {"buyer": "nisha", "specialist": "ts", "service": "Instagram post design (set of 3)", "state": "completed", "rating": 5,
     "brief": "Sample order: three posts announcing our weekend sale.",
     "comment": "Sample review: quick turnaround and the posts matched our brand colours."},
    {"buyer": "tb", "specialist": "aarav", "service": "Instagram carousel design", "state": "completed", "rating": 5,
     "brief": "Sample order: an 8-slide carousel explaining our new product range.",
     "comment": "Sample review: clear communication and the carousel matched our brand perfectly."},
    {"buyer": "arjun", "specialist": "aarav", "service": "Instagram carousel design", "state": "completed", "rating": 4,
     "brief": "Sample order: a carousel for our festive offer.",
     "comment": "Sample review: good work, one round of tweaks and done."},
    {"buyer": "nisha", "specialist": "dev", "service": "GA4 event configuration", "state": "completed", "rating": 5,
     "brief": "Sample order: set up purchase and sign-up conversions in GA4.",
     "comment": "Sample review: our GA4 conversions finally fire correctly."},
    {"buyer": "tb", "specialist": "ts", "service": "Simple brand kit: logo refresh, colours and fonts", "state": "completed",
     "brief": "Sample order: refresh our bakery logo and pick a warm colour palette."},
    {"buyer": "tb", "specialist": "ts", "service": "Instagram post design (set of 3)", "state": "submitted",
     "brief": "Sample order: three posts for our monsoon menu launch."},
    {"buyer": "tb", "specialist": "ts", "service": "Simple brand kit: logo refresh, colours and fonts", "state": "in_progress",
     "brief": "Sample order: brand kit for a new coffee cart, friendly and modern.",
     "message_from": "tb", "message": "Sample message: I've added our current logo sketch. Happy to answer any questions!"},
    {"buyer": "tb", "specialist": "kavya", "service": "Short-form video editing (Reels / Shorts)", "state": "in_progress",
     "brief": "Sample order: a 45-second Reel from our cafe opening footage.",
     "message_from": "kavya", "message": "Sample message: footage received, first cut coming tomorrow."},
    {"buyer": "tb", "specialist": "ts", "service": "Instagram post design (set of 3)", "state": "paid",
     "brief": "Sample order: three posts introducing our new loyalty card."}
  ]$json$;

  v_ids jsonb := '{}';
  v_user jsonb;
  v_item jsonb;
  v_uid uuid;
  v_email text;
  v_category uuid;
  v_skill uuid;
  v_n integer;
  v_service uuid;
  v_buyer uuid;
  v_specialist uuid;
  v_order uuid;
  v_payment uuid;
  v_conversation uuid;
  v_requirement uuid;
begin
  if v_password = 'CHANGE-ME-BEFORE-RUNNING' or char_length(v_password) < 10 then
    raise exception 'Set v_password at the top of this script to a password of at least 10 characters.';
  end if;
  if exists (select 1 from auth.users where email like '%@' || v_domain) then
    raise exception 'Sample data already exists. Run remove-sample-data.sql first if you want to recreate it.';
  end if;
  if not exists (select 1 from public.categories) then
    raise exception 'Categories are missing. Apply all migrations before seeding.';
  end if;

  -- 1. Accounts ---------------------------------------------------------------
  for v_user in select * from jsonb_array_elements(v_users) loop
    v_uid := gen_random_uuid();
    v_email := (v_user ->> 'email') || '@' || v_domain;

    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated', v_email,
      extensions.crypt(v_password, extensions.gen_salt('bf')), now(),
      '{"provider": "email", "providers": ["email"]}',
      jsonb_build_object('full_name', v_user ->> 'name', 'initial_role', v_user ->> 'role'),
      now(), now(), '', '', '', ''
    );
    insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (
      v_uid::text, v_uid,
      jsonb_build_object('sub', v_uid::text, 'email', v_email, 'email_verified', true, 'phone_verified', false),
      'email', now(), now(), now()
    );

    -- handle_new_user() has created the profile, settings and role.
    update public.profiles
      set username = v_user ->> 'handle', is_sample = true, city = 'Sample City', country_code = 'IN'
      where id = v_uid;
    update public.user_settings set email_notifications = false, marketing_emails = false where user_id = v_uid;

    v_ids := v_ids || jsonb_build_object(v_user ->> 'key', v_uid);
  end loop;

  -- 2. Specialist profiles, portfolio, services, verification ---------------
  for v_user in select * from jsonb_array_elements(v_users) where value ->> 'role' = 'specialist' loop
    v_uid := (v_ids ->> (v_user ->> 'key'))::uuid;
    perform set_config('request.jwt.claims', jsonb_build_object('sub', v_uid, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', v_uid::text, true);

    insert into public.specialist_skills (specialist_id, skill_id)
      select v_uid, s.id from public.skills s
      where s.slug in (select jsonb_array_elements_text(v_user -> 'skills'));
    insert into public.specialist_categories (specialist_id, category_id)
      select v_uid, c.id from public.categories c
      where c.slug in (select jsonb_array_elements_text(v_user -> 'categories'));

    update public.specialist_profiles set
      headline = v_user ->> 'headline',
      professional_bio = v_user ->> 'bio',
      experience_level = (v_user ->> 'experience')::public.experience_level,
      years_experience = (v_user ->> 'years')::smallint,
      availability_status = (v_user ->> 'availability')::public.availability_status,
      is_published = true
    where user_id = v_uid;

    select id into v_category from public.categories where slug = v_user -> 'categories' ->> 0;
    for v_n in 1..2 loop
      insert into public.portfolio_items (specialist_id, title, description, category_id, external_url, sort_order)
      values (v_uid, 'Sample project ' || v_n, 'Placeholder link for testing. Not real client work.', v_category,
              'https://example.com/sample-portfolio/' || (v_user ->> 'handle') || '-' || v_n, v_n - 1);
    end loop;

    for v_item in select * from jsonb_array_elements(v_user -> 'services') loop
      select id into strict v_category from public.categories where slug = v_item ->> 'category';
      insert into public.services (
        specialist_id, category_id, title, description, deliverables, buyer_instructions,
        price_minor, delivery_time_hours, included_revisions, publication_status
      ) values (
        v_uid, v_category, v_item ->> 'title', v_item ->> 'description', v_item ->> 'deliverables', v_item ->> 'instructions',
        (v_item ->> 'price')::bigint * 100, (v_item ->> 'hours')::integer, (v_item ->> 'revisions')::smallint, 'published'
      );
    end loop;

    if (v_user ->> 'verified')::boolean then
      perform public.submit_verification_request('Sample verification request.');
      -- Same effect as admin approval (admin_review_verification), done
      -- directly because the sample data has no administrator.
      update public.verification_requests
        set status = 'verified', decision_note = 'Sample approval.', reviewed_at = now()
        where specialist_id = v_uid and status = 'pending';
      update public.specialist_profiles set verification_status = 'verified' where user_id = v_uid;
    end if;
  end loop;

  -- 3. Orders ------------------------------------------------------------------
  for v_item in select * from jsonb_array_elements(v_orders) loop
    v_buyer := (v_ids ->> (v_item ->> 'buyer'))::uuid;
    v_specialist := (v_ids ->> (v_item ->> 'specialist'))::uuid;
    select id into strict v_service from public.services
      where specialist_id = v_specialist and title = v_item ->> 'service';

    -- Buyer places the order (price and scope are snapshotted by the database).
    perform set_config('request.jwt.claims', jsonb_build_object('sub', v_buyer, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', v_buyer::text, true);
    v_order := public.create_service_order(v_service, v_item ->> 'brief');

    -- Test-mode payment, confirmed through the same function webhooks use.
    insert into public.payments (order_id, provider, provider_order_id, amount_minor, currency, idempotency_key)
      select o.id, 'dev', 'sample_order_' || o.id, o.total_minor, o.currency, 'sample-' || o.id
      from public.orders o where o.id = v_order
      returning id into v_payment;
    perform public.apply_payment_success(v_payment, 'sample_pay_' || v_payment);

    if v_item ->> 'state' <> 'paid' then
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_specialist, 'role', 'authenticated')::text, true);
      perform set_config('request.jwt.claim.sub', v_specialist::text, true);
      perform public.perform_order_action(v_order, 'accept');

      if v_item ->> 'state' in ('submitted', 'completed') then
        insert into public.order_deliverables (order_id, uploaded_by, kind, external_url, filename)
          values (v_order, v_specialist, 'link', 'https://example.com/sample-deliverable', 'Sample deliverable link');
        perform public.perform_order_action(v_order, 'submit', 'Sample delivery: everything is in the linked folder. Let me know if you need changes.');
      end if;

      if v_item ->> 'state' = 'completed' then
        perform set_config('request.jwt.claims', jsonb_build_object('sub', v_buyer, 'role', 'authenticated')::text, true);
        perform set_config('request.jwt.claim.sub', v_buyer::text, true);
        perform public.perform_order_action(v_order, 'approve');
        if v_item ? 'rating' then
          insert into public.reviews (order_id, reviewer_id, reviewee_id, rating, comment)
            values (v_order, v_buyer, v_specialist, (v_item ->> 'rating')::smallint, v_item ->> 'comment');
        end if;
      end if;
    end if;

    if v_item ? 'message' then
      v_uid := (v_ids ->> (v_item ->> 'message_from'))::uuid;
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_uid, 'role', 'authenticated')::text, true);
      perform set_config('request.jwt.claim.sub', v_uid::text, true);
      select id into strict v_conversation from public.conversations where order_id = v_order;
      insert into public.messages (conversation_id, sender_id, body) values (v_conversation, v_uid, v_item ->> 'message');
    end if;
  end loop;

  -- 4. Requirements, invitations and offers ------------------------------------
  -- Test Buyer's open task with offers from Test Specialist and Aarav to compare.
  v_buyer := (v_ids ->> 'tb')::uuid;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_buyer, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_buyer::text, true);
  insert into public.requirements (
    buyer_id, title, description, category_id, deliverables, quantity, revisions_expected,
    budget_min_minor, budget_max_minor, deadline_at, urgency, status
  ) values (
    v_buyer, 'Festive sale creatives for Instagram',
    'Sample requirement: three static posts and one carousel for a festive sale, following our existing brand kit.',
    (select id from public.categories where slug = 'graphic-design'),
    '3 static posts (1080x1350) and 1 carousel of up to 6 slides', 4, 1,
    300000, 600000, now() + interval '10 days', 'standard', 'open'
  ) returning id into v_requirement;
  insert into public.requirement_skills (requirement_id, skill_id, is_mandatory)
    select v_requirement, id, slug = 'social-media-creatives' from public.skills
    where slug in ('social-media-creatives', 'instagram-carousels');
  insert into public.requirement_invitations (requirement_id, specialist_id)
    values (v_requirement, (v_ids ->> 'ts')::uuid), (v_requirement, (v_ids ->> 'aarav')::uuid);

  for v_item in select * from jsonb_array_elements($json$[
    {"specialist": "ts", "price": 4500, "hours": 96, "revisions": 1,
     "message": "Sample offer: I can deliver all four creatives in four days from your brand kit, with one revision round."},
    {"specialist": "aarav", "price": 5200, "hours": 72, "revisions": 2,
     "message": "Sample offer: three days for all four creatives, two revision rounds included."}
  ]$json$) loop
    v_specialist := (v_ids ->> (v_item ->> 'specialist'))::uuid;
    perform set_config('request.jwt.claims', jsonb_build_object('sub', v_specialist, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', v_specialist::text, true);
    insert into public.offers (requirement_id, specialist_id, proposed_price_minor, delivery_time_hours, revisions_included, message)
      values (v_requirement, v_specialist, (v_item ->> 'price')::bigint * 100, (v_item ->> 'hours')::integer,
              (v_item ->> 'revisions')::smallint, v_item ->> 'message');
  end loop;

  -- Arjun's task inviting Test Specialist, who hasn't replied yet.
  v_buyer := (v_ids ->> 'arjun')::uuid;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_buyer, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_buyer::text, true);
  insert into public.requirements (
    buyer_id, title, description, category_id, deliverables, quantity, revisions_expected,
    budget_max_minor, deadline_at, urgency, status
  ) values (
    v_buyer, 'Logo touch-up and social media kit',
    'Sample requirement: tidy up our existing logo and create matching profile and cover images for Instagram and LinkedIn.',
    (select id from public.categories where slug = 'graphic-design'),
    'Refreshed logo files plus profile and cover images for two platforms', 1, 2,
    350000, now() + interval '14 days', 'standard', 'open'
  ) returning id into v_requirement;
  insert into public.requirement_skills (requirement_id, skill_id, is_mandatory)
    select v_requirement, id, false from public.skills where slug in ('brand-identity', 'social-media-creatives');
  insert into public.requirement_invitations (requirement_id, specialist_id) values (v_requirement, (v_ids ->> 'ts')::uuid);

  -- 5. Pre-order chats (after the orders, so they start clean) -----------------
  -- Test Buyer asking Test Specialist about a gig, with a reply.
  v_buyer := (v_ids ->> 'tb')::uuid;
  v_specialist := (v_ids ->> 'ts')::uuid;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_buyer, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_buyer::text, true);
  v_conversation := public.start_enquiry(v_specialist,
    (select id from public.services where specialist_id = v_specialist and title = 'Instagram post design (set of 3)'));
  insert into public.messages (conversation_id, sender_id, body)
    values (v_conversation, v_buyer, 'Sample message: hi! Could you also make story-sized versions of the posts?');
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_specialist, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_specialist::text, true);
  insert into public.messages (conversation_id, sender_id, body)
    values (v_conversation, v_specialist, 'Sample message: yes, I can add 9:16 versions. Order the gig and mention it in your requirements.');

  -- Nisha asking Test Specialist about the brand kit, waiting for a reply.
  v_buyer := (v_ids ->> 'nisha')::uuid;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_buyer, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_buyer::text, true);
  v_conversation := public.start_enquiry(v_specialist,
    (select id from public.services where specialist_id = v_specialist and title = 'Simple brand kit: logo refresh, colours and fonts'));
  insert into public.messages (conversation_id, sender_id, body)
    values (v_conversation, v_buyer, 'Sample message: hello! Do you work with hand-drawn logos? Ours is a sketch for a small bakery.');

  -- Test Buyer has saved one specialist.
  insert into public.saved_specialists (buyer_id, specialist_id) values ((v_ids ->> 'tb')::uuid, (v_ids ->> 'kavya')::uuid);

  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.jwt.claim.sub', '', true);
  raise notice 'Sample data created: % accounts. Log in as test-buyer@% or test-specialist@%.',
    jsonb_array_length(v_users), v_domain, v_domain;
end
$seed$;
