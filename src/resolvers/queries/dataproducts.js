import { log, logError } from '../../lib/log'

export default async (self, args, req) => {
  const { pool } = await req.ctx.db
  const result = await pool.query(`
  select
  id,
  title,
  publish_year,
  publish_date,
  keywords,
  abstract,
  provider,
  author,
  contact,
  ST_AsGeoJSON(st_transform(coverage_spatial, 3857)) coverage_spatial,
  coverage_temp_start,
  coverage_temp_end,
  res_spatial,
  res_spatial_unit,
  res_temperature,
  res_temperature_unit,
  uncertainty,
  uncertainty_unit,
  doi,
  license,
  url_download,
  file_format,
  file_size,
  file_size_unit,
  url_info,
  created_by,
  created_at,
  modified_by,
  modified_at,
  present
  
  from public.dataproducts
  
  where not ( ST_Equals(coverage_spatial, ST_GeomFromText('POLYGON ((-180 -90, -180 90, 180 90, 180 -90, -180 -90))', 4326)) );`)
  return result.rows
}
