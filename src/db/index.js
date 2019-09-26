'use strict'
import csvReader from '../lib/csv-reader'
import { Pool } from 'pg'
import { log, logError } from '../lib/log'
import { readFileSync, readdirSync } from 'fs'
import { config } from 'dotenv'
import { join, normalize } from 'path'
import DataLoader from 'dataloader'
import sift from 'sift'
config()

String.prototype.sqlize = function() {
  return `'${this.replace(/'/g, "''")}'`
}

const makeSql = (tableName, headers, contents) => {
  const ddlDrop = `drop table if exists "${tableName}";`
  const ddlMake = `create table ${tableName} (${headers.map(h => `"${h}" text`).join(',')});`
  const dmlInsert = `
    insert into "${tableName}" (${headers.map(h => `"${h}"`)})
    values ${contents.map(row => '(' + row.map(v => v.sqlize()).join(',') + ')').join(',')};`
  return `${ddlDrop}${ddlMake}${dmlInsert}`
}

const DB = process.env.POSTGRES_DATABASE || 'seacrifog'

const getPool = database =>
  new Pool({
    host: process.env.POSTGRES_HOST || 'localhost',
    user: process.env.POSTGRES_USER || 'postgres',
    database,
    password: process.env.POSTGRES_PASSWORD || 'password',
    port: parseInt(process.env.POSTGRES_PORT, 10) || 5432,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000
  })

const loadSqlFile = (filepath, ...args) => {
  let sql = readFileSync(normalize(join(__dirname, `./sql/${filepath}`))).toString('utf8')
  args.forEach((arg, i) => {
    const regex = new RegExp(`:${i + 1}`, 'g')
    sql = sql.replace(regex, `${arg}`)
  })
  return sql
}

export const pool = getPool(DB)

export const execSqlFile = async (filepath, ...args) => {
  const sql = loadSqlFile(filepath, ...args)
  return await pool.query(sql)
}

/**
 * For development purposes
 * While the model is still being built it's helpful to refresh the database
 * on every Node.js restart. This should obviously be deleted at some point
 */
Promise.resolve(
  (async () => {
    log(
      '\n\n',
      '============================================ WARNING!!!!! ==================================================\n',
      "Dropping and recreating databases. If you see this as a log on the production server YOU'RE IN TROUBLE!!!!!!\n",
      '============================================================================================================\n\n'
    )
    // Drop and create seacrifog
    const configDbPool = getPool('postgres')
    await configDbPool.query(loadSqlFile('migration/db-setup/stop-db.sql', DB))
    await configDbPool.query(loadSqlFile('migration/db-setup/drop-db.sql', DB))
    await configDbPool.query(loadSqlFile('migration/db-setup/create-db.sql', DB))
    await configDbPool.end()
    log('seacrifog database dropped and re-created!')

    // Create the seacrifog schema, and populate database
    const seacrifogPool = getPool(DB)
    await seacrifogPool.query(loadSqlFile('migration/schema.sql'))
    await seacrifogPool.query(loadSqlFile('migration/etl.sql'))
    log('seacrifog schema re-created!')

    // Update the database from the CSVs
    const cleanUp = []
    const DIRECTORIES = ['jcommops', 'simple_sites']

    for (const D of DIRECTORIES) {
      console.log(`\nParsing ${D} directory`)

      // Get the files in this directory
      const directoryPath = normalize(join(__dirname, `./csvs/${D}/`))
      const relatedFiles = readdirSync(directoryPath).filter(fName => fName.indexOf('csv') >= 0)
      for (const F of relatedFiles) {
        const csvPath = normalize(join(directoryPath, F))
        const csvContents = await csvReader(csvPath)

        // Separate the headers from the CSV contents
        const csvHeaders = csvContents.splice(0, 1).flat()

        // Setup the temp table
        const tempTableName = `${D}_${F.replace('.csv', '')}_temp`.toLowerCase()
        console.log(`Creating ${tempTableName} with`, csvContents.length, 'rows')
        const sql = makeSql(tempTableName, csvHeaders, csvContents)
        try {
          await seacrifogPool.query(sql)
        } catch (error) {
          throw new Error(
            `Error inserting rows from ${csvPath} into ${tempTableName}, ${error}. SQL: ${sql}`
          )
        }

        // Register the temp table for cleanup
        cleanUp.push(tempTableName)
      }

      // Run the migration SQL to select from the temp table into the model
      const sql = readFileSync(`${directoryPath}/_.sql`, { encoding: 'utf8' })
      await seacrifogPool.query(sql)

      // Clean up all the temp tables
      // const ddlDropStmt = `drop table ${tempTableName};`
      // await client.query(ddlDropStmt)
    }
    log("\nDev DB setup complete. If you don't see this message there was a problem")
    await seacrifogPool.end()
  })()
).catch(err => {
  logError('Error initializing DEV database', err)
  process.exit(1)
})

/**
 * TODO
 * I think these will work as intended. But the example is certainly better!
 * https://github.com/graphql/dataloader/blob/master/examples/SQL.md
 *
 * TODO: sift() should be used in a map function, not a filter function
 * I don't know why it was difficult to get that done
 */
export const initializeLoaders = () => {
  const findVariablesOfProtocols = new DataLoader(async keys => {
    const sql = `
    select
    v.*,
    rt."name" relationship_type_name,
    rt.description relationship_type_description,
    x.protocol_id
    from public.protocol_variable_xref x
    join public.variables v on v.id = x.variable_id
    join public.relationship_types rt on rt.id = x.relationship_type_id
    where x.protocol_id in (${keys.join(',')});`
    const rows = (await pool.query(sql)).rows
    return keys.map(key => rows.filter(sift({ protocol_id: key })) || [])
  })

  const findProtocolsOfVariables = new DataLoader(async keys => {
    const sql = `
    select
    p.*,
    rt."name" relationship_type_name,
    rt.description relationship_type_description,
    x.variable_id
    from public.protocol_variable_xref x
    join public.protocols p on p.id = x.protocol_id
    join public.relationship_types rt on rt.id = x.relationship_type_id
    where x.variable_id in (${keys.join(',')});`
    const rows = (await pool.query(sql)).rows
    return keys.map(key => rows.filter(sift({ variable_id: key })) || [])
  })

  const findRForcingsOfVariables = new DataLoader(async keys => {
    const sql = `
    select rf.*,
    x.variable_id
    from public.rforcing_variable_xref x
    join public.rforcings rf on rf.id = x.rforcing_id
    where x.variable_id in (${keys.join(',')});`
    const rows = (await pool.query(sql)).rows
    return keys.map(key => rows.filter(sift({ variable_id: key })) || [])
  })

  const findVariablesOfNetworks = new DataLoader(async keys => {
    const sql = `
    select
    v.*,
    x.network_id
    from public.network_variable_xref x
    join public.variables v on v.id = x.variable_id
    where x.network_id in (${keys.join(',')});`
    const rows = (await pool.query(sql)).rows
    return keys.map(key => rows.filter(sift({ network_id: key })) || [])
  })

  const findNetworksOfSites = new DataLoader(async keys => {
    const sql = `
    select
    n.*,
    x.site_id
    from public.site_network_xref x
    join public.networks n on n.id = x.network_id
    where x.site_id in (${keys.join(',')});`
    const rows = (await pool.query(sql)).rows
    return keys.map(key => rows.filter(sift({ site_id: key })) || [])
  })

  const findVariablesOfRadiativeForcings = new DataLoader(async keys => {
    const sql = `
    select
    v.*,
    x.rforcing_id
    from public.rforcing_variable_xref x
    join public.variables v on v.id = x.variable_id
    where x.rforcing_id in (${keys.join(',')});`
    const rows = (await pool.query(sql)).rows
    return keys.map(key => rows.filter(sift({ rforcing_id: key })) || [])
  })

  const findVariablesOfDataproducts = new DataLoader(async keys => {
    const sql = `
    select
    v.*,
    x.dataproduct_id
    from public.dataproduct_variable_xref x
    join public.variables v on v.id = x.variable_id
    where x.dataproduct_id in (${keys.join(',')});`
    const rows = (await pool.query(sql)).rows
    return keys.map(key => rows.filter(sift({ dataproduct_id: key })) || [])
  })

  const findDataproductsOfVariables = new DataLoader(async keys => {
    const sql = `
    select
    d.*,
    x.variable_id
    from public.dataproduct_variable_xref x
    join public.dataproducts d on d.id = x.dataproduct_id
    where x.variable_id in (${keys.join(',')});`
    const rows = (await pool.query(sql)).rows
    return keys.map(key => rows.filter(sift({ variable_id: key })) || [])
  })

  const findVariables = new DataLoader(async keys => {
    const sql = `select * from public.variables where id in (${keys.join(',')});`
    const rows = (await pool.query(sql)).rows
    return keys.map(key => rows.filter(sift({ id: key })) || [])
  })

  const findProtocols = new DataLoader(async keys => {
    const sql = `select * from public.protocols where id in (${keys.join(',')});`
    const rows = (await pool.query(sql)).rows
    return keys.map(key => rows.filter(sift({ id: key })) || [])
  })

  const findDataproducts = new DataLoader(async keys => {
    const sql = `
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
    
    where
    not ( ST_Equals(coverage_spatial, ST_GeomFromText('POLYGON ((-180 -90, -180 90, 180 90, 180 -90, -180 -90))', 4326)) )
    and id in (${keys.join(',')});`
    const rows = (await pool.query(sql)).rows
    return keys.map(key => rows.filter(sift({ id: key })) || [])
  })

  return {
    // VARIABLES
    findVariables: key => findVariables.load(key),
    findVariablesOfNetworks: key => findVariablesOfNetworks.load(key),
    findVariablesOfProtocols: key => findVariablesOfProtocols.load(key),
    findVariablesOfDataproducts: key => findVariablesOfDataproducts.load(key),
    findVariablesOfRadiativeForcings: key => findVariablesOfRadiativeForcings.load(key),
    findDataproductsOfVariables: key => findDataproductsOfVariables.load(key),
    findRForcingsOfVariables: key => findRForcingsOfVariables.load(key),

    // DATAPRODUCTS
    findDataproducts: key => findDataproducts.load(key),

    // SITES
    findNetworksOfSites: key => findNetworksOfSites.load(key),

    // PROTOCOLS
    findProtocols: key => findProtocols.load(key),
    findProtocolsOfVariables: key => findProtocolsOfVariables.load(key)
  }
}
