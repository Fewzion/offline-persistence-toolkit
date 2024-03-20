define(["./keyValuePersistenceStore", "./logger"],
  function (keyValuePersistenceStore, logger) {
    'use strict';

    var CapacitorPersistenceStore = function (name) {
      keyValuePersistenceStore.call(this, name);
    }

    CapacitorPersistenceStore.prototype = new keyValuePersistenceStore();

    CapacitorPersistenceStore.prototype.Init = function (options) {
      this._version = (options && options.version) || '0';
      this._storage = options ? options.storage : null;
      if (!this._storage) {
        throw TypeError("missing capacitor storage plugin");
      }
      return Promise.resolve();
    };

    CapacitorPersistenceStore.prototype._insert = function (key, metadata, value) {
      var insertKey = this._createRawKey(key);
      // the key passed-in could be a non-string type, we save the original
      // key value as well so that we could return the same key back when asked
      // for it.
      var insertValue = {
        key: key,
        metadata: metadata,
        value: value
      };

      var valueToStore = JSON.stringify(insertValue);
      return this._storage.set({ key: insertKey, value: valueToStore });
    };

    CapacitorPersistenceStore.prototype.removeByKey = function (key) {
      logger.log("Offline Persistence Toolkit capacitorPersistenceStore: removeByKey() with key: " + key);
      var self = this;
      return self.findByKey(key).then(function(storageData) {
        if (storageData) {
          var insertKey = self._createRawKey(key);
          return self._storage.remove({ key: insertKey }).then(function() {
            return Promise.resolve(true);
          });
        } else {
          return Promise.resolve(false);
        }
      });
    };

    CapacitorPersistenceStore.prototype._createRawKey = function (key) {
      return this._name + this._version + key.toString();
    };

    CapacitorPersistenceStore.prototype.keys = function () {
      logger.log("Offline Persistence Toolkit capacitorPersistenceStore: keys()");
      var self = this;
      var prefix = self._name + self._version;
      var allKeys = [];
      return self._storage.keys().then(function(allRawKeys) {
        var p = Promise.resolve();
        allRawKeys.keys.forEach(function(rawKey) {
          if (rawKey.indexOf(prefix) === 0) {
            // when asked for keys, we need to return the saved original key,
            // which might not be a string typed value.
            p = p.then(function() {
              return self._storage.get({ key: rawKey }).then(function(storageData) {
                if (storageData.value) {
                  try {
                    var item = JSON.parse(storageData.value);
                    var key = item.key;
                    if (key) {
                      allKeys.push(key);
                    }
                    else {
                      // pre 1.4.1 method of obtain the key values.
                      allKeys.push(rawKey.slice(prefix.length));
                    }
                  } catch (err) {
                    logger.log("data is not in valid JSON format: " + storageData.value);
                  }
                }
              });
            });
          }
        });
        return p;
      }).then(function() {
        return Promise.resolve(allKeys);
      });
    };

    CapacitorPersistenceStore.prototype.getItem = function (key) {
      logger.log("Offline Persistence Toolkit capacitorPersistenceStore: getItem() with key: " + key);
      var insertKey = this._createRawKey(key);
      return this._storage.get({ key: insertKey }).then(function(storageData) {
        if (storageData.value) {
          try {
            var item = JSON.parse(storageData.value);
            return Promise.resolve(item);
          } catch (err) {
            return Promise.resolve();
          }
        } else {
          return Promise.resolve();
        }
      });
    };

    return CapacitorPersistenceStore;
  });
