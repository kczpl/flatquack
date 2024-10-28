import fs from "fs";
import path from "path";
import {expect} from "bun:test"

import {templateToQuery} from "../src/query-builder.js";
import {testQueryTemplate, openMemoryDb, getColumns, executeQuery} from "../tests/test-util.js";
import fhirSchema from "../schemas/fhir-schema-r4.json";

const outputPath = path.join(import.meta.dir, "../flatquack_test_output.json");
const testDirectory = path.join(import.meta.dir, "../tests/spec-tests/");

const testFiles = fs.readdirSync(testDirectory).filter(f => !(/\.temp\.json|skip$|^\./.test(f)));

const results = testFiles.map(file => {
	const testGroup = JSON.parse(fs.readFileSync(testDirectory + file))
	const resourceFile = testDirectory + file + ".temp.json";
	Bun.write(resourceFile, JSON.stringify(testGroup.resources)); 
	
	const results = testGroup.tests.map( async testCase => {
		let passed = false;
		const db = openMemoryDb();
		try {
			const querySql = templateToQuery(
				testCase.view, fhirSchema, testQueryTemplate, 
				[["test_file_path", resourceFile]], false, true
			);
			if (testCase.expect||testCase.expectError) {
				const result = await executeQuery(db, querySql);
				passed = expect(new Set(result)).toEqual(new Set(testCase.expect))
					? false
					: true;
			}
			if (testCase.expectColumns) {
				const cols = await getColumns(db, querySql);
				passed = expect(cols).toEqual(testCase.expectColumns)
					? false
					: true;
			}
		} catch(e) {
			passed = testCase.expectError ? true : false;
		}
		db.close();
		return {name: testCase.title, "result": {passed}};
	});

	return Promise.all(results).then(results => [file, results]);
});

Promise.all(results)
	.then( data =>  {
		const output = data.reduce((fileOutput, fileData) => {
			return {...fileOutput, [fileData[0]]: {tests: fileData[1]}}
		}, {})
		let stats =  {passed:0, failed:0};
		data.forEach(f => f[1].forEach(t => {
			stats.passed = stats.passed + (t.result.passed ? 1 : 0);
			stats.failed = stats.failed + (t.result.passed ? 0 : 1);
		}))
		console.log(stats)
		Bun.write(outputPath, JSON.stringify(output)); 
	})