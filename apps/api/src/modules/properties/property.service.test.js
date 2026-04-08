import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';

import { PropertyModel } from './property.model.js';
import { deleteProperty, propertyServiceDependencies } from './property.service.js';

function createSortedLeanQuery(result) {
  return {
    sort() {
      return {
        lean: async () => result,
      };
    },
  };
}

function setReadyState(value) {
  Object.defineProperty(mongoose.connection, 'readyState', {
    configurable: true,
    value,
  });
}

test('deleteProperty deletes an archived owned property and reports remaining counts', async (t) => {
  const originalReadyState = mongoose.connection.readyState;
  setReadyState(1);
  t.after(() => setReadyState(originalReadyState));

  t.mock.method(PropertyModel, 'findById', async () => ({
    _id: 'property-1',
    ownerUserId: 'user-1',
    title: 'Oak Street',
    status: 'archived',
  }));

  let deletedIds = [];
  t.mock.method(propertyServiceDependencies, 'deletePropertiesByIds', async (propertyIds) => {
    deletedIds = propertyIds;
    return { deletedPropertyCount: propertyIds.length, deletedPropertyIds: propertyIds };
  });
  t.mock.method(PropertyModel, 'find', () => createSortedLeanQuery([]));

  const result = await deleteProperty('property-1', 'user-1');

  assert.deepEqual(deletedIds, ['property-1']);
  assert.deepEqual(result, {
    deletedPropertyId: 'property-1',
    deletedPropertyTitle: 'Oak Street',
    remainingPropertyCount: 0,
    activePropertyCount: 0,
    archivedPropertyCount: 0,
  });
});

test('deleteProperty rejects active properties', async (t) => {
  const originalReadyState = mongoose.connection.readyState;
  setReadyState(1);
  t.after(() => setReadyState(originalReadyState));

  t.mock.method(PropertyModel, 'findById', async () => ({
    _id: 'property-1',
    ownerUserId: 'user-1',
    status: 'active',
  }));

  await assert.rejects(
    () => deleteProperty('property-1', 'user-1'),
    /Archive this property before deleting it permanently\./,
  );
});

test('deleteProperty rejects non-owner deletes', async (t) => {
  const originalReadyState = mongoose.connection.readyState;
  setReadyState(1);
  t.after(() => setReadyState(originalReadyState));

  t.mock.method(PropertyModel, 'findById', async () => ({
    _id: 'property-1',
    ownerUserId: 'user-2',
    status: 'archived',
  }));

  await assert.rejects(
    () => deleteProperty('property-1', 'user-1'),
    /You do not have permission to delete this property\./,
  );
});

test('deleteProperty rejects missing properties', async (t) => {
  const originalReadyState = mongoose.connection.readyState;
  setReadyState(1);
  t.after(() => setReadyState(originalReadyState));

  t.mock.method(PropertyModel, 'findById', async () => null);

  await assert.rejects(
    () => deleteProperty('property-1', 'user-1'),
    /Property not found\./,
  );
});
