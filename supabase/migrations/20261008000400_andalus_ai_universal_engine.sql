-- Andalus AI Universal Read-Only Engine
-- Safe structured access only. No arbitrary SQL is exposed to the model.

create or replace function public.ai_schema()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
    'table', c.table_name,
    'column', c.column_name,
    'type', c.data_type,
    'nullable', c.is_nullable = 'YES'
  ) order by c.table_name, c.ordinal_position), '[]'::jsonb)
  into result
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name not like 'pg_%'
    and c.table_name not like 'supabase_%';

  return result;
end;
$$;

create or replace function public.ai_read(
  p_table text,
  p_columns jsonb default '[]'::jsonb,
  p_filters jsonb default '[]'::jsonb,
  p_order_by text default null,
  p_order_desc boolean default false,
  p_limit integer default 100
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  cols text;
  sql text;
  f jsonb;
  op text;
  col text;
  val jsonb;
  where_sql text := '';
  order_sql text := '';
  result jsonb;
  lim integer := greatest(1, least(coalesce(p_limit,100), 500));
begin
  if not exists (
    select 1 from information_schema.tables
    where table_schema='public' and table_name=p_table and table_type='BASE TABLE'
  ) then raise exception 'Unknown table'; end if;

  if jsonb_typeof(p_columns)='array' and jsonb_array_length(p_columns)>0 then
    select string_agg(format('%I', x), ', ')
      into cols from jsonb_array_elements_text(p_columns) x;
  else
    select string_agg(format('%I', column_name), ', ' order by ordinal_position)
      into cols from information_schema.columns
      where table_schema='public' and table_name=p_table;
  end if;

  if cols is null or cols='' then raise exception 'No valid columns'; end if;

  -- Validate requested columns against the actual table.
  if exists (
    select 1 from jsonb_array_elements_text(case when jsonb_typeof(p_columns)='array' then p_columns else '[]'::jsonb end) x
    where not exists (
      select 1 from information_schema.columns c
      where c.table_schema='public' and c.table_name=p_table and c.column_name=x
    )
  ) then raise exception 'One or more requested columns do not exist'; end if;

  if jsonb_typeof(p_filters)='array' then
    for f in select value from jsonb_array_elements(p_filters) loop
      col := f->>'column'; op := lower(coalesce(f->>'operator','eq')); val := f->'value';
      if not exists (select 1 from information_schema.columns c where c.table_schema='public' and c.table_name=p_table and c.column_name=col) then
        raise exception 'Unknown filter column';
      end if;
      if op='is_null' then
        where_sql := where_sql || case when where_sql='' then ' where ' else ' and ' end || format('%I is null',col);
      elsif op='not_null' then
        where_sql := where_sql || case when where_sql='' then ' where ' else ' and ' end || format('%I is not null',col);
      elsif op in ('eq','neq','gt','gte','lt','lte','ilike') then
        where_sql := where_sql || case when where_sql='' then ' where ' else ' and ' end || format('%I %s %L', col,
          case op when 'eq' then '=' when 'neq' then '<>' when 'gt' then '>' when 'gte' then '>=' when 'lt' then '<' when 'lte' then '<=' when 'ilike' then 'ilike' end,
          trim(both '"' from val::text));
      elsif op='in' and jsonb_typeof(val)='array' then
        where_sql := where_sql || case when where_sql='' then ' where ' else ' and ' end || format('%I in (%s)', col,
          (select string_agg(format('%L', trim(both '"' from z::text)), ',') from jsonb_array_elements(val) z));
      else raise exception 'Unsupported filter operator'; end if;
    end loop;
  end if;

  if p_order_by is not null and p_order_by<>'' then
    if not exists (select 1 from information_schema.columns c where c.table_schema='public' and c.table_name=p_table and c.column_name=p_order_by) then
      raise exception 'Unknown order column';
    end if;
    order_sql := format(' order by %I %s', p_order_by, case when p_order_desc then 'desc' else 'asc' end);
  end if;

  sql := format('select coalesce(jsonb_agg(to_jsonb(q)), ''[]''::jsonb) from (select %s from public.%I%s%s limit %s) q', cols, p_table, where_sql, order_sql, lim);
  execute sql into result;
  return coalesce(result,'[]'::jsonb);
end;
$$;

create or replace function public.ai_aggregate(
  p_table text,
  p_group_by jsonb default '[]'::jsonb,
  p_measure_column text default null,
  p_operation text default 'count',
  p_filters jsonb default '[]'::jsonb,
  p_limit integer default 100
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  groups text := '';
  sql text;
  result jsonb;
  op text := lower(coalesce(p_operation,'count'));
  lim integer := greatest(1, least(coalesce(p_limit,100), 500));
  f jsonb; col text; val jsonb; where_sql text := ''; fo text;
begin
  if not exists (select 1 from information_schema.tables where table_schema='public' and table_name=p_table and table_type='BASE TABLE') then raise exception 'Unknown table'; end if;
  if op not in ('count','sum','avg','min','max') then raise exception 'Unsupported aggregate'; end if;

  if jsonb_typeof(p_group_by)='array' and jsonb_array_length(p_group_by)>0 then
    select string_agg(format('%I', x), ', ') into groups from jsonb_array_elements_text(p_group_by) x;
    if exists (select 1 from jsonb_array_elements_text(p_group_by) x where not exists (select 1 from information_schema.columns c where c.table_schema='public' and c.table_name=p_table and c.column_name=x)) then raise exception 'Unknown group column'; end if;
  end if;

  if p_measure_column is not null and p_measure_column<>'' and not exists (select 1 from information_schema.columns c where c.table_schema='public' and c.table_name=p_table and c.column_name=p_measure_column) then raise exception 'Unknown measure column'; end if;

  if jsonb_typeof(p_filters)='array' then
    for f in select value from jsonb_array_elements(p_filters) loop
      col:=f->>'column'; fo:=lower(coalesce(f->>'operator','eq')); val:=f->'value';
      if not exists (select 1 from information_schema.columns c where c.table_schema='public' and c.table_name=p_table and c.column_name=col) then raise exception 'Unknown filter column'; end if;
      if fo='is_null' then where_sql:=where_sql||case when where_sql='' then ' where ' else ' and ' end||format('%I is null',col);
      elsif fo='not_null' then where_sql:=where_sql||case when where_sql='' then ' where ' else ' and ' end||format('%I is not null',col);
      elsif fo in ('eq','neq','gt','gte','lt','lte','ilike') then
        where_sql:=where_sql||case when where_sql='' then ' where ' else ' and ' end||format('%I %s %L',col,case fo when 'eq' then '=' when 'neq' then '<>' when 'gt' then '>' when 'gte' then '>=' when 'lt' then '<' when 'lte' then '<=' when 'ilike' then 'ilike' end,trim(both '"' from val::text));
      elsif fo='in' and jsonb_typeof(val)='array' then
        where_sql:=where_sql||case when where_sql='' then ' where ' else ' and ' end||format('%I in (%s)',col,(select string_agg(format('%L',trim(both '"' from z::text)),',') from jsonb_array_elements(val) z));
      else raise exception 'Unsupported filter operator'; end if;
    end loop;
  end if;

  if op='count' then
    sql:=format('select coalesce(jsonb_agg(to_jsonb(q)),''[]''::jsonb) from (select %s%s count(*) as value from public.%I%s group by %s order by value desc limit %s) q',case when groups<>'' then groups||', ' else '' end,case when groups='' then '' else '' end,p_table,where_sql,case when groups='' then '1' else groups end,lim);
  else
    if p_measure_column is null or p_measure_column='' then raise exception 'Measure column required'; end if;
    sql:=format('select coalesce(jsonb_agg(to_jsonb(q)),''[]''::jsonb) from (select %s%s(%s(%I)) as value from public.%I%s group by %s order by value desc limit %s) q',case when groups<>'' then groups||', ' else '' end, '',op,p_measure_column,p_table,where_sql,case when groups='' then '1' else groups end,lim);
  end if;
  execute sql into result;
  return coalesce(result,'[]'::jsonb);
end;
$$;

revoke all on function public.ai_schema() from public, anon, authenticated;
revoke all on function public.ai_read(text,jsonb,jsonb,text,boolean,integer) from public, anon, authenticated;
revoke all on function public.ai_aggregate(text,jsonb,text,text,jsonb,integer) from public, anon, authenticated;
grant execute on function public.ai_schema() to service_role;
grant execute on function public.ai_read(text,jsonb,jsonb,text,boolean,integer) to service_role;
grant execute on function public.ai_aggregate(text,jsonb,text,text,jsonb,integer) to service_role;
