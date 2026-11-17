define(['persist/persistenceStoreManager', 'persist/pouchDBPersistenceStoreFactory',
        'persist/persistenceManager', 'persist/impl/logger'],
  function(persistenceStoreManager, pouchDBPersistenceStoreFactory,
           persistenceManager, logger){
  'use strict';

  // How binary data, such as a PDF response, is stored in and read back from PouchDB: once, as
  // an attachment, and without reading the whole store.
  describe('binary cache test', function() {
    var SIZE = 100000;

    function bytes() {
      var array = new Uint8Array(SIZE);
      for (var i = 0; i < SIZE; i++) {
        array[i] = i % 251;
      }
      return array;
    }

    function sameBytes(blob) {
      return new Response(blob).arrayBuffer().then(function (buffer) {
        var actual = new Uint8Array(buffer);
        var expected = bytes();
        if (actual.length !== expected.length) {
          return false;
        }
        for (var i = 0; i < actual.length; i++) {
          if (actual[i] !== expected[i]) {
            return false;
          }
        }
        return true;
      });
    }

    describe('store', function() {
      var storeName = 'testBinaryCacheStore';
      var store;

      beforeEach(function () {
        persistenceStoreManager.registerStoreFactory(storeName, pouchDBPersistenceStoreFactory);
        return persistenceStoreManager.deleteStore(storeName).then(function () {
          return persistenceStoreManager.openStore(storeName);
        }).then(function (opened) {
          store = opened;
          return store.upsert('pdf', {created: 1}, {responseData: {body: {arrayBuffer: bytes().buffer}}});
        });
      });

      it('stores the binary data as an attachment only, not in the document as well', function () {
        return store._db.get('pdf').then(function (doc) {
          var body = doc.value.responseData.body;
          assert.strictEqual(body.arrayBuffer, null, 'no copy in the document');
          assert.notProperty(body, 'key', 'no stray key property');
          assert.strictEqual(doc._attachments['responseData.body.arrayBuffer'].length, SIZE, 'attachment');
        });
      });

      it('reads the binary data back by key, without inlining the attachment', function () {
        var get = store._db.get;
        var getOptions = [];
        store._db.get = function (id, options) {
          getOptions.push(options);
          return get.apply(this, arguments);
        };

        return store.findByKey('pdf').then(function (value) {
          store._db.get = get;
          getOptions.forEach(function (options) {
            assert.notOk(options && options.attachments, 'attachment not inlined as base64');
          });
          return sameBytes(value.responseData.body.arrayBuffer);
        }).then(function (same) {
          assert.ok(same, 'same bytes');
        });
      });

      it('reads the binary data back by find when the value is asked for', function () {
        return store.find({selector: {key: {$eq: 'pdf'}}, fields: ['key', 'value']}).then(function (entries) {
          assert.lengthOf(entries, 1);
          assert.notProperty(entries[0], '_attachments', 'stubs left out');
          return sameBytes(entries[0].value.responseData.body.arrayBuffer);
        }).then(function (same) {
          assert.ok(same, 'same bytes');
        });
      });

      it('finds without the value when it is not asked for', function () {
        return store.find({selector: {key: {$eq: 'pdf'}}, fields: ['key']}).then(function (entries) {
          assert.lengthOf(entries, 1);
          assert.strictEqual(entries[0].key, 'pdf');
          assert.notProperty(entries[0], 'value');
        });
      });
    });

    describe('cache', function() {
      var cache;
      var url = 'https://binarycache.test/report.pdf';

      beforeEach(function () {
        persistenceStoreManager.registerDefaultStoreFactory(pouchDBPersistenceStoreFactory);
        return persistenceManager.init().then(function () {
          cache = persistenceManager.getCache();
          return cache.clear();
        }).then(function () {
          return cache.put(new Request(url), new Response(bytes(), {headers: {'Content-Type': 'application/pdf'}}));
        });
      });

      it('matches a cached PDF with its bytes intact', function () {
        return cache.match(new Request(url)).then(function (response) {
          assert.ok(response, 'matched');
          return response.blob();
        }).then(sameBytes).then(function (same) {
          assert.ok(same, 'same bytes');
        });
      });

      it('answers a request that is not cached without searching the store', function () {
        return cache._getStore().then(function (store) {
          var find = store.find;
          var found = 0;
          store.find = function () {
            found++;
            return find.apply(this, arguments);
          };

          var other = new Request('https://binarycache.test/other.pdf');
          return Promise.all([cache.match(other), cache.hasMatch(other), cache.matchAll(other)]).then(function (results) {
            store.find = find;
            assert.isUndefined(results[0], 'match');
            assert.isFalse(results[1], 'hasMatch');
            assert.isUndefined(results[2], 'matchAll');
            assert.strictEqual(found, 0, 'store not searched');
          });
        });
      });
    });
  });
});
