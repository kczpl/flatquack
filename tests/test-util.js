import duckdb from "duckdb";
import macros from "../templates/duck-macros";

export const testQueryTemplate = `
	WITH transformed AS (
		SELECT {{fq_sql_transform_expression}} AS result 
		FROM read_json_auto(
			'{{test_file_path}}'
			{{fq_sql_input_schema}}
		)
		{{fq_where_filter}}
	)
	SELECT {{fq_sql_flattening_cols}}
	FROM transformed
	{{fq_sql_flattening_tables}}
`

export function openMemoryDb() {
	const db = new duckdb.Database(':memory:');
	db.all(macros);
	return db;
}

export function getColumns(db, query) {
	return new Promise( (resolve, reject) => {
		db.prepare(query, (err, stmt) => {
			if (err) return reject(err);
			resolve(stmt.columns().map(c => c.name));
		})
	});
}

export function executeQuery(db, query) {
	return new Promise( (resolve, reject) => {
		db.all(query, (err, res) => {
			if (err) return reject(err);
			resolve(res);
		})
	});
}