-- =============================================================================
-- Payment state changes. These functions are executable ONLY by the
-- service_role, which is used exclusively by server-side code after a
-- payment provider response has been cryptographically verified
-- (src/lib/payments). End users can never mark an order paid or refunded.
-- =============================================================================

-- Applies a verified successful payment. Idempotent: repeated calls (e.g.
-- the client callback and the webhook both arriving) are no-ops.
create or replace function public.apply_payment_success(p_payment_id uuid, p_provider_payment_id text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.payments;
  v_order public.orders;
begin
  select * into v_payment from public.payments where id = p_payment_id for update;
  if not found then
    raise exception 'Payment not found' using errcode = 'P0002';
  end if;
  if v_payment.status in ('succeeded', 'refunded') then
    return 'already_applied';
  end if;

  update public.payments set
    status = 'succeeded',
    provider_payment_id = coalesce(p_provider_payment_id, provider_payment_id),
    failure_reason = null,
    verified_at = now()
  where id = v_payment.id;

  select * into v_order from public.orders where id = v_payment.order_id for update;

  if v_order.status = 'pending_payment' then
    perform public.apply_order_transition(
      v_order.id, 'system', 'mark_paid', null,
      jsonb_build_object('payment_id', v_payment.id, 'provider', v_payment.provider)
    );
    return 'applied';
  elsif v_order.status = 'cancelled' then
    -- Money arrived for an order that was already cancelled: refund it.
    perform public.apply_order_transition(
      v_order.id, 'system', 'late_payment', null,
      jsonb_build_object('payment_id', v_payment.id, 'note', 'Payment received after cancellation')
    );
    return 'late_payment_refund';
  end if;

  -- The order already moved on (e.g. a second successful attempt). Record a
  -- refund so the duplicate charge is returned.
  if exists (
    select 1 from public.payments
    where order_id = v_order.id and status = 'succeeded' and id <> v_payment.id
  ) then
    insert into public.refunds (payment_id, order_id, amount_minor, currency, status, reason)
    values (v_payment.id, v_order.id, v_payment.amount_minor, v_payment.currency, 'pending', 'Duplicate payment');
    return 'duplicate_refund';
  end if;
  return 'applied';
end;
$$;

create or replace function public.apply_payment_failure(p_payment_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.payments;
begin
  select * into v_payment from public.payments where id = p_payment_id for update;
  if not found then
    raise exception 'Payment not found' using errcode = 'P0002';
  end if;
  -- Never downgrade a verified success.
  if v_payment.status <> 'created' then
    return;
  end if;
  update public.payments set status = 'failed', failure_reason = left(p_reason, 500) where id = v_payment.id;
  insert into public.order_events (order_id, event_type, metadata)
    values (v_payment.order_id, 'payment_failed', jsonb_build_object('payment_id', v_payment.id, 'reason', left(p_reason, 200)));
end;
$$;

create or replace function public.mark_refund_processing(p_refund_id uuid, p_provider_refund_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.refunds set
    status = 'processing',
    provider_refund_id = coalesce(p_provider_refund_id, provider_refund_id)
  where id = p_refund_id and status in ('pending', 'failed');
end;
$$;

-- Applies a provider-confirmed refund. Idempotent.
create or replace function public.apply_refund_success(p_refund_id uuid, p_provider_refund_id text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_refund public.refunds;
  v_order public.orders;
begin
  select * into v_refund from public.refunds where id = p_refund_id for update;
  if not found then
    raise exception 'Refund not found' using errcode = 'P0002';
  end if;
  if v_refund.status = 'succeeded' then
    return 'already_applied';
  end if;

  update public.refunds set
    status = 'succeeded',
    provider_refund_id = coalesce(p_provider_refund_id, provider_refund_id),
    failure_reason = null,
    processed_at = now()
  where id = v_refund.id;

  update public.payments set status = 'refunded' where id = v_refund.payment_id;

  select * into v_order from public.orders where id = v_refund.order_id for update;
  if v_order.status = 'refund_pending' then
    perform public.apply_order_transition(
      v_order.id, 'system', 'mark_refunded', null,
      jsonb_build_object('refund_id', v_refund.id)
    );
  end if;
  return 'applied';
end;
$$;

create or replace function public.apply_refund_failure(p_refund_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.refunds set status = 'failed', failure_reason = left(p_reason, 500)
  where id = p_refund_id and status in ('pending', 'processing');
end;
$$;

revoke execute on function public.apply_payment_success(uuid, text) from public, anon, authenticated;
revoke execute on function public.apply_payment_failure(uuid, text) from public, anon, authenticated;
revoke execute on function public.mark_refund_processing(uuid, text) from public, anon, authenticated;
revoke execute on function public.apply_refund_success(uuid, text) from public, anon, authenticated;
revoke execute on function public.apply_refund_failure(uuid, text) from public, anon, authenticated;
grant execute on function public.apply_payment_success(uuid, text) to service_role;
grant execute on function public.apply_payment_failure(uuid, text) to service_role;
grant execute on function public.mark_refund_processing(uuid, text) to service_role;
grant execute on function public.apply_refund_success(uuid, text) to service_role;
grant execute on function public.apply_refund_failure(uuid, text) to service_role;

-- Specialist payouts are settled outside the platform until a
-- provider-supported, legally reviewed settlement flow (e.g. Razorpay Route)
-- is configured. Admins record the settlement reference here.
create or replace function public.admin_mark_payout(p_order_id uuid, p_reference text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
begin
  if not public.is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if coalesce(char_length(trim(p_reference)), 0) < 3 then
    raise exception 'Enter the settlement reference' using errcode = '23514';
  end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Order not found' using errcode = 'P0002';
  end if;
  if v_order.status <> 'completed' or v_order.payout_status <> 'pending' then
    raise exception 'Only completed orders with a pending payout can be marked as paid out' using errcode = '23514';
  end if;

  update public.orders set payout_status = 'paid_out', payout_reference = left(trim(p_reference), 200)
  where id = v_order.id;

  insert into public.order_events (order_id, actor_id, event_type, metadata)
    values (v_order.id, auth.uid(), 'payout_marked', jsonb_build_object('reference', left(trim(p_reference), 200)));
  insert into public.admin_actions (admin_id, action, target_type, target_id, reason)
    values (auth.uid(), 'mark_payout', 'order', v_order.id, left(trim(p_reference), 200));
end;
$$;
