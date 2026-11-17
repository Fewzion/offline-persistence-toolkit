define(['persist/persistenceStoreManager', 'persist/pouchDBPersistenceStoreFactory',
        'persist/persistenceManager'],
  function(persistenceStoreManager, pouchDBPersistenceStoreFactory, persistenceManager){
  'use strict';

  // `keys` and `delete` for a request read only the entries that match it, not every entry in
  // the store: no index the find plugin can use fits their searches.
  describe('cache keys test', function() {
    var base = 'https://cachekeys.test/api/Tasks.json';
    var cache;
    var store;
    var counts;
    var originals;

    function put(url) {
      return cache.put(new Request(url), new Response('[]', {headers: {'Content-Type': 'application/json'}}));
    }

    function count(object, name) {
      originals.push({object: object, name: name, fn: object[name]});
      counts[name] = 0;
      var fn = object[name];
      object[name] = function () {
        counts[name]++;
        return fn.apply(this, arguments);
      };
    }

    beforeEach(function () {
      persistenceStoreManager.registerDefaultStoreFactory(pouchDBPersistenceStoreFactory);
      return persistenceManager.init().then(function () {
        cache = persistenceManager.getCache();
        return cache.clear();
      }).then(function () {
        return put(base + '?filter=a');
      }).then(function () {
        return put(base + '?filter=b');
      }).then(function () {
        return put(base + '/1');
      }).then(function () {
        return put('https://cachekeys.test/api/Users.json');
      }).then(function () {
        return cache._getStore();
      }).then(function (opened) {
        store = opened;
        counts = {};
        originals = [];
        count(store, 'find');
        count(store._db, 'allDocs');
        count(store, 'findByKey');
      });
    });

    afterEach(function () {
      originals.forEach(function (original) {
        original.object[original.name] = original.fn;
      });
    });

    it('lists the requests that match, ignoring the query string, reading only those', function () {
      return cache.keys(new Request(base), {ignoreSearch: true}).then(function (requests) {
        assert.sameMembers(requests.map(function (request) {
          return request.url;
        }), [base + '?filter=a', base + '?filter=b']);
        assert.strictEqual(counts.find, 0, 'store not searched');
        assert.strictEqual(counts.allDocs, 0, 'no entries listed');
        assert.strictEqual(counts.findByKey, 2, 'each match read once');
      });
    });

    it('lists the request that matches exactly', function () {
      return cache.keys(new Request(base + '?filter=b')).then(function (requests) {
        assert.deepEqual(requests.map(function (request) {
          return request.url;
        }), [base + '?filter=b']);
        assert.strictEqual(counts.find, 0, 'store not searched');
      });
    });

    it('lists nothing for a request that is not cached, without reading the store', function () {
      return cache.keys(new Request(base + '?filter=c')).then(function (requests) {
        assert.lengthOf(requests, 0);
        assert.strictEqual(counts.find, 0, 'store not searched');
        assert.strictEqual(counts.findByKey, 0, 'nothing read');
      });
    });

    it('still lists every request when given none', function () {
      return cache.keys().then(function (requests) {
        assert.lengthOf(requests, 4);
      });
    });

    it('deletes the entries that match, without searching the store', function () {
      return cache.delete(new Request(base), {ignoreSearch: true}).then(function (deleted) {
        assert.isTrue(deleted);
        assert.strictEqual(counts.find, 0, 'store not searched');
        return cache.keys();
      }).then(function (requests) {
        assert.sameMembers(requests.map(function (request) {
          return request.url;
        }), [base + '/1', 'https://cachekeys.test/api/Users.json']);
      });
    });

    it('deletes nothing for a request that is not cached', function () {
      return cache.delete(new Request(base + '?filter=c')).then(function (deleted) {
        assert.isFalse(deleted);
        assert.strictEqual(counts.find, 0, 'store not searched');
      });
    });
  });
});
