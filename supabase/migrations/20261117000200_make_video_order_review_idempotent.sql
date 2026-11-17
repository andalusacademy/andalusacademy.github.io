-- Make repeated admin approval safe: do not restart the same paid order's access window.
create or replace function public.admin_review_academy_video_order(
  p_order_id uuid,p_status text,p_reason text default null
) returns jsonb
language plpgsql security definer set search_path=public
as $$
declare
  v_order public.academy_video_orders%rowtype;
  v_video public.academy_videos%rowtype;
  v_expiry timestamptz;
  v_entitlement_id uuid;
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'غير مصرح' using errcode='42501'; end if;
  if p_status not in ('paid','rejected','cancelled','pending_payment') then raise exception 'حالة غير صالحة'; end if;
  select * into v_order from public.academy_video_orders where id=p_order_id for update;
  if not found then raise exception 'طلب الشراء غير موجود'; end if;
  if v_order.status='paid' and p_status='paid' then return jsonb_build_object('ok',true,'status','paid','already_processed',true); end if;
  update public.academy_video_orders set status=p_status,reviewed_by=auth.uid(),reviewed_at=now(),
    reviewed_reason=nullif(btrim(coalesce(p_reason,'')),''),updated_at=now() where id=p_order_id;
  if p_status<>'paid' then return jsonb_build_object('ok',true,'status',p_status); end if;
  select * into v_video from public.academy_videos where id=v_order.video_id and deleted_at is null;
  if not found then raise exception 'الفيديو غير موجود'; end if;
  v_expiry:=case when v_video.validity_days>=36500 then null else now()+make_interval(days=>v_video.validity_days) end;
  select id into v_entitlement_id from public.academy_video_entitlements where student_id=v_order.student_id and video_id=v_order.video_id
    order by (revoked_at is null) desc,created_at desc limit 1 for update;
  if v_entitlement_id is null then
    insert into public.academy_video_entitlements(student_id,video_id,order_id,starts_at,expires_at)
    values(v_order.student_id,v_order.video_id,v_order.id,now(),v_expiry);
  else
    update public.academy_video_entitlements set order_id=v_order.id,starts_at=now(),expires_at=v_expiry,revoked_at=null where id=v_entitlement_id;
  end if;
  return jsonb_build_object('ok',true,'status','paid','expires_at',v_expiry);
end; $$;
revoke all on function public.admin_review_academy_video_order(uuid,text,text) from public,anon;
grant execute on function public.admin_review_academy_video_order(uuid,text,text) to authenticated;
