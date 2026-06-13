'use strict';

/**
 * Minimal in-memory Firestore emulation used across integration tests.
 * Supports the subset of the Firestore API exercised by the EcoTrack backend:
 *   collection(name).doc(id).get()/set()/update()/delete()
 *   collection(name).add(data)
 *   collection(name).where(field, op, value).orderBy(field, dir).limit(n).offset(n).get()
 */

function createMockFirestore(seed = {}) {
  // store[collection] = Map<id, data>
  const store = {};
  for (const [col, docs] of Object.entries(seed)) {
    store[col] = new Map(Object.entries(docs));
  }

  function getCollectionMap(name) {
    if (!store[name]) store[name] = new Map();
    return store[name];
  }

  function applyFilter(docs, field, op, value) {
    return docs.filter(([, data]) => {
      const fieldValue = field.split('.').reduce((acc, key) => (acc == null ? acc : acc[key]), data);
      switch (op) {
        case '==':
          return fieldValue === value;
        case '!=':
          return fieldValue !== value;
        case '>=':
          return fieldValue >= value;
        case '<=':
          return fieldValue <= value;
        case '>':
          return fieldValue > value;
        case '<':
          return fieldValue < value;
        default:
          return true;
      }
    });
  }

  function makeQuery(collectionName, filters = [], order = null, limitN = null, offsetN = 0) {
    return {
      where(field, op, value) {
        return makeQuery(collectionName, [...filters, { field, op, value }], order, limitN, offsetN);
      },
      orderBy(field, direction = 'asc') {
        return makeQuery(collectionName, filters, { field, direction }, limitN, offsetN);
      },
      limit(n) {
        return makeQuery(collectionName, filters, order, n, offsetN);
      },
      offset(n) {
        return makeQuery(collectionName, filters, order, limitN, n);
      },
      async get() {
        let entries = Array.from(getCollectionMap(collectionName).entries());

        for (const f of filters) {
          entries = applyFilter(entries, f.field, f.op, f.value);
        }

        if (order) {
          entries.sort((a, b) => {
            const av = a[1][order.field];
            const bv = b[1][order.field];
            if (av === bv) return 0;
            const cmp = av > bv ? 1 : -1;
            return order.direction === 'desc' ? -cmp : cmp;
          });
        }

        if (offsetN) entries = entries.slice(offsetN);
        if (limitN != null) entries = entries.slice(0, limitN);

        const docs = entries.map(([id, data]) => ({
          id,
          data: () => data,
          exists: true,
          ref: makeDocRef(collectionName, id),
        }));

        return { docs, size: docs.length, empty: docs.length === 0 };
      },
    };
  }

  function makeDocRef(collectionName, id) {
    return {
      id,
      async get() {
        const map = getCollectionMap(collectionName);
        const exists = map.has(id);
        return {
          id,
          exists,
          data: () => map.get(id),
          ref: this,
        };
      },
      async set(data, options = {}) {
        const map = getCollectionMap(collectionName);
        if (options.merge && map.has(id)) {
          map.set(id, { ...map.get(id), ...data });
        } else {
          map.set(id, { ...data });
        }
        return { id };
      },
      async update(data) {
        const map = getCollectionMap(collectionName);
        if (!map.has(id)) throw Object.assign(new Error('NOT_FOUND'), { code: 5 });
        map.set(id, { ...map.get(id), ...data });
        return { id };
      },
      async delete() {
        getCollectionMap(collectionName).delete(id);
      },
    };
  }

  let autoId = 0;

  return {
    collection(name) {
      const query = makeQuery(name);
      return {
        ...query,
        doc(id) {
          const docId = id || `auto_${++autoId}`;
          return makeDocRef(name, docId);
        },
        async add(data) {
          const docId = `auto_${++autoId}`;
          getCollectionMap(name).set(docId, { ...data });
          return { id: docId };
        },
      };
    },
    settings() {},
    _store: store,
  };
}

module.exports = { createMockFirestore };
