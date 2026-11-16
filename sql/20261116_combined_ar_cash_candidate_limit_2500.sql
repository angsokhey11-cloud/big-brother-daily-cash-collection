-- Combined Sales/AR picker: show current authorized receivables across all locations, up to safety limit.
CREATE OR REPLACE FUNCTION public.bb_sales_support_ar_cash_candidates_v1()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_rows jsonb;
begin
 if not public.bb_is_active_user() or
    not (public.bb_is_admin() or public.bb_has_module_access('accounts_receivable','create')) then
   raise exception 'Receivable request access required';
 end if;
 select coalesce(jsonb_agg(to_jsonb(z) order by z."invoiceDate",z."invoiceNo",z."invoiceId"),'[]'::jsonb)
 into v_rows from (
   select i.invoice_id as "invoiceId",i.invoice_no as "invoiceNo",i.invoice_date as "invoiceDate",
     i.customer_id as "customerId",i.customer_name_snapshot as "customer",
     i.location_code as "locationCode",
     coalesce(l.location_name,i.location_code,'') as "locationName",
     i.salesperson_staff_id as "salespersonStaffId",
     i.salesperson_name_snapshot as "salesperson",
     upper(coalesce(i.currency,'USD')) as currency,
     i.exchange_rate as "exchangeRate",i.outstanding as outstanding,
     i.payment_method as "paymentMethod"
   from public.invoices i
   left join public.locations l on l.location_code=i.location_code
   where i.outstanding>0.000001
     and lower(trim(coalesce(i.payment_method,''))) in ('credit','partially paid in cash','partially paid in bank')
     and (public.bb_is_admin() or public.bb_has_module_access('route.ar-all','create')
          or private.bb_is_current_receivable_owner(coalesce(i.location_code,'')))
     and not exists(
       select 1 from public.ar_request_allocations a
       join public.ar_payment_requests r on r.request_id=a.request_id
       where a.invoice_id=i.invoice_id and lower(coalesce(r.status,''))='processing'
     )
   order by i.invoice_date,i.invoice_no,i.invoice_id
   limit 2500
 ) z;
 return jsonb_build_object('success',true,'invoices',v_rows,'count',jsonb_array_length(v_rows),
   'note','Open receivable invoices not yet in Processing requests. No payment is registered by selection.');
end;
$function$
;
