#!/usr/bin/env node

/**
 * v1 Contract Schema Validator
 *
 * Validates:
 * - All JSON Schema files are valid JSON
 * - All required contracts are present
 * - Version manifests reference defined schemas
 * - Schema structure meets basic requirements
 *
 * Full JSON Schema validation via ajv deferred to build-time contract tests.
 */

import fs from 'fs';
import path from 'path';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const schemaDir = path.join(import.meta.dirname, 'schemas');
const manifest = JSON.parse(
  fs.readFileSync(path.join(import.meta.dirname, 'versions.json'), 'utf8')
);

const requiredSchemas = [
  'course-package.schema.json',
  'extension-messages.schema.json',
  'extension-storage.schema.json',
  'analytics-event.schema.json'
];

function validateSchemas() {
  const errors = [];
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);

  // Check all required schemas exist and parse as valid JSON
  for (const schemaFile of requiredSchemas) {
    const schemaPath = path.join(schemaDir, schemaFile);
    if (!fs.existsSync(schemaPath)) {
      errors.push(`Missing schema: ${schemaFile}`);
      continue;
    }

    try {
      const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));

      // Basic structure checks
      if (!schema.$schema) {
        errors.push(`${schemaFile}: missing $schema declaration`);
      }
      if (!schema.type) {
        errors.push(`${schemaFile}: missing root type`);
      }
      if (!schema.title) {
        errors.push(`${schemaFile}: missing title`);
      }

      try {
        ajv.compile(schema);
      } catch (error) {
        errors.push(`${schemaFile}: invalid JSON Schema (${error.message})`);
      }

      console.log(`✓ ${schemaFile}: valid JSON and basic schema structure`);
    } catch (e) {
      errors.push(`Invalid JSON in ${schemaFile}: ${e.message}`);
    }
  }

  // Verify manifest references valid schemas
  for (const [key, contract] of Object.entries(manifest.contracts)) {
    if (contract.schema_file) {
      const file = path.basename(contract.schema_file);
      if (!requiredSchemas.includes(file)) {
        errors.push(`Manifest references unknown schema: ${file} (contract: ${key})`);
      }
    }
  }

  if (errors.length > 0) {
    console.error('❌ Contract validation failed:');
    errors.forEach(e => console.error(`  - ${e}`));
    process.exit(1);
  }

  console.log('\n✓ All v1 contracts validated');
  console.log(`  - ${requiredSchemas.length} schemas defined`);
  console.log(`  - ${Object.keys(manifest.contracts).length} contracts in manifest`);
}

validateSchemas();
