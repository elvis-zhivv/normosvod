import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { SCHEMAS_DIR } from './project-paths.mjs';

const schemaCache = new Map();

async function loadSchema(schemaFileName) {
  if (!schemaCache.has(schemaFileName)) {
    const schemaPath = path.join(SCHEMAS_DIR, schemaFileName);
    const schema = JSON.parse(await readFile(schemaPath, 'utf8'));
    schemaCache.set(schemaFileName, schema);
  }

  return schemaCache.get(schemaFileName);
}

function normalizeAllowedTypes(type) {
  if (Array.isArray(type)) {
    return type;
  }

  return type ? [type] : [];
}

function matchesPrimitiveType(value, expectedType) {
  switch (expectedType) {
    case 'array':
      return Array.isArray(value);
    case 'null':
      return value === null;
    case 'integer':
      return Number.isInteger(value);
    case 'number':
      return typeof value === 'number' && Number.isFinite(value);
    case 'object':
      return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
    case 'string':
      return typeof value === 'string';
    case 'boolean':
      return typeof value === 'boolean';
    default:
      return true;
  }
}

function validateAgainstSchema(value, schema, currentPath = '$') {
  const errors = [];

  if (!schema || typeof schema !== 'object') {
    return errors;
  }

  if (schema.const !== undefined && value !== schema.const) {
    errors.push(`${currentPath}: expected const ${JSON.stringify(schema.const)}.`);
    return errors;
  }

  if (schema.enum && !schema.enum.includes(value)) {
    errors.push(`${currentPath}: expected one of ${schema.enum.join(', ')}.`);
    return errors;
  }

  if (schema.oneOf) {
    const matches = schema.oneOf.filter((candidate) => validateAgainstSchema(value, candidate, currentPath).length === 0);

    if (matches.length !== 1) {
      errors.push(`${currentPath}: expected value matching exactly one schema variant.`);
    }

    return errors;
  }

  if (schema.anyOf) {
    const matches = schema.anyOf.some((candidate) => validateAgainstSchema(value, candidate, currentPath).length === 0);

    if (!matches) {
      errors.push(`${currentPath}: expected value matching at least one schema variant.`);
    }

    return errors;
  }

  const allowedTypes = normalizeAllowedTypes(schema.type);

  if (allowedTypes.length > 0 && !allowedTypes.some((type) => matchesPrimitiveType(value, type))) {
    errors.push(`${currentPath}: expected type ${allowedTypes.join(' | ')}.`);
    return errors;
  }

  if (schema.type === 'object') {
    const properties = schema.properties ?? {};
    const required = Array.isArray(schema.required) ? schema.required : [];

    for (const propertyName of required) {
      if (!Object.hasOwn(value, propertyName)) {
        errors.push(`${currentPath}.${propertyName}: required property is missing.`);
      }
    }

    for (const [propertyName, propertySchema] of Object.entries(properties)) {
      if (!Object.hasOwn(value, propertyName)) {
        continue;
      }

      errors.push(...validateAgainstSchema(value[propertyName], propertySchema, `${currentPath}.${propertyName}`));
    }

    if (schema.additionalProperties === false) {
      for (const propertyName of Object.keys(value)) {
        if (!Object.hasOwn(properties, propertyName)) {
          errors.push(`${currentPath}.${propertyName}: property is not allowed by schema.`);
        }
      }
    }
  }

  if (schema.type === 'array') {
    if (Number.isInteger(schema.minItems) && value.length < schema.minItems) {
      errors.push(`${currentPath}: expected at least ${schema.minItems} items.`);
    }

    if (schema.items) {
      value.forEach((item, index) => {
        errors.push(...validateAgainstSchema(item, schema.items, `${currentPath}[${index}]`));
      });
    }
  }

  if (schema.type === 'string') {
    if (Number.isInteger(schema.minLength) && value.length < schema.minLength) {
      errors.push(`${currentPath}: expected string length >= ${schema.minLength}.`);
    }
  }

  return errors;
}

export async function assertSchema(schemaFileName, data, { label = schemaFileName } = {}) {
  const schema = await loadSchema(schemaFileName);
  const errors = validateAgainstSchema(data, schema);

  if (errors.length > 0) {
    throw new Error(`Schema validation failed for ${label}:\n${errors.join('\n')}`);
  }
}
